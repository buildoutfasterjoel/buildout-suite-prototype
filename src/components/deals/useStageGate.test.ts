import { describe, expect, it, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { useStageGate, requestStageChange } from "./useStageGate";
import type { DealSide } from "#/data/types";

function findDeal(side: DealSide) {
  const deal = [...useDataStore.getState().listings.values()].find(
    (l) => l.dealSide === side,
  );
  if (!deal) throw new Error(`no seeded ${side}-side deal`);
  return deal;
}

describe("requestStageChange", () => {
  beforeEach(() => useStageGate.getState().close());

  it("opens the gate for a sell-side deal without committing", () => {
    const deal = findDeal("seller");
    const target = deal.status === "active" ? "under-contract" : "active";
    requestStageChange(deal.id, target);

    const gate = useStageGate.getState();
    expect(gate.open).toBe(true);
    expect(gate.dealId).toBe(deal.id);
    expect(gate.targetStage).toBe(target);
    // Sell-side must pass the gate first — status is unchanged until commit.
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe(
      deal.status,
    );
  });

  it("commits directly for a buy-side deal without opening the gate", () => {
    const deal = findDeal("buyer");
    const target = deal.status === "active" ? "under-contract" : "active";
    requestStageChange(deal.id, target);

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe(target);
  });

  it("is a no-op when the target equals the current stage", () => {
    const deal = findDeal("seller");
    requestStageChange(deal.id, deal.status);
    expect(useStageGate.getState().open).toBe(false);
  });
});
