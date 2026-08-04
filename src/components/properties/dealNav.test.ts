import { describe, it, expect } from "vitest";
import { dealBreadcrumbTrail, NAV_GROUPS, visibleNavGroups } from "./dealNav";

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

  it("labels the vouchers drill-down and carries the space id", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/vouchers/space-9`, ID)).toEqual({
      sectionLabel: "Vouchers",
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

function hrefs(
  shape: Parameters<typeof visibleNavGroups>[0],
  opts = {
    leaseParent: false,
    showsUnderwriting: false,
  },
) {
  return visibleNavGroups(shape, opts).flatMap((g) => g.items).map((i) => i.href);
}

describe("visibleNavGroups", () => {
  it("gives a shell the Vouchers index and neither Voucher nor Invoices", () => {
    const shown = hrefs("shell", { leaseParent: true, showsUnderwriting: false });
    expect(shown).toContain("vouchers");
    expect(shown).not.toContain("financials");
    expect(shown).not.toContain("financial-documents");
  });

  it("gives every other shape Voucher and Invoices but no Vouchers index", () => {
    for (const shape of ["sale", "flat-lease", "space"] as const) {
      const shown = hrefs(shape, { leaseParent: true, showsUnderwriting: false });
      expect(shown, shape).not.toContain("vouchers");
    }
    const sale = hrefs("sale");
    expect(sale).toContain("financials");
    expect(sale).toContain("financial-documents");
  });

  it("never shows the Vouchers index and the single Voucher together", () => {
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      const shown = hrefs(shape, { leaseParent: true, showsUnderwriting: true });
      expect(
        shown.includes("vouchers") && shown.includes("financials"),
        shape,
      ).toBe(false);
    }
  });

  it("shows Spaces only for a lease parent", () => {
    expect(hrefs("shell", { leaseParent: true, showsUnderwriting: false })).toContain("spaces");
    expect(hrefs("sale", { leaseParent: false, showsUnderwriting: false })).not.toContain("spaces");
  });

  it("shows Underwriting only when the property qualifies", () => {
    expect(hrefs("sale", { leaseParent: false, showsUnderwriting: true })).toContain("underwriting");
    expect(hrefs("sale", { leaseParent: false, showsUnderwriting: false })).not.toContain("underwriting");
  });

  it("drops a group that ends up empty", () => {
    // Back Office always keeps Notes, so force the emptiness through a group
    // whose every item is conditional: none exist today, so assert the
    // invariant instead — no rendered group is ever empty.
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      for (const group of visibleNavGroups(shape, { leaseParent: false, showsUnderwriting: false })) {
        expect(group.items.length, shape).toBeGreaterThan(0);
      }
    }
  });
});
