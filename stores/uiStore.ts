import { create } from 'zustand';
import type { Rsvp } from '@/lib/types/doc';

interface Filter {
  unseatedOnly: boolean;
  group: string | null;
  rsvp: Rsvp | null;
  query: string;
}

export interface Toast {
  message: string;
  detail: string | null;
}

interface UiState {
  language: 'en' | 'es';
  guestPanelOpen: boolean;
  paletteOpen: boolean;
  filter: Filter;
  collapsedGroups: string[];
  dialog: 'csv' | 'room' | null;
  toast: Toast | null;
}

interface UiActions {
  setLanguage: (language: 'en' | 'es') => void;
  setFilter: (filter: Partial<Filter>) => void;
  toggleGroup: (group: string) => void;
  openDialog: (dialog: 'csv' | 'room') => void;
  closeDialog: () => void;
  showToast: (message: string, detail?: string | null) => void;
  dismissToast: () => void;
}

export type UiStoreState = UiState & UiActions;

const initialFilter: Filter = { unseatedOnly: false, group: null, rsvp: null, query: '' };

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

  setLanguage: (language) => set({ language }),
  setFilter: (filter) => set((s) => ({ filter: { ...s.filter, ...filter } })),
  toggleGroup: (group) => set((s) => ({
    collapsedGroups: s.collapsedGroups.includes(group)
      ? s.collapsedGroups.filter((g) => g !== group)
      : [...s.collapsedGroups, group],
  })),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  showToast: (message, detail = null) => set({ toast: { message, detail } }),
  dismissToast: () => set({ toast: null }),
}));
