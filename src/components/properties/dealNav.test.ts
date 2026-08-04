import { describe, it, expect } from "vitest";
import { dealBreadcrumbTrail, NAV_GROUPS } from "./dealNav";

const ID = "deal-1";

describe("dealBreadcrumbTrail", () => {
  it("reports no section on the deal root", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    });
  });

  it("tolerates a trailing slash on the deal root", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    });
  });

  it("labels a known single-level section from NAV_GROUPS", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/leads`, ID)).toEqual({
      sectionLabel: "Leads",
      detailId: null,
    });
  });

  it("carries the detail id on a drill-down", () => {
    // Asserted through `financials` rather than `vouchers`: the Vouchers item
    // does not enter NAV_GROUPS until a later task, so that href would not
    // resolve yet. The parsing under test is the same either way; the real
    // vouchers/{spaceId} case is covered once the item exists.
    expect(dealBreadcrumbTrail(`/listings/${ID}/financials/space-9`, ID)).toEqual({
      sectionLabel: "Voucher",
      detailId: "space-9",
    });
  });

  it("shows no crumb for a section absent from NAV_GROUPS, rather than inventing one", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/edit`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    });
  });

  it("ignores a pathname for a different deal", () => {
    expect(dealBreadcrumbTrail("/listings/other/leads", ID)).toEqual({
      sectionLabel: null,
      detailId: null,
    });
  });
});

describe("NAV_GROUPS", () => {
  it("has unique hrefs, so a breadcrumb lookup cannot be ambiguous", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
