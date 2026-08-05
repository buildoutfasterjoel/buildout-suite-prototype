import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import {
  publishReadiness,
  resolveGate,
  seedGateForm,
  buildTransitionInput,
  completeSetupGate,
} from "#/data/stageGates";
import { requestStageChange } from "#/components/deals/useStageGate";
import { createDeal, commitStageTransition } from "#/data/actions";
import { emptyDraft } from "#/data/createListing";
import { startIngestionState } from "#/data/ingestion";
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
  if (l.ingestion?.status === "processing") return false;

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

  // A live-stage deal with a document-ingestion run in progress would otherwise
  // qualify for this banner too (missing fields, unpublished) — but the
  // ingestion banner is the accurate status while a run is processing, and the
  // two shouldn't stack for the ~5s the run takes.
  it("stays hidden while a document-ingestion run is processing, even with missing fields", () => {
    const { property } = rosaAndBuilding();
    const { deal } = createDeal({
      ...emptyDraft(),
      name: "Ingesting Deal",
      propertyId: property.id,
      propertyType: property.propertyType,
      dealType: "Sale",
      dealSide: "seller",
      initialStage: "active",
    });

    expect(deal.status).toBe("active");
    expect(deal.publishedAt).toBeNull();
    expect(bannerShows(deal.id)).toBe(true); // sanity: would warn without ingestion

    useDataStore.setState((s) => {
      const listings = new Map(s.listings);
      const l = listings.get(deal.id)!;
      listings.set(deal.id, {
        ...l,
        ingestion: startIngestionState(["T-12.pdf", "Rent Roll.xlsx"]),
      });
      return { listings } as never;
    });

    expect(bannerShows(deal.id)).toBe(false);
  });

  // The reported bug: the Active -> Under Contract gate reports `leavesActive`,
  // and EMPTY_GATE_FORM defaults unpublishOnExit to true, so the forward move
  // was unpublishing the listing — wiping publishedAt and re-arming the banner
  // on a deal that had already been published.
  it("keeps a published deal published when it advances out of Active", () => {
    const { rosa, property } = rosaAndBuilding();
    const { deal } = createRosaProposalDeal(rosa, property);
    const buyer = [...useDataStore.getState().contacts.values()].find(
      (c) => c.id !== rosa.id,
    )!;

    // Clear the publish gate the way the Approve & Publish modal does.
    const before = useDataStore.getState().listings.get(deal.id)!;
    const publishGate = resolveGate("proposal", "active", before.dealType);
    commitStageTransition(
      buildTransitionInput(
        publishGate,
        { ...seedGateForm(before), aiDocsAllReviewed: true },
        deal.id,
        "You",
        before.dealType,
      ),
    );
    const active = useDataStore.getState().listings.get(deal.id)!;
    expect(active.status).toBe("active");
    expect(active.publishedAt).not.toBeNull();

    readyForUnderContract(deal.id, buyer.id);
    requestStageChange(deal.id, "under-contract");

    const underContract = useDataStore.getState().listings.get(deal.id)!;
    expect(underContract.status).toBe("under-contract");
    expect(underContract.publishedAt).toBe(active.publishedAt);
    expect(bannerShows(deal.id)).toBe(false);
  });

  // Backward out of Active is the case the unpublish option exists for.
  it("still offers the unpublish option moving backward out of Active", () => {
    expect(resolveGate("active", "proposal", "Sale").leavesActive).toBe(true);
    expect(resolveGate("active", "inactive", "Sale").leavesActive).toBe(true);
    expect(resolveGate("active", "under-contract", "Sale").leavesActive).toBe(false);
    expect(resolveGate("active", "closed", "Sale").leavesActive).toBe(false);
  });
});

describe("planner tasks follow the deal's stage", () => {
  beforeEach(hydrate);

  it("swaps in the new stage's checklist on a stage change", () => {
    const { rosa, property } = rosaAndBuilding();
    const { deal } = createRosaProposalDeal(rosa, property);
    const buyer = [...useDataStore.getState().contacts.values()].find(
      (c) => c.id !== rosa.id,
    )!;

    // Created at proposal, so it carries the proposal plan.
    expect(deal.tasks.map((t) => t.label)).toContain(
      "Upload executed listing agreement",
    );

    readyForUnderContract(deal.id, buyer.id);
    requestStageChange(deal.id, "under-contract");

    const moved = useDataStore.getState().listings.get(deal.id)!;
    expect(moved.tasks.map((t) => t.label)).toEqual([
      "Execute purchase agreement (PSA)",
      "Collect earnest money",
      "Meeting with title company on closing logistics",
      "Complete due diligence",
      "Finalize buyer financing",
      "Clear closing contingencies",
      "Prepare closing documents",
      "Set agreed closing date",
    ]);
    // Leftover proposal work doesn't follow the deal forward.
    expect(moved.tasks.map((t) => t.label)).not.toContain(
      "Upload executed listing agreement",
    );
  });

  it("keeps the existing checklist when publishing in place", () => {
    const { property } = rosaAndBuilding();
    const { deal } = createDeal({
      ...emptyDraft(),
      name: "Publish In Place",
      propertyId: property.id,
      propertyType: property.propertyType,
      dealType: "Sale",
      dealSide: "seller",
      initialStage: "active",
    });
    const originalIds = deal.tasks.map((t) => t.id);

    // requestSetupCompletion commits with targetStage === the current stage.
    const config = completeSetupGate(deal);
    commitStageTransition(
      buildTransitionInput(
        config,
        { ...seedGateForm(deal), aiDocsAllReviewed: true },
        deal.id,
        "You",
        deal.dealType,
      ),
    );

    const published = useDataStore.getState().listings.get(deal.id)!;
    expect(published.publishedAt).not.toBeNull();
    expect(published.tasks.map((t) => t.id)).toEqual(originalIds);
  });
});
