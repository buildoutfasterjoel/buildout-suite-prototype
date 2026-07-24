import { create } from "zustand";

/**
 * A transient cross-panel signal: which deal card in the contact overview
 * column should be visually spotlit (e.g. the deal the AI flow just created).
 * The overview column consumes it — expands the Deals section, plays the
 * highlight animation on that card, then clears it after a beat.
 */
interface DealSpotlight {
  dealId: string | null;
  spotlight: (dealId: string) => void;
  clear: () => void;
}

export const useDealSpotlight = create<DealSpotlight>((set) => ({
  dealId: null,
  spotlight: (dealId) => set({ dealId }),
  clear: () => set({ dealId: null }),
}));
