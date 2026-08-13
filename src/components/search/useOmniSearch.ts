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
  /**
   * Set when the overlay was opened by the navbar's mic rather than by typing,
   * so the overlay starts listening as it mounts. The overlay consumes and
   * clears it, so re-opening by other means doesn't inherit a hot mic.
   */
  autoVoice: boolean;
  /** Open the overlay with the mic already armed (the navbar mic button). */
  openWithVoice: () => void;
  /** Read and clear the arm flag. */
  consumeAutoVoice: () => boolean;
}

export const useOmniSearch = create<OmniSearchState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
  autoVoice: false,
  openWithVoice: () => set({ open: true, autoVoice: true }),
  consumeAutoVoice: () => {
    if (!get().autoVoice) return false;
    set({ autoVoice: false });
    return true;
  },
}));
