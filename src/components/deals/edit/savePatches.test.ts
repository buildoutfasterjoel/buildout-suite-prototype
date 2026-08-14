import { describe, expect, it } from "vitest";
import { useDataStore } from "#/data/dataStore";
import { updateDeal } from "#/data/actions";
import { addPropertyUnit, getProperty } from "#/data/store";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import type { Listing, Property, RentRollRow, VisualMediaType } from "#/data/types";
import { dealSavePatch, listingSavePatch, propertySavePatch } from "./savePatches";

/** The first seeded deal. Read fresh per test — these tests write to the store. */
function seededDeal(): Listing {
  return [...useDataStore.getState().listings.values()][0];
}

function current(id: string): Listing {
  const deal = useDataStore.getState().listings.get(id);
  if (!deal) throw new Error(`no deal ${id}`);
  return deal;
}

function currentProperty(id: string): Property {
  const property = getProperty(id);
  if (!property) throw new Error(`no property ${id}`);
  return property;
}

function rentRow(id: string): RentRollRow {
  return {
    id,
    unitId: null,
    tenant: "Tenant",
    actualRent: 0,
    marketRent: 0,
    rentPerSf: null,
    securityDeposit: 0,
    leaseStart: null,
    leaseEnd: null,
    suite: "",
    size: null,
    annualRent: null,
  };
}

describe("listingSavePatch", () => {
  it("writes the rent roll without disturbing deal-side financials", () => {
    const deal = seededDeal();
    updateDeal(deal.id, {
      financials: { ...deal.financials, askingPrice: 4_250_000, rentRoll: [] },
    });
    const record = current(deal.id);

    const patch = listingSavePatch(record, {
      marketing: record.marketing,
      internalNotes: "a note",
      rentRoll: [rentRow("row-1")],
    });

    expect(patch.financials?.rentRoll.map((r) => r.id)).toEqual(["row-1"]);
    // The number the Deal page owns survives a Listing page save.
    expect(patch.financials?.askingPrice).toBe(4_250_000);
  });

  it("names only the keys the Listing page owns", () => {
    const record = seededDeal();
    const patch = listingSavePatch(record, {
      marketing: record.marketing,
      internalNotes: "",
      rentRoll: [],
    });
    expect(Object.keys(patch).sort()).toEqual([
      "financials",
      "internalNotes",
      "marketing",
    ]);
  });

  it("keeps the stage gate's lease terms and available SqFt over a stale draft", () => {
    const deal = seededDeal();
    // A stale draft: the page mounted before the gate committed these.
    const staleMarketing = {
      ...deal.marketing,
      leaseTitle: "Pre-gate title",
      spaceLeaseTerms: [],
      availableSqFt: 0,
    };
    // The gate commits straight to the store while the page is still open.
    updateDeal(deal.id, {
      marketing: {
        ...deal.marketing,
        spaceLeaseTerms: [
          { ...emptySpaceLeaseTerms("unit-1"), leaseRate: 32, leaseTermMonths: 60 },
        ],
        availableSqFt: 4_500,
      },
    });
    const record = current(deal.id);

    const patch = listingSavePatch(record, {
      // The form still owns leaseTitle — that edit must land.
      marketing: { ...staleMarketing, leaseTitle: "New title" },
      internalNotes: "",
      rentRoll: record.financials.rentRoll,
    });

    expect(patch.marketing?.spaceLeaseTerms).toEqual(
      record.marketing.spaceLeaseTerms,
    );
    expect(patch.marketing?.availableSqFt).toBe(4_500);
    expect(patch.marketing?.leaseTitle).toBe("New title");
  });

  it("keeps the stored occupancy snapshot over a stale draft", () => {
    const deal = seededDeal();
    updateDeal(deal.id, {
      marketing: { ...deal.marketing, occupancySnapshot: 92 },
    });
    const record = current(deal.id);

    const patch = listingSavePatch(record, {
      marketing: { ...record.marketing, occupancySnapshot: null },
      internalNotes: "",
      rentRoll: record.financials.rentRoll,
    });

    expect(patch.marketing?.occupancySnapshot).toBe(92);
  });

  it("keeps Media page edits (photos, links, visualMedia) over a stale draft", () => {
    const deal = seededDeal();
    // Simulate Media page edits made while Listing form was open: current has newer values
    updateDeal(deal.id, {
      marketing: {
        ...deal.marketing,
        photos: [
          {
            id: "photo-new",
            url: "https://example.com/new-photo.jpg",
            kind: "photo" as const,
            caption: "New photo",
            unitId: null,
          },
        ],
        links: [
          {
            id: "link-new",
            url: "https://example.com/tour",
            kind: "matterport" as const,
            unitId: null,
          },
        ],
        visualMedia: [
          {
            id: "vm-new",
            url: "https://example.com/embed",
            mediaType: "Matterport Tour" as VisualMediaType,
            unitId: null,
          },
        ],
      },
    });
    const record = current(deal.id);

    const patch = listingSavePatch(record, {
      marketing: {
        ...deal.marketing,
        photos: [
          {
            id: "photo-old",
            url: "https://example.com/old-photo.jpg",
            kind: "photo" as const,
            caption: "Old photo",
            unitId: null,
          },
        ],
        links: [
          {
            id: "link-old",
            url: "https://example.com/old-tour",
            kind: "virtualTour" as const,
            unitId: null,
          },
        ],
        visualMedia: [
          {
            id: "vm-old",
            url: "https://example.com/old-embed",
            mediaType: "Interactive Site Plan" as VisualMediaType,
            unitId: null,
          },
        ],
        leaseTitle: "Form-edited lease title",
      },
      internalNotes: "",
      rentRoll: record.financials.rentRoll,
    });

    // All three media keys must come from current (newer), not draft (stale)
    expect(patch.marketing?.photos).toEqual(record.marketing.photos);
    expect(patch.marketing?.links).toEqual(record.marketing.links);
    expect(patch.marketing?.visualMedia).toEqual(record.marketing.visualMedia);

    // Other marketing fields still come from draft
    expect(patch.marketing?.leaseTitle).toBe("Form-edited lease title");
  });
});

