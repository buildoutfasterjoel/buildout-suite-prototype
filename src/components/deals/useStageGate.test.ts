import { describe, expect, it, beforeEach } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { useStageGate, requestStageChange } from "./useStageGate";
import type { DealSide, Listing } from "#/data/types";

function findDeal(side: DealSide) {
  const deal = [...useDataStore.getState().listings.values()].find(
    (l) => l.dealSide === side,
  );
  if (!deal) throw new Error(`no seeded ${side}-side deal`);
  return deal;
}

/** Put a mutated copy of a deal into the store so a test controls its exact state. */
function putDeal(deal: Listing) {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings);
    listings.set(deal.id, deal);
    return { listings } as never;
  });
}

/** A deterministic sell-side Sale deal parked in Under Contract. */
function sellSideUnderContract(closeDate: string | null): Listing {
  const base = [...useDataStore.getState().listings.values()][0];
  const deal: Listing = {
    ...base,
    dealSide: "seller",
    dealType: "Sale",
    status: "under-contract",
    transaction: { ...base.transaction, closeDate },
  };
  putDeal(deal);
  return deal;
}

describe("requestStageChange", () => {
  beforeEach(() => useStageGate.getState().close());

  it("opens the gate when a forward move has a missing required field", () => {
    // Under Contract → Closed requires closeDate; leave it blank to force a gap.
    const deal = sellSideUnderContract(null);
    requestStageChange(deal.id, "closed");

    const gate = useStageGate.getState();
    expect(gate.open).toBe(true);
    expect(gate.dealId).toBe(deal.id);
    expect(gate.targetStage).toBe("closed");
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe(
      "under-contract",
    );
  });

  it("commits a forward move with no gaps without opening the gate", () => {
    const deal = sellSideUnderContract("2026-08-01");
    requestStageChange(deal.id, "closed");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("closed");
  });

  it("swaps a pure backward move directly, no gate", () => {
    const deal = sellSideUnderContract(null);
    requestStageChange(deal.id, "active");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("active");
  });

  it("keeps the gate for a backward move OUT of Active (unpublish choice)", () => {
    const base = [...useDataStore.getState().listings.values()][0];
    const deal: Listing = {
      ...base,
      dealSide: "seller",
      dealType: "Sale",
      status: "active",
    };
    putDeal(deal);
    requestStageChange(deal.id, "proposal");

    expect(useStageGate.getState().open).toBe(true);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("active");
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
