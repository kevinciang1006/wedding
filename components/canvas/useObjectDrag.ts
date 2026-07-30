'use client';

import { useCallback, useRef } from 'react';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { snapPosition } from '@/lib/geometry/snap';
import { duplicateObject } from '@/lib/doc/factory';
import { getBoundsAt } from '@/lib/geometry/bounds';
import type { Cm, SceneObject } from '@/lib/types/doc';

interface DragEntry { id: string; startX: Cm; startY: Cm; node: Konva.Node }

// `altDuplicate` is captured once, from the modifier state at gesture
// START (`onDragStart`'s `e.evt.altKey`) — not re-read at `dragEnd`, since
// the key can easily have been released by the time the pointer comes up
// and what the user committed to is whichever state was true when the
// gesture began. One flag for the whole gesture, not per-entry: a
// multi-select alt-drag either duplicates every dragged object or none of
// them, there is no per-object mixed case.
interface DragState { entries: DragEntry[]; altDuplicate: boolean }

interface ObjectInteractionHandlers {
  draggable: boolean;
  onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onContextMenu: (e: Konva.KonvaEventObject<PointerEvent>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Everything that makes one canvas object node (Table/Prop/Label) respond to
 * the pointer: click/shift-click selection, the right-click menu trigger,
 * and drag-with-snap. Bundled in one hook — not split across three — because
 * every handler here attaches to the exact same Konva node, and the
 * selection handlers directly decide what `onDragStart` sees an instant
 * later in `viewStore.selectedIds`; splitting them would only move that
 * coupling into prop-plumbing across three call sites instead of removing
 * it. The four fields the brief names (`draggable`, `onDragStart/Move/End`)
 * are exactly the required contract; the rest is the selection/menu wiring
 * every node needs regardless.
 *
 * Selection is mousedown *and* click, not click alone, to get the standard
 * "drag the whole multi-selection" gesture for free: mousedown only changes
 * the selection when this id is NOT already selected, so grabbing an
 * already-selected member of a multi-selection and dragging doesn't first
 * collapse it to one object. `click` (which Konva fires only when the
 * pointer never crossed its drag threshold) always collapses the selection
 * to just this id unless Shift is held — so a plain click on one member of
 * an existing multi-selection, with no drag, still narrows it the way a
 * user expects.
 */
export function useObjectDrag(id: string): ObjectInteractionHandlers {
  // Populated at dragStart with every node moving in this gesture (the
  // grabbed one plus any co-selected siblings), read back at dragEnd. A
  // ref, not state: written and read entirely inside Konva event handlers,
  // never something a render needs to reflect.
  const dragRef = useRef<DragState | null>(null);

  const onMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const { selectedIds, select, addToSelection } = useViewStore.getState();
    if (selectedIds.includes(id)) return;
    if (e.evt.shiftKey) addToSelection(id);
    else select([id]);
  }, [id]);

