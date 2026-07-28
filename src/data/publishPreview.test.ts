import { describe, expect, it } from "vitest";
import type { Listing, Property } from "./types";
import { seedGateForm } from "./stageGates";
import { buildPublishPreview } from "./publishPreview";

/** Minimal Listing stub covering only what buildPublishPreview reads. */
function dealStub(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "deal-1",
    name: "123 Main St",
    dealType: "Sale",
    dealSide: "seller",
    status: "proposal",
    propertyId: "prop-1",
    sellerContactIds: [],
    buyerContactIds: [],
    tenantContactIds: [],
    documents: [],
    internalBrokers: [],
    marketing: {
      saleTitle: "Prime Retail Pad",
      saleDescription: "Corner lot with drive-thru",
      leaseTitle: "",
      leaseDescription: "",
      availableSqFt: 0,
      propertyUse: "Retail",
      spaceLeaseTerms: [],
    },
    financials: { askingPrice: 1_950_000 },
    transaction: {
      listedOnDate: "2026-07-01",
      listingExpirationDate: "2026-12-31",
      salePrice: 0,
      commissionAmount: 0,
      commissionPct: 0,
      closeProbability: 20,
      contractExecutedDate: null,
      closeDate: null,
      leaseCommencementDate: null,
      deadReason: null,
    },
    ...overrides,
  } as unknown as Listing;
}

const property = {
  id: "prop-1",
  street: "123 Main St",
  city: "Chicago",
  state: "IL",
} as unknown as Property;

function build(deal: Listing) {
  return buildPublishPreview(deal, property, seedGateForm(deal));
}

function contentRows(deal: Listing) {
  return build(deal).sections.find((s) => s.id === "content")!.rows;
}

function row(deal: Listing, label: string) {
  return contentRows(deal).find((r) => r.label === label);
}

describe("buildPublishPreview", () => {
  it("puts the property address in the deal section", () => {
    const deal = build(dealStub());
    const rows = deal.sections.find((s) => s.id === "deal")!.rows;
    expect(rows.find((r) => r.label === "Property")?.value).toBe(
      "123 Main St, Chicago, IL",
    );
  });

  it("marks a fully populated sale deal as having no gaps", () => {
    expect(contentRows(dealStub()).every((r) => r.status === "ok")).toBe(true);
  });

  it("shows the asking price row for a sale deal", () => {
    expect(row(dealStub(), "Asking price")?.status).toBe("ok");
    expect(row(dealStub(), "Lease rate")).toBeUndefined();
  });

  it("shows lease rate and available SF instead for a lease deal", () => {
    const lease = dealStub({
      dealType: "Lease",
      marketing: {
        ...dealStub().marketing,
        leaseTitle: "Suite 200",
        leaseDescription: "Second floor suite",
        availableSqFt: 2400,
        spaceLeaseTerms: [{ leaseRate: 28, leaseRateUnits: "SF/Yr" }],
      },
    } as Partial<Listing>);
    expect(row(lease, "Lease rate")?.status).toBe("ok");
    expect(row(lease, "Available SF")?.status).toBe("ok");
    expect(row(lease, "Asking price")).toBeUndefined();
  });

  it("flags a missing listing title", () => {
    const deal = dealStub({
      marketing: { ...dealStub().marketing, saleTitle: "" },
    } as Partial<Listing>);
    const titleRow = row(deal, "Listing title");
    expect(titleRow?.status).toBe("missing");
    expect(titleRow?.value).toBeNull();
    expect(titleRow?.field).toBe("saleTitle");
  });

  it("flags a missing listing description", () => {
    const deal = dealStub({
      marketing: { ...dealStub().marketing, saleDescription: "" },
    } as Partial<Listing>);
    expect(row(deal, "Listing description")?.status).toBe("missing");
  });

  it("flags a missing asking price", () => {
    const deal = dealStub({ financials: { askingPrice: 0 } } as Partial<Listing>);
    expect(row(deal, "Asking price")?.status).toBe("missing");
  });

  it("carries the derived photo gallery", () => {
    expect(build(dealStub()).photos).toHaveLength(5);
  });

  it("passes deal documents through", () => {
    const deal = dealStub({
      documents: [
        { id: "d1", name: "Listing Agreement — Signed.pdf", uploadedAt: "2026-07-01" },
        { id: "d2", name: "BOV.pdf", uploadedAt: "2026-07-02", aiGenerated: true },
      ],
    } as Partial<Listing>);
    expect(build(deal).documents.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("represents an empty document list rather than dropping it", () => {
    expect(build(dealStub({ documents: [] } as Partial<Listing>)).documents).toEqual([]);
  });
});
