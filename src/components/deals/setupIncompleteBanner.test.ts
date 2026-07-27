import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import { publishReadiness } from "#/data/stageGates";
import { requestStageChange } from "#/components/deals/useStageGate";
import { createDeal } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { createRosaProposalDeal } from "#/components/call/rosaDeal";

function hydrate() {
  const ds = generateDataset();
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never);
}

/** Mirrors SetupIncompleteBanner's own condition in overview.tsx. */
function bannerShows(dealId: string): boolean {
  const l = useDataStore.getState().listings.get(dealId)!;
  const needsSetup =
    l.dealSide === "seller" &&
    l.status !== "proposal" &&
    l.status !== "inactive" &&
    l.publishedAt === null;
  if (!needsSetup) return false;
  return publishReadiness(l).missing.length > 0;
}

function rosaAndBuilding() {
  const rosa = [...useDataStore.getState().contacts.values()].find(
    (c) => c.heroKey === "rosa",
  )!;
  const property = useDataStore
    .getState()
    .properties.get(rosa.ownedPropertyIds![0])!;
  return { rosa, property };
}

/** Fill the buyer + price + commission the Under Contract gate asks for. */
function readyForUnderContract(dealId: string, buyerId: string) {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings);
    const l = listings.get(dealId)!;
    listings.set(dealId, {
      ...l,
      buyerContactIds: [buyerId],
      transaction: {
        ...l.transaction,
        salePrice: 2_400_000,
        commissionAmount: 120_000,
      },
    });
    return { listings } as never;
  });
}

describe("Setup incomplete banner across a deal's stage moves", () => {
  beforeEach(hydrate);

  // Regression: Rosa's deal reached Under Contract through the buyer/price gate,
  // which doesn't publish, so publishedAt stayed null and the deal looked like
  // it had skipped Approve & Publish.
  it("stays hidden after a deal advances to Under Contract", () => {
    const { rosa, property } = rosaAndBuilding();
    const { deal } = createRosaProposalDeal(rosa, property);
    const buyer = [...useDataStore.getState().contacts.values()].find(
      (c) => c.id !== rosa.id,
    )!;

    expect(bannerShows(deal.id)).toBe(false); // proposal — never warns

    readyForUnderContract(deal.id, buyer.id);
    requestStageChange(deal.id, "under-contract");

    const moved = useDataStore.getState().listings.get(deal.id)!;
    expect(moved.status).toBe("under-contract");
    expect(moved.publishedAt).not.toBeNull();
    expect(bannerShows(deal.id)).toBe(false);
  });

  // The banner's actual purpose: a sell-side deal created straight into a live
  // stage never saw the publish gate, so it should still warn.
  it("still warns for a deal created directly into a live stage", () => {
    const { property } = rosaAndBuilding();
    const { deal } = createDeal({
      ...emptyDraft(),
      name: "Directly Active Deal",
      propertyId: property.id,
      propertyType: property.propertyType,
      dealType: "Sale",
      dealSide: "seller",
      initialStage: "active",
    });

    expect(deal.status).toBe("active");
    expect(deal.publishedAt).toBeNull();
    expect(bannerShows(deal.id)).toBe(true);
  });
});
