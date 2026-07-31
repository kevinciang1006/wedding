import { create } from 'zustand';
import type { Rsvp } from '@/lib/types/doc';

interface Filter {
  unseatedOnly: boolean;
  // Task 13's "Dietary" chip — a fourth mutually-exclusive segment alongside
  // `unseatedOnly`/`group`, same shape as those two rather than a second,
  // independent boolean axis: the guest panel's chip row reads as one set of
  // radio-like options (All/Unseated/Dietary/Group), not a set of togglable
  // checkboxes that could combine arbitrarily.
  dietaryOnly: boolean;
  group: string | null;
  rsvp: Rsvp | null;
  query: string;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  message: string;
  detail: string | null;
  // The top bar's post-export "Show file" link — optional, so every other
  // toast (CSV import counts, the old keyboard-shortcut placeholder) can go
  // on calling `showToast` with just a message and stay unaffected.
  action: ToastAction | null;
}

interface UiState {
  language: 'en' | 'es';
  guestPanelOpen: boolean;
  paletteOpen: boolean;
  filter: Filter;
  collapsedGroups: string[];
  dialog: 'csv' | 'room' | null;
  toast: Toast | null;
  // The top bar's export dropdown (Export image/PDF/data, Import plan).
  // Chrome state, not `viewStore.contextMenu`'s x/y-positioned kind — this
  // one is always anchored under the same button, so a boolean is enough.
  exportMenuOpen: boolean;
}

interface UiActions {
  setLanguage: (language: 'en' | 'es') => void;
  setFilter: (filter: Partial<Filter>) => void;
  toggleGroup: (group: string) => void;
  openDialog: (dialog: 'csv' | 'room') => void;
  closeDialog: () => void;
  showToast: (message: string, detail?: string | null, action?: ToastAction | null) => void;
  dismissToast: () => void;
  toggleExportMenu: () => void;
  closeExportMenu: () => void;
}

export type UiStoreState = UiState & UiActions;

const initialFilter: Filter = { unseatedOnly: false, dietaryOnly: false, group: null, rsvp: null, query: '' };

// Chrome and interaction state — never persisted (only Doc is saved) and
// never pushed through docStore's history: toggling a panel or typing a
// guest search query is not a document edit.
export const useUiStore = create<UiStoreState>((set) => ({
  language: 'en',
  guestPanelOpen: true,
  paletteOpen: true,
  filter: initialFilter,
  collapsedGroups: [],
  dialog: null,
  toast: null,
  exportMenuOpen: false,

  setLanguage: (language) => set({ language }),
  setFilter: (filter) => set((s) => ({ filter: { ...s.filter, ...filter } })),
  toggleGroup: (group) => set((s) => ({
    collapsedGroups: s.collapsedGroups.includes(group)
      ? s.collapsedGroups.filter((g) => g !== group)
      : [...s.collapsedGroups, group],
  })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  showToast: (message, detail = null, action = null) => set({ toast: { message, detail, action } }),
  dismissToast: () => set({ toast: null }),
  toggleExportMenu: () => set((s) => ({ exportMenuOpen: !s.exportMenuOpen })),
  closeExportMenu: () => set({ exportMenuOpen: false }),
}));
