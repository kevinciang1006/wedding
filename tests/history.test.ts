import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyDoc, getDoc, useDocStore } from '@/stores/docStore';
import { createObject } from '@/lib/doc/factory';
import type { Doc } from '@/lib/types/doc';

/** `getDoc()` returns a correctly typed Doc, so no cast is needed here. */
function snapshot(): Doc {
  return structuredClone(getDoc());
}

beforeEach(() => {
  useDocStore.getState().replaceDoc(createEmptyDoc());
});

describe('undo / redo round-trip', () => {
  it('returns to the initial document after 20 undos and to the final one after 20 redos', () => {
    const initial = snapshot();
    const store = useDocStore.getState();

    for (let i = 0; i < 20; i += 1) {
      if (i % 4 === 0) {
        store.commit((d) => {
          const obj = createObject('roundTable', { x: i * 50, y: i * 30 }, d.objectOrder.length);
          d.objects[obj.id] = obj;
          d.objectOrder.push(obj.id);
        }, 'add table');
      } else if (i % 4 === 1) {
        store.commit((d) => {
          const id = d.objectOrder[d.objectOrder.length - 1];
          const obj = d.objects[id];
          if (obj) { obj.x += 25; obj.y -= 25; }
        }, 'move');
      } else if (i % 4 === 2) {
        store.commit((d) => {
          const guest = { id: `g${i}`, name: `Guest ${i}`, group: 'Family', dietary: null, rsvp: 'yes' as const, plusOneOf: null };
          d.guests[guest.id] = guest;
          d.guestOrder.push(guest.id);
        }, 'add guest');
      } else {
        store.commit((d) => {
          const tableId = d.objectOrder[0];
          const guestId = d.guestOrder[d.guestOrder.length - 1];
          if (tableId && guestId) d.seatAssignments[`${tableId}:0`] = guestId;
        }, 'assign');
      }
    }

    const final = snapshot();
    expect(final).not.toEqual(initial);

    for (let i = 0; i < 20; i += 1) useDocStore.getState().undo();
    expect(snapshot()).toEqual(initial);

    for (let i = 0; i < 20; i += 1) useDocStore.getState().redo();
    expect(snapshot()).toEqual(final);
  });

  it('clears the redo stack once a new commit lands', () => {
    // Values must differ from createEmptyDoc()'s 2200x1400 defaults: assigning
    // an identical value produces no Immer patches, commit's no-op guard then
    // skips the history entry, and there would be nothing to redo.
    const store = useDocStore.getState();
    store.commit((d) => { d.room.width = 2500; }, 'room');
    store.undo();
    expect(useDocStore.getState().canRedo).toBe(true);
    useDocStore.getState().commit((d) => { d.room.height = 1600; }, 'room');
    expect(useDocStore.getState().canRedo).toBe(false);
  });

  it('does not push a history entry for a recipe that changes nothing', () => {
    const store = useDocStore.getState();
    store.commit((d) => { d.room.width = 2500; }, 'room');
    const before = useDocStore.getState().undoLabel;
    useDocStore.getState().commit((d) => { d.room.width = 2500; }, 'no-op');
    expect(useDocStore.getState().undoLabel).toBe(before);
  });

  it('reports nothing to undo on a fresh document', () => {
    expect(useDocStore.getState().canUndo).toBe(false);
    expect(useDocStore.getState().undoLabel).toBeNull();
  });

  it('caps history at 100 entries', () => {
    for (let i = 0; i < 150; i += 1) {
      useDocStore.getState().commit((d) => { d.room.width = 1000 + i; }, `w${i}`);
    }
    for (let i = 0; i < 100; i += 1) useDocStore.getState().undo();
    expect(useDocStore.getState().canUndo).toBe(false);
    // The 50 dropped entries are gone, so width cannot be back at the original.
    expect(useDocStore.getState().room.width).toBe(1049);
  });

  it('labels the pending undo', () => {
    useDocStore.getState().commit((d) => { d.title = 'Marín · Okonkwo'; }, 'rename plan');
    expect(useDocStore.getState().undoLabel).toBe('rename plan');
  });
});
