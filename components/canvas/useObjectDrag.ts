'use client';

import { useCallback, useRef } from 'react';
import type Konva from 'konva';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { snapPosition } from '@/lib/geometry/snap';
import type { Cm, SceneObject } from '@/lib/types/doc';

interface DragEntry { id: string; startX: Cm; startY: Cm; node: Konva.Node }

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
  const dragRef = useRef<DragEntry[] | null>(null);

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
    const { selectedIds } = useViewStore.getState();
    const ids = selectedIds.includes(id) ? selectedIds : [id];
    dragRef.current = ids
      .map((oid) => {
        const node = oid === id ? e.target : stage.findOne(`#${oid}`);
        return node ? { id: oid, startX: node.x(), startY: node.y(), node } : undefined;
      })
      .filter(isDefined);
  }, [id]);

  const onDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const entries = dragRef.current;
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
    const entries = dragRef.current;
    dragRef.current = null;
    useViewStore.getState().setGuides([]);
    useViewStore.getState().setDragDistance(null);
    if (!entries || entries.length === 0) return;
    // One commit for every moved node — a multi-select drag is still a
    // single history entry, exactly like a single-object drag.
    useDocStore.getState().commit((d) => {
      for (const entry of entries) {
        const obj = d.objects[entry.id];
        if (!obj) continue;
        obj.x = entry.node.x();
        obj.y = entry.node.y();
      }
    }, 'move');
  }, []);

  return { draggable: true, onMouseDown, onClick, onContextMenu, onDragStart, onDragMove, onDragEnd };
}
