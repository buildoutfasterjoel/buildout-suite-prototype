import { describe, expect, it, beforeEach, vi } from "vitest";
import { useDataStore } from "#/data/dataStore";
import {
  useStageGate,
  requestStageChange,
  requestSetupCompletion,
} from "./useStageGate";
import type { DealSide, Listing } from "#/data/types";
import * as stageGates from "#/data/stageGates";
import { seedGateForm } from "#/data/stageGates";
import { gateContext } from "#/data/dealShape";
import { createProposalListing, emptyDraft } from "#/data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "#/data/leaseSpaces";
import { commitStageTransition } from "#/data/actions";

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

/**
 * A sell-side Sale deal parked in a live stage (Active) that already satisfies
 * every Approve & Publish requirement — content, dates, no AI docs to review.
 */
function fullyPublishableActive(): Listing {
  const base = [...useDataStore.getState().listings.values()][0];
  const deal: Listing = {
    ...base,
    dealSide: "seller",
    dealType: "Sale",
    status: "active",
    publishedAt: null,
    documents: (base.documents ?? []).filter((d) => !d.aiGenerated),
    marketing: {
      ...base.marketing,
      saleTitle: "Prime Retail Pad",
      saleDescription: "Corner lot with drive-thru",
    },
    financials: { ...base.financials, askingPrice: 1_950_000 },
    transaction: {
      ...base.transaction,
      listedOnDate: "2026-07-01",
      listingExpirationDate: "2026-12-31",
    },
  };
  putDeal(deal);
  return deal;
}

describe("requestSetupCompletion", () => {
  beforeEach(() => useStageGate.getState().close());

  it("opens the preview even when the deal is fully populated", () => {
    // Publishing always gets a review moment — this is the behavior change from
    // the 2026-07-28 publish-preview spec, reversing the earlier zero-click swap.
    const deal = fullyPublishableActive();
    requestSetupCompletion(deal.id);

    const gate = useStageGate.getState();
    expect(gate.open).toBe(true);
    expect(gate.mode).toBe("complete");
    // Nothing is published until the broker approves in the preview.
    expect(useDataStore.getState().listings.get(deal.id)?.publishedAt).toBeNull();
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("active");
  });

  it("opens the Approve & Publish gate when a publish requirement is missing", () => {
    const deal = fullyPublishableActive();
    putDeal({
      ...deal,
      transaction: {
        ...deal.transaction,
        listedOnDate: null,
        listingExpirationDate: null,
      },
    });
    requestSetupCompletion(deal.id);

    const gate = useStageGate.getState();
    expect(gate.open).toBe(true);
    expect(gate.mode).toBe("complete");
    expect(useDataStore.getState().listings.get(deal.id)?.publishedAt).toBeNull();
  });
});

/** A sell-side Sale deal in Pitching that satisfies every publish requirement. */
function fullyPublishableProposal(): Listing {
  const base = [...useDataStore.getState().listings.values()][0];
  const deal: Listing = {
    ...base,
    dealSide: "seller",
    dealType: "Sale",
    status: "proposal",
    publishedAt: null,
    documents: (base.documents ?? []).filter((d) => !d.aiGenerated),
    marketing: {
      ...base.marketing,
      saleTitle: "Prime Retail Pad",
      saleDescription: "Corner lot with drive-thru",
    },
    financials: { ...base.financials, askingPrice: 1_950_000 },
    transaction: {
      ...base.transaction,
      listedOnDate: "2026-07-01",
      listingExpirationDate: "2026-12-31",
    },
  };
  putDeal(deal);
  return deal;
}

describe("publish transitions always open the preview", () => {
  beforeEach(() => useStageGate.getState().close());

  it("opens the gate for Pitching -> Active even with no gaps", () => {
    const deal = fullyPublishableProposal();
    requestStageChange(deal.id, "active");

    expect(useStageGate.getState().open).toBe(true);
    expect(useStageGate.getState().targetStage).toBe("active");
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("proposal");
  });

  it("still commits a buy-side move to Active with no gate", () => {
    const base = [...useDataStore.getState().listings.values()][0];
    putDeal({ ...base, dealSide: "buyer", status: "proposal" } as Listing);
    requestStageChange(base.id, "active");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(base.id)?.status).toBe("active");
  });

  it("still commits a non-publishing forward move with no gaps", () => {
    const deal = sellSideUnderContract("2026-08-01");
    requestStageChange(deal.id, "closed");

    expect(useStageGate.getState().open).toBe(false);
    expect(useDataStore.getState().listings.get(deal.id)?.status).toBe("closed");
  });
});

describe("pendingPublishDealId", () => {
  beforeEach(() => useStageGate.getState().close());

  it("starts null", () => {
    expect(useStageGate.getState().pendingPublishDealId).toBeNull();
  });

  it("records the deal the broker bailed out of", () => {
    useStageGate.getState().setPendingPublish("deal-9");
    expect(useStageGate.getState().pendingPublishDealId).toBe("deal-9");
  });

  it("clears on demand", () => {
    useStageGate.getState().setPendingPublish("deal-9");
    useStageGate.getState().clearPendingPublish();
    expect(useStageGate.getState().pendingPublishDealId).toBeNull();
  });

  it("survives close() so the editor banner still shows", () => {
    useStageGate.getState().setPendingPublish("deal-9");
    useStageGate.getState().close();
    expect(useStageGate.getState().pendingPublishDealId).toBe("deal-9");
  });
});

/** A genuine space deal, built through the real lease-space flow (not a mutated stub). */
function makeSpaceDeal() {
  const parent = createProposalListing({
    ...emptyDraft(),
    name: "Mall Assignment",
    dealType: "Lease",
  });
  const unit = addPropertyUnit(parent.propertyId, {
    label: "Suite 100",
    sqft: 2400,
    unitType: "retail",
  })!;
  const child = addSpaceToDeal(parent.id, unit.id)!.deal;
  return { parent, child };
}

describe("requestStageChange wiring for a space deal", () => {
  beforeEach(() => useStageGate.getState().close());

  it("resolves the SPACE publish gate, not the flat-lease gate", () => {
    const { child } = makeSpaceDeal();
    const resolveGateSpy = vi.spyOn(stageGates, "resolveGate");

    requestStageChange(child.id, "active");

    // requestStageChange always opens the publish gate for a forward move into
    // Active — but WHICH gate it resolved is only visible through this spy.
    const config = resolveGateSpy.mock.results.at(-1)?.value as {
      required: string[];
    };
    expect(config.required).toContain("shellActive");
    expect(config.required).not.toContain("saleTitle");
    expect(useStageGate.getState().open).toBe(true);

    resolveGateSpy.mockRestore();
  });
});

describe("seedGateForm wiring for a space deal", () => {
  it("seeds shellActive from the parent's live status via gateContext, not a stale default", () => {
    const { parent, child } = makeSpaceDeal();

    const formBefore = seedGateForm(child, {
      shellActive: gateContext(child).shellActive,
    });
    expect(formBefore.shellActive).toBe(false);

    commitStageTransition({ dealId: parent.id, targetStage: "active", actor: "T" });

    const formAfter = seedGateForm(child, {
      shellActive: gateContext(child).shellActive,
    });
    expect(formAfter.shellActive).toBe(true);
  });
});
