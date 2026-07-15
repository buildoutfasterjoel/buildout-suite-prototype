import { create } from "zustand";
import type { PropertyStatus } from "#/data/types";
import { getListing } from "#/data/store";
import { commitStageTransition } from "#/data/actions";

/**
 * App-wide open/close state for the stage-gate modal. Both entry points (the
 * Deals board and the deal detail header) route through `requestStageChange`,
 * which opens this gate for sell-side deals; the single GlobalStageGateModal
 * renders it. Mirrors `useOmniSearch` / `useCreateDeal`.
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

/**
 * The single entry point both stage-change surfaces call. The gated listing
 * lifecycle is a **sell-side** concept: publishing, review attestations, and
 * the stage gates only apply when the broker represents the seller. A buy-side
 * deal is not a listing, so it moves stages directly with no gate.
 */
export function requestStageChange(
  dealId: string,
  targetStage: PropertyStatus,
): void {
  const deal = getListing(dealId);
  if (!deal || deal.status === targetStage) return;
  if (deal.dealSide === "buyer") {
    commitStageTransition({
      dealId,
      targetStage,
      actor: deal.internalBrokers[0]?.name ?? "You",
    });
    return;
  }
  useStageGate.getState().openGate(dealId, targetStage);
}
