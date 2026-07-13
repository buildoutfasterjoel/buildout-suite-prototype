import { create } from "zustand";

/**
 * Shared open/close state for the omni-search command center, so the navbar
 * trigger, the global keyboard shortcut, and the overlay stay in sync without
 * prop-drilling. Mirrors the pattern used by `useAssistant`.
 */
interface OmniSearchState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useOmniSearch = create<OmniSearchState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
