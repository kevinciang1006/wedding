'use client';

import { useEffect, useRef } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useUiStore } from '@/stores/uiStore';
import { useViewStore } from '@/stores/viewStore';
import { isEditableTarget } from '@/components/canvas/useViewportKeyboard';
import type { Viewport } from '@/components/canvas/useViewport';
import { createObject, duplicateObject } from '@/lib/doc/factory';
import { tableIdOfSeat } from '@/lib/doc/assignments';
import { viewportCentreCm } from '@/lib/geometry/viewport';
import { en } from '@/lib/i18n/en';
import { es } from '@/lib/i18n/es';
import { DUPLICATE_OFFSET, NUDGE, NUDGE_LARGE } from '@/lib/constants';
import type { Cm, ObjectType } from '@/lib/types/doc';

const DICTIONARIES = { en, es };

/** Moves every selected object by the same delta in one history entry. */
function nudgeSelection(dx: Cm, dy: Cm): void {
  const { selectedIds } = useViewStore.getState();
  if (selectedIds.length === 0) return;
  useDocStore.getState().commit((d) => {
    for (const id of selectedIds) {
      const obj = d.objects[id];
      if (!obj) continue;
      obj.x += dx;
      obj.y += dy;
    }
  }, 'nudge');
}

/**
 * Adds a freshly created object of `type` at `at` (room cm) as one history
 * entry and selects it — the one placement primitive behind the palette's
 * click-to-place and drag-to-place (`ObjectPalette.tsx`, `Editor.tsx`'s drop
 * handler) and the `T` new-table shortcut below, so all three ways of
 * adding an object commit and select identically.
 */
export function placeObject(type: ObjectType, at: { x: Cm; y: Cm }): void {
  const obj = createObject(type, at);
  useDocStore.getState().commit((d) => {
    d.objects[obj.id] = obj;
    d.objectOrder.push(obj.id);
  }, 'place');
  useViewStore.getState().select([obj.id]);
}

/**
 * Duplicates every selected object, offset by `DUPLICATE_OFFSET` on both
 * axes, as one history entry, and selects the new copies (not the
 * originals) — the standard "duplicate" expectation: the thing you can now
 * drag away is the copy. Exported so `ContextMenu.tsx`'s "Duplicate" item
 * can call the exact same logic rather than reimplementing it.
 */
export function duplicateSelection(): void {
  const { selectedIds, select } = useViewStore.getState();
  if (selectedIds.length === 0) return;
  const newIds: string[] = [];
  useDocStore.getState().commit((d) => {
    for (const id of selectedIds) {
      const obj = d.objects[id];
      if (!obj) continue;
      const copy = duplicateObject(obj, DUPLICATE_OFFSET, DUPLICATE_OFFSET);
      d.objects[copy.id] = copy;
      d.objectOrder.push(copy.id);
      newIds.push(copy.id);
    }
  }, 'duplicate');
  if (newIds.length > 0) select(newIds);
}

/**
 * Removes every selected object as one history entry, plus any
 * `seatAssignments` entries that belonged to a deleted table — seats are
 * derived from a table's own geometry (`lib/geometry/seats.ts`), so a seat
 * id with no owning table left in `objects` is not a state a table-less doc
 * should ever hold; leaving it would show a guest as permanently, invisibly
 * "seated" nowhere.
 */
export function deleteSelection(): void {
  const { selectedIds, clearSelection } = useViewStore.getState();
  if (selectedIds.length === 0) return;
  const idSet = new Set(selectedIds);
  useDocStore.getState().commit((d) => {
    for (const seatId of Object.keys(d.seatAssignments)) {
      if (idSet.has(tableIdOfSeat(seatId))) delete d.seatAssignments[seatId];
    }
    for (const id of selectedIds) delete d.objects[id];
    d.objectOrder = d.objectOrder.filter((oid) => !idSet.has(oid));
  }, 'delete');
  clearSelection();
}

/**
 * Window-level shortcuts for selection and object manipulation: arrow nudge
 * (`Shift` for the large step), `Cmd/Ctrl+D` duplicate, `Delete`/
 * `Backspace` remove, `Cmd/Ctrl+A` select all, `Escape` clear selection
 * (and close the context menu, if open), `G` toggle grid snap, `T` place a
 * new round table at the viewport centre, `Cmd/Ctrl+E` the export toast
 * (Task 15 owns the real feature; this just backs the top bar's visible
 * `⌘E` hint so it isn't a lie), and `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z`
 * undo/redo. Every branch bails via the same `isEditableTarget` guard
 * `useViewportKeyboard` already defines, so this never duplicates that
 * check.
 *
 * Takes the same `Viewport` instance `Editor.tsx` already holds (never a
 * second `useViewport()` call — see that file's header comment) so `T` can
 * place at the current viewport centre. `viewport` is a fresh object every
 * render (`useViewport` doesn't memoise its return value), so it's mirrored
 * into a ref — written in its own effect, never during render — rather than
 * the main effect's own dependency array: depending on it directly there
 * would tear down and re-add this window listener on every render of
 * `Editor`, not just when a shortcut actually needs to fire.
 */
export function useKeyboard(viewport: Viewport): void {
  const viewportRef = useRef(viewport);
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditableTarget(document.activeElement)) return;
      const mod = e.metaKey || e.ctrlKey;

      if (e.key === 'Escape') {
        useViewStore.getState().clearSelection();
        useViewStore.getState().closeContextMenu();
        return;
      }

      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useDocStore.getState().undo();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        useDocStore.getState().redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        useViewStore.getState().select(useDocStore.getState().objectOrder.slice());
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        // Real export is Task 15. This backs the top bar's visible `⌘E`
        // hint with a real (if minimal) response rather than leaving a
        // documented shortcut silently do nothing. Reads the dictionary
        // directly, not `useT()` — this handler is imperative code outside
        // a render, the same reason `duplicateSelection`/`deleteSelection`
        // below read stores via `getState()` rather than a subscription.
        const { language, showToast } = useUiStore.getState();
        showToast(DICTIONARIES[language].exportComingSoon);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (!mod && e.key.toLowerCase() === 'g') {
        useViewStore.getState().toggleGridSnap();
        return;
      }
      if (!mod && e.key.toLowerCase() === 't') {
        e.preventDefault();
        placeObject('roundTable', viewportCentreCm(viewportRef.current));
        return;
      }

      const amount = e.shiftKey ? NUDGE_LARGE : NUDGE;
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); nudgeSelection(0, -amount); break;
        case 'ArrowDown':  e.preventDefault(); nudgeSelection(0, amount); break;
        case 'ArrowLeft':  e.preventDefault(); nudgeSelection(-amount, 0); break;
        case 'ArrowRight': e.preventDefault(); nudgeSelection(amount, 0); break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
