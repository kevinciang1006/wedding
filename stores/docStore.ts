import { applyPatches, enablePatches, produceWithPatches } from 'immer';
import { create } from 'zustand';
import { AUTOSAVE_MS, LS_KEY } from '@/lib/constants';
import { PatchStack } from '@/lib/history/patchStack';
import { assignSeat, unseatGuest } from '@/lib/doc/assignments';
import { getSeats } from '@/lib/geometry/seats';
import type { Doc } from '@/lib/types/doc';

enablePatches();

export function createEmptyDoc(): Doc {
  return {
    version: 1,
    title: '',
    eventDate: null,
    room: { width: 2200, height: 1400 },
    units: 'm',
    objects: {},
    objectOrder: [],
    guests: {},
    guestOrder: [],
    seatAssignments: {},
  };
}

interface DocActions {
  commit: (recipe: (draft: Doc) => void, label: string) => void;
  // No label: loading a document clears history rather than adding to it,
  // so there is nothing for a label to name.
  replaceDoc: (doc: Doc) => void;
  undo: () => void;
  redo: () => void;
  seatGuest: (seatId: string, guestId: string) => void;
  unseat: (guestId: string) => void;
  seatGroupAt: (tableId: string, group: string) => void;
  seatAllRemaining: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  // When the debounced autosave last actually wrote to localStorage — read
  // by the top bar's "saved {time}" text. `null` until the first write.
  lastSavedAt: number | null;
}

export type DocState = Doc & DocActions;

const history = new PatchStack();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(doc: Doc): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.localStorage.setItem(LS_KEY, JSON.stringify(doc));
    // Referencing useDocStore here (defined further down this module) is
    // safe: this callback only ever runs once the timer fires, long after
    // module evaluation has finished and the const is initialized.
    useDocStore.setState({ lastSavedAt: Date.now() });
  }, AUTOSAVE_MS);
}

function docOf(state: DocState): Doc {
  return {
    version: state.version, title: state.title, eventDate: state.eventDate,
    room: state.room, units: state.units,
    objects: state.objects, objectOrder: state.objectOrder,
    guests: state.guests, guestOrder: state.guestOrder,
    seatAssignments: state.seatAssignments,
  };
}

/**
 * The current document as a plain `Doc`, with the action functions stripped.
 * Exported so tests and IO code get a typed document without an `as` cast.
 */
export function getDoc(): Doc {
  return docOf(useDocStore.getState());
}

function flags() {
  return {
    canUndo: history.canUndo, canRedo: history.canRedo,
    undoLabel: history.undoLabel, redoLabel: history.redoLabel,
  };
}

export const useDocStore = create<DocState>((set, get) => ({
  ...createEmptyDoc(),
  canUndo: false, canRedo: false, undoLabel: null, redoLabel: null, lastSavedAt: null,

  commit: (recipe, label) => {
    const [next, patches, inversePatches] = produceWithPatches(docOf(get()), recipe);
    if (patches.length === 0) return;
    history.push({ patches, inversePatches, label });
    set({ ...next, ...flags() });
    scheduleSave(next);
  },

  replaceDoc: (doc) => {
    history.clear();
    set({ ...doc, ...flags() });
    scheduleSave(doc);
  },

  undo: () => {
    const entry = history.undo();
    if (!entry) return;
    const next = applyPatches(docOf(get()), entry.inversePatches);
    set({ ...next, ...flags() });
    scheduleSave(next);
  },

  redo: () => {
    const entry = history.redo();
    if (!entry) return;
    const next = applyPatches(docOf(get()), entry.patches);
    set({ ...next, ...flags() });
    scheduleSave(next);
  },

  seatGuest: (seatId, guestId) => {
    get().commit((d) => { d.seatAssignments = assignSeat(d.seatAssignments, seatId, guestId); }, 'seat guest');
  },

  unseat: (guestId) => {
    get().commit((d) => { d.seatAssignments = unseatGuest(d.seatAssignments, guestId); }, 'unseat guest');
  },

  seatGroupAt: (tableId, group) => {
    get().commit((d) => {
      const table = d.objects[tableId];
      if (!table) return;
      const seats = getSeats(table);
      const taken = new Set(Object.keys(d.seatAssignments));
      const seatedGuests = new Set(Object.values(d.seatAssignments));
      const pool = d.guestOrder.filter((id) => {
        const g = d.guests[id];
        return g && g.group === group && g.rsvp !== 'no' && !seatedGuests.has(id);
      });
      for (const seat of seats) {
        if (pool.length === 0) break;
        if (taken.has(seat.id)) continue;
        const next = pool.shift();
        if (next) d.seatAssignments[seat.id] = next;
      }
    }, 'seat group');
  },

  // The guest panel footer's "Seat remaining" button — every currently
  // unseated, non-declined guest (`guestOrder` order) dropped into the next
  // free seat, walking tables in `objectOrder` and seats within a table in
  // index order. Same shape as `seatGroupAt` above (a pool of eligible
  // guests consumed as free seats are found) but unscoped to one table or
  // group: this is the "just fill the room" bulk action, not the
  // right-click menu's "seat this one group here." One `commit` — filling
  // dozens of seats is one history entry, not one per guest.
  seatAllRemaining: () => {
    get().commit((d) => {
      const taken = new Set(Object.keys(d.seatAssignments));
      const seatedGuests = new Set(Object.values(d.seatAssignments));
      const pool = d.guestOrder.filter((id) => {
        const g = d.guests[id];
        return g && g.rsvp !== 'no' && !seatedGuests.has(id);
      });
      for (const tableId of d.objectOrder) {
        if (pool.length === 0) break;
        const table = d.objects[tableId];
        if (!table) continue;
        for (const seat of getSeats(table)) {
          if (pool.length === 0) break;
          if (taken.has(seat.id)) continue;
          const next = pool.shift();
          if (next) { d.seatAssignments[seat.id] = next; taken.add(seat.id); }
        }
      }
    }, 'seat remaining');
  },
}));

export function loadSavedDoc(): Doc | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDoc(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

/**
 * Guards imported and restored documents. Uses `in` narrowing rather than a cast
 * to Record<string, unknown>: the constraint against `as` exists precisely so a
 * validator cannot quietly assert the shape it is supposed to be checking.
 */
export function isDoc(value: unknown): value is Doc {
  return isObject(value)
    && 'version' in value && value.version === 1
    && 'title' in value && typeof value.title === 'string'
    && 'eventDate' in value && (value.eventDate === null || typeof value.eventDate === 'string')
    && 'units' in value && (value.units === 'm' || value.units === 'ft')
    && 'room' in value && isObject(value.room)
    && 'objects' in value && isObject(value.objects)
    && 'objectOrder' in value && Array.isArray(value.objectOrder)
    && 'guests' in value && isObject(value.guests)
    && 'guestOrder' in value && Array.isArray(value.guestOrder)
    && 'seatAssignments' in value && isObject(value.seatAssignments);
}
