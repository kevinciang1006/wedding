'use client';

import { useEffect } from 'react';
import { useDocStore } from '@/stores/docStore';
import { useViewStore } from '@/stores/viewStore';
import { isEditableTarget } from '@/components/canvas/useViewportKeyboard';
import { duplicateObject } from '@/lib/doc/factory';
import { tableIdOfSeat } from '@/lib/doc/assignments';
import { DUPLICATE_OFFSET, NUDGE, NUDGE_LARGE } from '@/lib/constants';
import type { Cm } from '@/lib/types/doc';

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
 * (and close the context menu, if open), `G` toggle grid snap, and
 * `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` undo/redo. Every branch bails via the
 * same `isEditableTarget` guard `useViewportKeyboard` already defines, so
 * this never duplicates that check. Takes no arguments and is called once
 * from `Editor.tsx`, alongside `useViewport()` — unlike `useMarquee`, none
 * of this needs the Stage or container refs, so it doesn't need to be
 * composed inside `useViewport` itself.
 */
export function useKeyboard(): void {
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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (!mod && e.key.toLowerCase() === 'g') {
        useViewStore.getState().toggleGridSnap();
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