  const onClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.shiftKey) return; // mousedown already added it
    useViewStore.getState().select([id]);
  }, [id]);

  const onContextMenu = useCallback((e: Konva.KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    const { select, openContextMenu } = useViewStore.getState();
    // Right-click always operates on exactly the object under the pointer —
    // simpler and unambiguous than reasoning about menu actions over an
    // arbitrary pre-existing multi-selection.
    select([id]);
    openContextMenu({ x: e.evt.clientX, y: e.evt.clientY, targetId: id });
  }, [id]);

  const onDragStart = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;
    // Space-held means this gesture should be a pan, not an object drag. That
    // is normally already guaranteed upstream: useViewportKeyboard empties
    // Konva.dragButtons while space is held, so this node's own internal
    // mousedown.konva listener never arms a drag on it in the first place,
    // and onDragStart is never even called for a space+drag gesture. This
    // branch is a safety net, not the mechanism, and it deliberately does
    // NOT call e.target.stopDrag() here (an earlier version did): Konva's
    // stopDrag() is not scoped to the node it's called on — DD._endDragBefore/
    // _endDragAfter (konva/lib/DragAndDrop.js) walk every entry in the one
    // shared DD._dragElements map and force-stop any 'dragging' entry, not
    // just this node's own — so calling it here would also collaterally kill
    // the Stage's own concurrent pan drag, which is exactly the bug this
    // arming-suppression approach replaced. Leaving dragRef untouched is
    // enough on its own: onDragEnd finds nothing to commit. getState(), not a
    // subscription: this hook is called once per object node, and a
    // subscription here would re-render every node on every space press.
    // Kept as a guard (rather than deleted) so a future change to the arming
    // logic can't silently reintroduce a spurious 'move' history entry.
    if (useViewStore.getState().spaceHeld) return;
    const { selectedIds } = useViewStore.getState();
    const ids = selectedIds.includes(id) ? selectedIds : [id];

    const entries: DragEntry[] = ids
      .map((oid) => {
        const node = oid === id ? e.target : stage.findOne(`#${oid}`);
        return node ? { id: oid, startX: node.x(), startY: node.y(), node } : undefined;
      })
      .filter(isDefined);

    // Option/Alt-drag duplicates in place. The intent is captured here, at
    // gesture start, from the modifier state at THIS instant — not
    // re-checked at dragEnd, where the key may already be up — but nothing
    // is written to docStore yet: inserting the copy now (an earlier
    // version did exactly that) makes it a SEPARATE history entry from the
    // 'move' dragEnd already commits for the dragged original, so one
    // alt-drag gesture became two undos and left a confusing intermediate
    // state (copy exactly on top of the un-moved original) after the
    // first. The actual insert is deferred to onDragEnd below, folded into
    // that same single commit. What happens here instead is purely visual:
    // a dashed, unfilled ghost rect per dragged object, at its start
    // position, published to `viewStore.duplicateGhosts` and drawn by
    // `DuplicateGhosts.tsx` on the Overlay layer — so the modifier still
    // gives immediate feedback despite writing nothing to the document yet.
    const altDuplicate = e.evt.altKey;
    if (altDuplicate && entries.length > 0) {
      const objects = useDocStore.getState().objects;
      const ghosts = entries
        .map((entry) => {
          const obj = objects[entry.id];
          if (!obj) return undefined;
          const bounds = getBoundsAt(obj, entry.startX, entry.startY);
          return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
        })
        .filter(isDefined);
      useViewStore.getState().setDuplicateGhosts(ghosts);
    }

    dragRef.current = { entries, altDuplicate };
  }, [id]);

  const onDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const entries = dragRef.current?.entries;
    if (!entries) return;
    const grabbed = entries.find((entry) => entry.id === id);
    const moving = useDocStore.getState().objects[id];
    if (!grabbed || !moving) return;

    // The carried-forward requirement from Task 4: snapPosition does not
    // exclude the dragged object from `others` itself — every object here
    // being co-dragged (the grabbed one and every selected sibling) must be
    // filtered out, or each would snap to its own un-moved self and nothing
    // would ever move.
    const draggedIds = new Set(entries.map((entry) => entry.id));
    const { objectOrder, objects } = useDocStore.getState();
    const others: SceneObject[] = objectOrder
      .filter((oid) => !draggedIds.has(oid))
      .map((oid) => objects[oid])
      .filter(isDefined);

    const view = useViewStore.getState();
    const result = snapPosition({
      moving,
      x: e.target.x(),
      y: e.target.y(),
      others,
      stageScale: view.scale,
      gridEnabled: view.gridSnap,
    });

    // Write the snapped result back onto the grabbed Konva node directly —
    // Konva already moved it to the raw (unsnapped) pointer position before
    // this handler ran; this overrides that for the current frame.
    e.target.position({ x: result.x, y: result.y });

    // Apply the same delta imperatively to every other selected node. None
    // of this touches docStore — that's the whole point of doing it here
    // rather than via a commit per frame.
    const dx = result.x - grabbed.startX;
    const dy = result.y - grabbed.startY;
    for (const entry of entries) {
      if (entry.id === id) continue;
      entry.node.position({ x: entry.startX + dx, y: entry.startY + dy });
    }
    e.target.getLayer()?.batchDraw();

    view.setGuides(result.guides);
    view.setDragDistance({
      from: { x: grabbed.startX, y: grabbed.startY },
      to: { x: result.x, y: result.y },
      cm: Math.hypot(dx, dy),
    });
  }, [id]);

  const onDragEnd = useCallback(() => {
    const state = dragRef.current;
    dragRef.current = null;
    useViewStore.getState().setGuides([]);
    useViewStore.getState().setDragDistance(null);
    useViewStore.getState().setDuplicateGhosts(null);
    if (!state || state.entries.length === 0) return;
    const { entries, altDuplicate } = state;
    // One commit for the whole gesture — a multi-select drag is still a
    // single history entry, exactly like a single-object drag, and an
    // alt-drag is no different: inserting the duplicate here, in the same
    // recipe as the move, rather than as its own separate commit back in
    // onDragStart, is what makes "drag away, a copy is left behind" ONE
    // undo instead of two. Two passes over `entries`, not one, and in this
    // order: every duplicate is inserted (reading each original's `x`/`y`
    // while it's still untouched, i.e. still the drag-start position) BEFORE
    // any original is moved — folding both into a single loop would risk a
    // future edit reordering the two statements inside it and silently
    // having the copy pick up the moved-to position instead of the
    // start position it's supposed to preserve.
    useDocStore.getState().commit((d) => {
      if (altDuplicate) {
        for (const entry of entries) {
          const obj = d.objects[entry.id];
          if (!obj) continue;
          const copy = duplicateObject(obj, 0, 0);
          d.objects[copy.id] = copy;
          d.objectOrder.push(copy.id);
        }
      }
      for (const entry of entries) {
        const obj = d.objects[entry.id];
        if (!obj) continue;
        obj.x = entry.node.x();
        obj.y = entry.node.y();
      }
    }, altDuplicate ? 'duplicate' : 'move');
  }, []);

  return { draggable: true, onMouseDown, onClick, onContextMenu, onDragStart, onDragMove, onDragEnd };
}