describe("propertySavePatch", () => {
  it("keeps the stored units over a draft seeded before a unit was added", () => {
    const deal = seededDeal();
    // The draft as it would have mounted, before a unit existed.
    const draft = currentProperty(deal.propertyId);

    // A space added from the property header while the page was open.
    addPropertyUnit(deal.propertyId, {
      label: "Suite 999",
      sqft: 1_200,
      unitType: "office",
    });
    const record = currentProperty(deal.propertyId);
    expect(record.units.length).toBe(draft.units.length + 1);

    const patch = propertySavePatch(record, {
      ...draft,
      // The form still owns occupancyPct — that edit must land.
      occupancyPct: 87,
    });

    expect(patch.units).toEqual(record.units);
    expect(patch.occupancyPct).toBe(87);
  });
});

describe("dealSavePatch", () => {
  it("preserves the stored rent roll over a stale draft snapshot", () => {
    const deal = seededDeal();
    updateDeal(deal.id, {
      financials: { ...deal.financials, rentRoll: [rentRow("row-2")] },
    });
    const record = current(deal.id);

    const patch = dealSavePatch(record, {
      status: record.status,
      dealType: record.dealType,
      internalBrokers: record.internalBrokers,
      outsideBrokers: record.outsideBrokers,
      transaction: record.transaction,
      // A draft that mounted before that rent-roll row existed.
      financials: { ...record.financials, rentRoll: [], askingPrice: 9_000_000 },
    });

    expect(patch.financials?.rentRoll.map((r) => r.id)).toEqual(["row-2"]);
    expect(patch.financials?.askingPrice).toBe(9_000_000);
  });

  it("names only the keys the Deal page owns", () => {
    const record = seededDeal();
    const patch = dealSavePatch(record, {
      status: record.status,
      dealType: record.dealType,
      internalBrokers: record.internalBrokers,
      outsideBrokers: record.outsideBrokers,
      transaction: record.transaction,
      financials: record.financials,
    });
    expect(Object.keys(patch).sort()).toEqual([
      "dealType",
      "financials",
      "internalBrokers",
      "outsideBrokers",
      "status",
      "transaction",
    ]);
  });
});
