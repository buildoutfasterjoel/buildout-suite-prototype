import { create } from "zustand";
import type { Property, UnderwritingResult } from "#/data/types";
import type { BovSpecT } from "#/ai/generate/schemas";
import { generateBov } from "#/ai/generate";
import { computeOccupancyMismatch, bovValueRange, type OccupancyMismatch } from "#/components/deals/underwriting/occupancyMismatch";

export interface BovDraft {
  dealId: string;
  valueLow: number;
  valueHigh: number;
  mismatch: OccupancyMismatch;
  spec: BovSpecT;
}

interface BovDraftState {
  armedDealId: string | null;
  draft: BovDraft | null;
  armFor: (dealId: string) => void;
  setDraft: (d: BovDraft) => void;
  clear: () => void;
}

export const useBovDraft = create<BovDraftState>((set) => ({
  armedDealId: null,
  draft: null,
  armFor: (armedDealId) => set({ armedDealId }),
  setDraft: (draft) => set({ draft }),
  clear: () => set({ armedDealId: null, draft: null }),
}));

const money = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;

function metricValue(result: UnderwritingResult, key: string): number {
  return result.metrics.find((m) => m.key === key)?.value ?? 0;
}

/** Compute the mismatch + grounded range, then generate the BOV narrative. Deterministic
 * except the narrative, which falls back key-less. */
export async function buildBovDraft(
  dealId: string,
  property: Property,
  result: UnderwritingResult,
): Promise<BovDraft> {
  const mismatch = computeOccupancyMismatch(property);
  const { low, high } = bovValueRange(result, mismatch);
  let spec: BovSpecT;
  try {
    spec = await generateBov({
      data: {
        property: { name: property.name, address: result.inputs.address },
        valueLow: low,
        valueHigh: high,
        askingPrice: result.inputs.askingPrice,
        noi: metricValue(result, "netOperatingIncome"),
        capRate: metricValue(result, "goingInCapRate"),
        mismatch: { isMismatch: mismatch.isMismatch, stated: mismatch.stated, actual: mismatch.actual },
      },
    });
  } catch {
    spec = {
      headline: `Positioned at ${money(low)}–${money(high)}.`,
      rationale: "Range grounded in trailing NOI capitalized at market.",
      occupancyNote: mismatch.isMismatch
        ? `Marketing shows ${mismatch.stated}% occupancy; the T-12 reflects ${mismatch.actual}%.`
        : "",
    };
  }
  return { dealId, valueLow: low, valueHigh: high, mismatch, spec };
}

/** Otto's one-line spoken summary on the BOV draft (one-way). */
export function bovSummaryText(draft: BovDraft): string {
  const range = `${money(draft.valueLow)} to ${money(draft.valueHigh)}`;
  const flag = draft.mismatch.isMismatch
    ? ` Heads up — the T-12 shows ${draft.mismatch.actual}% occupancy versus ${draft.mismatch.stated}% stated, so I priced on the lower in-place occupancy.`
    : "";
  return `I've priced Palmetto Court at ${range} and drafted the BOV.${flag} Want me to send it?`;
}
