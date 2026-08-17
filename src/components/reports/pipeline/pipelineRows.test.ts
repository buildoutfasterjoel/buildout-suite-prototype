import { describe, it, expect } from "vitest";
import type { Listing, Property } from "#/data/types";
import {
  officeForDeal,
  toPipelineRow,
  formatReportCurrency,
  pipelineTotals,
  type PipelineRow,
} from "./pipelineRows";
import { SEED_ROSTER } from "#/data/roster";

/** Minimal Listing — the repo's established test idiom for this type. */
function deal(over: Partial<Listing> = {}): Listing {
  return {
    id: "l1",
    dealId: "100",
    name: "123 Main Street",
    status: "active",
    dealType: "Lease",
    dealSide: "seller",
    parentDealId: null,
    propertyId: "p1",
    internalBrokers: [],
    transaction: { salePrice: 0, commissionAmount: 0, closeDate: null },
    ...over,
  } as unknown as Listing;
}

function property(over: Partial<Property> = {}): Property {
  return {
    id: "p1",
    street: "123 Main Street",
    city: "Chicago",
    state: "IL",
    propertyType: "office",
    ...over,
  } as unknown as Property;
}

describe("formatReportCurrency", () => {
  it("writes exact dollars and cents, not an abbreviation", () => {
    expect(formatReportCurrency(4810000)).toBe("$4,810,000.00");
    expect(formatReportCurrency(143994.24)).toBe("$143,994.24");
  });

  it("distinguishes a real zero from a missing value", () => {
    expect(formatReportCurrency(0)).toBe("$0.00");
    expect(formatReportCurrency(null)).toBe("--");
  });
});

describe("officeForDeal", () => {
  it("resolves the lead internal broker's office", () => {
    const lead = SEED_ROSTER[0];
    const row = officeForDeal(
      deal({ internalBrokers: [{ name: lead.name }] as never }),
    );
    expect(row).toBe(lead.office);
  });

  it("is null when the deal has no internal broker", () => {
    expect(officeForDeal(deal({ internalBrokers: [] }))).toBeNull();
  });

  it("is null when the broker matches nobody on the roster", () => {
    const row = officeForDeal(
      deal({ internalBrokers: [{ name: "Nobody At All" }] as never }),
    );
    expect(row).toBeNull();
  });
});

describe("toPipelineRow", () => {
  it("flattens a deal and its property into one row", () => {
    const r = toPipelineRow(
      deal({
        transaction: {
          salePrice: 4810000,
          commissionAmount: 144300,
          closeDate: "2026-09-01",
        } as never,
      }),
      property(),
    );
    expect(r.dealId).toBe("100");
    expect(r.name).toBe("123 Main Street");
    expect(r.stage).toBe("active");
    expect(r.street).toBe("123 Main Street");
    expect(r.city).toBe("Chicago");
    expect(r.state).toBe("IL");
    expect(r.propertyType).toBe("office");
    expect(r.transactionValue).toBe(4810000);
    expect(r.brokerageGross).toBe(144300);
    expect(r.closeDate).toBe("2026-09-01");
  });

  it("keeps the listing id, which links need, distinct from the displayed dealId", () => {
    const r = toPipelineRow(deal({ id: "uuid-abc", dealId: "421" }), property());
    expect(r.listingId).toBe("uuid-abc");
    expect(r.dealId).toBe("421");
  });

  it("nulls the property columns when the property is missing", () => {
    const r = toPipelineRow(deal(), undefined);
    expect(r.street).toBeNull();
    expect(r.city).toBeNull();
    expect(r.state).toBeNull();
    expect(r.propertyType).toBeNull();
  });
});

describe("pipelineTotals", () => {
  it("counts rows and sums both money columns", () => {
    const rows = [
      { transactionValue: 100, brokerageGross: 10 },
      { transactionValue: 250, brokerageGross: 25 },
    ] as PipelineRow[];
    expect(pipelineTotals(rows)).toEqual({
      count: 2,
      transactionValue: 350,
      brokerageGross: 35,
    });
  });

  it("totals an empty set to zero rather than NaN", () => {
    expect(pipelineTotals([])).toEqual({
      count: 0,
      transactionValue: 0,
      brokerageGross: 0,
    });
  });
});
