import { create } from "zustand";
import type { PropertyStatus } from "#/data/types";

/**
 * App-wide open/close state for the stage-gate modal. Both entry points (the
 * Deals board and the deal detail header) call `openGate`; the single
 * GlobalStageGateModal renders it. Mirrors `useOmniSearch` / `useCreateDeal`.
 */
interface StageGateState {
  open: boolean;
  dealId: string | null;
  targetStage: PropertyStatus | null;
  openGate: (dealId: string, targetStage: PropertyStatus) => void;
  close: () => void;
}

export const useStageGate = create<StageGateState>((set) => ({
  open: false,
  dealId: null,
  targetStage: null,
  openGate: (dealId, targetStage) => set({ open: true, dealId, targetStage }),
  close: () => set({ open: false, dealId: null, targetStage: null }),
}));
