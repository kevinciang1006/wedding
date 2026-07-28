import { applyPatches, enablePatches, produceWithPatches } from 'immer';
import { create } from 'zustand';
import { AUTOSAVE_MS, LS_KEY } from '@/lib/constants';
import { PatchStack } from '@/lib/history/patchStack';
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
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

export type DocState = Doc & DocActions;

const history = new PatchStack();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(doc: Doc): void {
  if (typeof window === 'undefined') return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    window.localStorage.setItem(LS_KEY, JSON.stringify(doc));
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
  canUndo: false, canRedo: false, undoLabel: null, redoLabel: null,

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

export function isDoc(value: unknown): value is Doc {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === 1
    && typeof v.room === 'object' && v.room !== null
    && typeof v.objects === 'object' && v.objects !== null
    && Array.isArray(v.objectOrder)
    && typeof v.guests === 'object' && v.guests !== null
    && Array.isArray(v.guestOrder)
    && typeof v.seatAssignments === 'object' && v.seatAssignments !== null;
}
