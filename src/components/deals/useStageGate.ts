import { create } from "zustand";
import type { PropertyStatus } from "#/data/types";
import { getListing } from "#/data/store";
import { commitStageTransition } from "#/data/actions";
import {
  resolveGate,
  seedGateForm,
  unsatisfiedRequired,
  buildTransitionInput,
} from "#/data/stageGates";
import { gateContext } from "#/data/dealShape";

/**
 * App-wide open/close state for the stage-gate modal. Both entry points (the
 * Deals board and the deal detail header) route through `requestStageChange`,
 * which opens this gate for sell-side deals; the single GlobalStageGateModal
 * renders it. Mirrors `useOmniSearch` / `useCreateDeal`.
 */
/**
 * `transition` moves the deal to a new stage (normal gate); `complete` captures
 * the Approve & Publish info for a deal created directly in a live stage,
 * publishing it in place without changing the stage.
 */
type GateMode = "transition" | "complete";

interface StageGateState {
  open: boolean;
  dealId: string | null;
  targetStage: PropertyStatus | null;
  mode: GateMode;
  /**
   * The deal a broker bailed out of publishing to go edit. Survives `close()`
   * so the marketing editor can offer a way back into the preview.
   */
  pendingPublishDealId: string | null;
  openGate: (
    dealId: string,
    targetStage: PropertyStatus,
    mode?: GateMode,
  ) => void;
  setPendingPublish: (dealId: string) => void;
  clearPendingPublish: () => void;
  close: () => void;
}

export const useStageGate = create<StageGateState>((set) => ({
  open: false,
  dealId: null,
  targetStage: null,
  mode: "transition",
  pendingPublishDealId: null,
  openGate: (dealId, targetStage, mode = "transition") =>
    set({ open: true, dealId, targetStage, mode }),
  setPendingPublish: (dealId) => set({ pendingPublishDealId: dealId }),
  clearPendingPublish: () => set({ pendingPublishDealId: null }),
  // `pendingPublishDealId` intentionally survives close — the editor banner
  // depends on it after the modal is dismissed.
  close: () =>
    set({ open: false, dealId: null, targetStage: null, mode: "transition" }),
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
  const actor = deal.internalBrokers[0]?.name ?? "You";

  // A buy-side deal is not a listing — it moves stages directly, no gate.
  if (deal.dealSide === "buyer") {
    commitStageTransition({ dealId, targetStage, actor });
    return;
  }

  const ctx = gateContext(deal);
  const config = resolveGate(deal.status, targetStage, deal.dealType, ctx.shape);

  // Pure backward confirm (not leaving Active) — nothing to decide, swap directly.
  if (config.kind === "confirm" && !config.leavesActive) {
    commitStageTransition({ dealId, targetStage, actor });
    return;
  }

  // A publishing transition ALWAYS opens the gate, gaps or not: the preview of
  // the listing about to go live is the point, not a fallback for missing data.
  // Non-publishing forward gates keep the zero-click swap.
  if (config.kind === "field" && !config.publishes) {
    const form = seedGateForm(deal, { shellActive: ctx.shellActive });
    if (unsatisfiedRequired(config, form).length === 0) {
      commitStageTransition(
        buildTransitionInput(config, form, deal.id, actor, deal.dealType),
      );
      return;
    }
  }

  // Otherwise surface the gate: forward gaps, the dead gate, or backward-out-of-Active.
  useStageGate.getState().openGate(dealId, targetStage);
}

/**
 * Open the Approve & Publish gate to finish setup on a deal that was created
 * directly in a live stage (Active/Under Contract) and never published. Always
 * opens the preview — publishing never skips the gate, gaps or not.
 */
export function requestSetupCompletion(dealId: string): void {
  const deal = getListing(dealId);
  if (!deal) return;
  useStageGate.getState().openGate(dealId, deal.status, "complete");
}
