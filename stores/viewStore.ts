import { create } from 'zustand';
import type { Guide } from '@/lib/geometry/snap';
import type { ObjectType } from '@/lib/types/doc';

interface ViewState {
  // Konva stage transform.
  scale: number;
  x: number;
  y: number;

  selectedIds: string[];
  tool: ObjectType | null;
  gridVisible: boolean;
  gridSnap: boolean;
  // Whether Space is currently held, mirrored from useViewport's own
  // isSpaceHeldRef so useObjectDrag's onDragStart (a getState() read, not a
  // subscription — object nodes stay memo'd on narrow selectors and must not
  // re-render on every space press) can tell a space+left-drag apart from a
  // plain object drag.
  spaceHeld: boolean;
  guides: Guide[];
  marquee: { x: number; y: number; width: number; height: number } | null;
  dragDistance: { from: { x: number; y: number }; to: { x: number; y: number }; cm: number } | null;
  // One rect per dragged object, in room cm, while an Option/Alt-drag is in
  // progress — the only visible sign the modifier registered, now that the
  // actual duplicate is no longer inserted (and thus rendered as a real
  // object) until `dragEnd`. `null` outside an alt-drag, same convention as
  // `marquee`/`dragDistance` above.
  duplicateGhosts: { x: number; y: number; width: number; height: number }[] | null;
  hoveredSeatId: string | null;
  justSeatedSeatId: string | null;
  // Right-click menu: screen (client) coordinates to position the HTML
  // panel at, plus which object it targets. Screen, not room cm, because
  // the menu itself is plain HTML rendered as a sibling of the Konva
  // Stage, not a Konva node.
  contextMenu: { x: number; y: number; targetId: string } | null;
}

interface ViewActions {
  setView: (view: Partial<Pick<ViewState, 'scale' | 'x' | 'y'>>) => void;
  select: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  clearSelection: () => void;
  setTool: (tool: ObjectType | null) => void;
  setSpaceHeld: (held: boolean) => void;
  toggleGrid: () => void;
  toggleGridSnap: () => void;
  setGuides: (guides: Guide[]) => void;
  setMarquee: (marquee: ViewState['marquee']) => void;
  setDragDistance: (dragDistance: ViewState['dragDistance']) => void;
  setDuplicateGhosts: (ghosts: ViewState['duplicateGhosts']) => void;
  setHoveredSeat: (id: string | null) => void;
  setJustSeated: (id: string | null) => void;
  openContextMenu: (menu: NonNullable<ViewState['contextMenu']>) => void;
  closeContextMenu: () => void;
}

export type ViewStoreState = ViewState & ViewActions;

/**
 * Viewport, tool, and interaction-transient state — never persisted, never
 * pushed through docStore's history.
 *
 * Selection lives here rather than in docStore specifically so that
 * selecting an object is not undoable: docStore.commit() is the only path
 * that creates a history entry, and selectedIds never passes through it.
 * A `Cmd+Z` after clicking a table must undo the table's last edit, not
 * silently deselect it.
 */
export const useViewStore = create<ViewStoreState>((set) => ({
  scale: 1,
  x: 0,
  y: 0,
  selectedIds: [],
  tool: null,
  gridVisible: true,
  gridSnap: true,
  spaceHeld: false,
  guides: [],
  marquee: null,
  dragDistance: null,
  duplicateGhosts: null,
  hoveredSeatId: null,
  justSeatedSeatId: null,
  contextMenu: null,

  setView: (view) => set(view),
  select: (ids) => set({ selectedIds: ids }),
  addToSelection: (id) => set((s) => (
    s.selectedIds.includes(id) ? {} : { selectedIds: [...s.selectedIds, id] }
  )),
  clearSelection: () => set({ selectedIds: [] }),
  setTool: (tool) => set({ tool }),
  setSpaceHeld: (held) => set({ spaceHeld: held }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleGridSnap: () => set((s) => ({ gridSnap: !s.gridSnap })),
  setGuides: (guides) => set({ guides }),
  setMarquee: (marquee) => set({ marquee }),
  setDragDistance: (dragDistance) => set({ dragDistance }),
  setDuplicateGhosts: (duplicateGhosts) => set({ duplicateGhosts }),
  setHoveredSeat: (id) => set({ hoveredSeatId: id }),
  setJustSeated: (id) => set({ justSeatedSeatId: id }),
  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),
}));
