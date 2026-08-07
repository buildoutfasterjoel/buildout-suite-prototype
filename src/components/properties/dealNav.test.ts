import { describe, it, expect } from "vitest";
import { dealBreadcrumbTrail, NAV_GROUPS, visibleNavGroups } from "./dealNav";

const ID = "deal-1";

describe("dealBreadcrumbTrail", () => {
  it("reports no section on the deal root", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
      subsectionLabel: null,
    });
  });

  it("tolerates a trailing slash on the deal root", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
      subsectionLabel: null,
    });
  });

  it("labels a known single-level section from NAV_GROUPS", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/leads`, ID)).toEqual({
      sectionLabel: "Leads",
      detailId: null,
      subsectionLabel: null,
    });
  });

  it("reports no detail for a section with a trailing slash", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/leads/`, ID)).toEqual({
      sectionLabel: "Leads",
      detailId: null,
      subsectionLabel: null,
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
      subsectionLabel: null,
    });
  });

  it("labels the vouchers drill-down and carries the space id", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/vouchers/space-9`, ID)).toEqual({
      sectionLabel: "Vouchers",
      detailId: "space-9",
      subsectionLabel: null,
    });
  });

  it("shows no crumb for a section absent from NAV_GROUPS, rather than inventing one", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/edit`, ID)).toEqual({
      sectionLabel: null,
      detailId: null,
      subsectionLabel: null,
    });
  });

  it("ignores a pathname for a different deal", () => {
    expect(dealBreadcrumbTrail("/listings/other/leads", ID)).toEqual({
      sectionLabel: null,
      detailId: null,
      subsectionLabel: null,
    });
  });

  it("labels the listing section", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/listing`, ID)).toEqual({
      sectionLabel: "Listing",
      detailId: null,
      subsectionLabel: null,
    });
  });
});

describe("NAV_GROUPS", () => {
  it("has unique hrefs, so a breadcrumb lookup cannot be ambiguous", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("leads Marketing with the Details/Listing swap pair, Details first", () => {
    // NAV_GROUPS is the full, shape-agnostic list — both items are always
    // present here; `visibleNavGroups` is what shows exactly one per shape.
    const marketing = NAV_GROUPS.find((g) => g.label === "Marketing");
    expect(marketing?.items[0]).toMatchObject({
      label: "Details",
      href: "details",
    });
    expect(marketing?.items[1]).toMatchObject({
      label: "Listing",
      href: "listing",
    });
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

  it("shows Listing for every shape that has a page", () => {
    // Not filtered by shape: the listing fields are the deal's marketing content
    // whatever the deal's shape. A space has no page at all, so it never asks.
    for (const shape of ["sale", "flat-lease", "shell"] as const) {
      expect(hrefs(shape, { leaseParent: true, showsUnderwriting: true }), shape).toContain(
        "listing",
      );
    }
  });

  it("never renders an empty group", () => {
    // Not a test of the `.filter(items.length > 0)` line: every group holds at
    // least one unconditional item today (Overview, Leads, Notes), so no shape
    // or option can empty one, and that filter cannot be reached from here.
    // What's asserted is the property the filter exists to guarantee — if a
    // future group is made entirely conditional, this is what catches it.
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      for (const opts of [
        { leaseParent: false, showsUnderwriting: false },
        { leaseParent: true, showsUnderwriting: true },
      ]) {
        for (const group of visibleNavGroups(shape, opts)) {
          expect(group.items.length, `${shape} ${JSON.stringify(opts)}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("the details / listing swap", () => {
  const opts = { leaseParent: false, showsUnderwriting: false };

  it("gives a space Details and never Listing", () => {
    const hrefs = visibleNavGroups("space", opts).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("details");
    expect(hrefs).not.toContain("listing");
  });

  it("gives every other shape Listing and never Details", () => {
    for (const shape of ["sale", "flat-lease", "shell"] as const) {
      const hrefs = visibleNavGroups(shape, opts).flatMap((g) => g.items.map((i) => i.href));
      expect(hrefs).toContain("listing");
      expect(hrefs).not.toContain("details");
    }
  });

  it("shows exactly one of the two for every shape — never both, never neither", () => {
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      const hrefs = visibleNavGroups(shape, opts).flatMap((g) => g.items.map((i) => i.href));
      const present = hrefs.filter((h) => h === "details" || h === "listing");
      expect(present).toHaveLength(1);
    }
  });

  it("gives a space no Spaces and no Vouchers index", () => {
    const hrefs = visibleNavGroups("space", opts).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("spaces");
    expect(hrefs).not.toContain("vouchers");
    // A space still earns its own commission, so it keeps the single pair.
    expect(hrefs).toContain("financials");
    expect(hrefs).toContain("financial-documents");
  });
});

describe("dealBreadcrumbTrail — the space page's third level", () => {
  it("names the section, the space and the subsection", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/leads", "L1")).toEqual({
      sectionLabel: "Spaces",
      detailId: "S9",
      subsectionLabel: "Leads",
    });
  });

  it("reports no subsection on the space's own root", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9", "L1")).toEqual({
      sectionLabel: "Spaces",
      detailId: "S9",
      subsectionLabel: null,
    });
  });

  it("labels the space's Details subsection", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/details", "L1").subsectionLabel).toBe("Details");
  });

  it("reports no subsection for a third segment absent from NAV_GROUPS", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/nonsense", "L1").subsectionLabel).toBeNull();
  });

  it("tolerates a trailing slash after the space id", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/", "L1").subsectionLabel).toBeNull();
  });
});
