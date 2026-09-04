import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BUILDING_OWNED_HREFS,
  CLASSIC_LANDING_HREF,
  CLASSIC_NAV_GROUPS,
  dealBreadcrumbTrail,
  NAV_GROUPS,
  visibleNavGroups,
  BACK_OFFICE_HREFS,
  MARKETING_HREFS,
} from "./dealNav";

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
      sectionLabel: "Inquiries",
      detailId: null,
      subsectionLabel: null,
    });
  });

  it("reports no detail for a section with a trailing slash", () => {
    expect(dealBreadcrumbTrail(`/listings/${ID}/leads/`, ID)).toEqual({
      sectionLabel: "Inquiries",
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
  opts: Parameters<typeof visibleNavGroups>[1] = {
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

  it("never gives a space Underwriting, even when showsUnderwriting is true", () => {
    // Underwriting's output is a document, and documents are the building's
    // alone — see the dedicated branch in `visibleNavGroups` (not
    // `BUILDING_OWNED_HREFS`: that constant is for marketing sections, and this
    // exclusion's reason is different). A space must never get this tab
    // regardless of `showsUnderwriting`, so this pins `shape !== "space"` as an
    // unconditional AND rather than something `showsUnderwriting` could overrule.
    expect(
      hrefs("space", { leaseParent: false, showsUnderwriting: true }),
    ).not.toContain("underwriting");
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
    // least one unconditional item today (Overview, Inquiries, Notes), so no shape
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
      subsectionLabel: "Inquiries",
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

describe("the building-owned sections", () => {
  const opts = { leaseParent: false, showsUnderwriting: true };

  function shown(shape: Parameters<typeof visibleNavGroups>[0], o = opts) {
    return visibleNavGroups(shape, o).flatMap((g) => g.items.map((i) => i.href));
  }

  it("names the eight sections a building owns, across both Deal and Marketing", () => {
    // Asserted explicitly rather than trusting the constant, so widening the
    // list is a deliberate edit to a test rather than a silent behaviour change.
    // Client Report and Underwriting live in the Deal group; the other six are
    // Marketing — see BUILDING_OWNED_HREFS' doc comment for why each qualifies.
    expect([...BUILDING_OWNED_HREFS].sort()).toEqual([
      "client-report",
      "demographics",
      "documents",
      "email",
      "grids",
      "plans",
      "underwriting",
      "website",
    ]);
  });

  it("hides every one of them from a space", () => {
    const hrefs = shown("space");
    for (const href of BUILDING_OWNED_HREFS) {
      expect(hrefs, href).not.toContain(href);
    }
  });

  it("keeps every one of them on a shell, which owns them", () => {
    const hrefs = shown("shell", { leaseParent: true, showsUnderwriting: true });
    for (const href of BUILDING_OWNED_HREFS) {
      expect(hrefs, href).toContain(href);
    }
  });

  it("keeps them on a sale and on a flat lease", () => {
    for (const shape of ["sale", "flat-lease"] as const) {
      const hrefs = shown(shape);
      for (const href of BUILDING_OWNED_HREFS) {
        expect(hrefs, `${shape} / ${href}`).toContain(href);
      }
    }
  });

  it("gives a space no Client Report, even when it has no route of its own", () => {
    // Distinct from the loop above: this pins the specific href a reader would
    // otherwise have to infer from the sorted list, and is the one this task
    // added — Client Report reports on the building's listing performance, not
    // a suite's, so a space must never offer it regardless of other options.
    expect(shown("space")).not.toContain("client-report");
  });

  it("leaves a space exactly the three marketing sections it does own", () => {
    // Exact contents and order: Details is the space’s own form, Inquiries and Media
    // are filtered views of the building's. Anything else appearing here is a
    // section that escaped the ownership rule.
    const marketing = visibleNavGroups("space", opts).find((g) => g.label === "Marketing");
    expect(marketing?.items.map((i) => i.href)).toEqual(["details", "leads", "media"]);
  });

  it("leaves a space exactly this set of Deal-group sections", () => {
    // Worked out from NAV_GROUPS' Deal group (Overview, Client Report, Activity,
    // History, Spaces, Files, Underwriting) minus what a space never gets:
    // Client Report and Underwriting (BUILDING_OWNED_HREFS) and Spaces (a space
    // has no children of its own, so `opts.leaseParent` is irrelevant to it).
    const deal = visibleNavGroups("space", opts).find((g) => g.label === "Deal");
    expect(deal?.items.map((i) => i.href)).toEqual(["overview", "activities", "history", "files"]);
  });

  it("does not empty the Marketing group for a space", () => {
    // `visibleNavGroups` drops groups that filter down to nothing. Removing six
    // of Marketing's ten items must not trip that.
    const labels = visibleNavGroups("space", opts).map((g) => g.label);
    expect(labels).toContain("Marketing");
  });
});

describe("classic deal nav", () => {
  const opts = { leaseParent: false, showsUnderwriting: true, isClassic: true };

  it("swaps the whole set rather than filtering the modern one", () => {
    expect(visibleNavGroups("sale", opts)).toEqual(CLASSIC_NAV_GROUPS);
  });

  it("ignores every shape rule — a classic deal is a plain top-level deal", () => {
    // Underwriting off, no lease parent, and a shell shape would each change the
    // modern set. None of them may reach the classic one.
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      expect(
        visibleNavGroups(shape, {
          leaseParent: true,
          showsUnderwriting: false,
          isClassic: true,
        }),
      ).toEqual(CLASSIC_NAV_GROUPS);
    }
  });

  it("holds the three legacy groups, under our names for them", () => {
    // Legacy reads PROJECT / LISTING / DEAL. We keep calling the record a deal,
    // so the first group is Deal and the third — which would collide — is
    // Financials, the modern sidebar's Back Office.
    expect(CLASSIC_NAV_GROUPS.map((g) => g.label)).toEqual([
      "Deal",
      "Listing",
      "Financials",
    ]);
  });

  it("holds exactly the legacy items, in the legacy order", () => {
    expect(CLASSIC_NAV_GROUPS.map((g) => g.items.map((i) => i.label))).toEqual([
      ["Inquiries", "Client Report", "Attachments", "Tasks", "Activities"],
      [
        "Documents",
        "Web Activity",
        "Website",
        "Email",
        "Syndication",
        "Grids",
        "Plans",
        "Media",
        "Demographics",
      ],
      ["Deals"],
    ]);
  });

  it("drops the Suite-only sections", () => {
    // Not in the legacy sidebar, so not on a classic deal. Overview is the one
    // that matters most: it is why the deal lands on Inquiries instead.
    const hrefs = CLASSIC_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    for (const gone of [
      "history",
      "spaces",
      "underwriting",
      "notes",
      "financial-documents",
      "financials",
      "vouchers",
      "listing",
      "details",
    ]) {
      expect(hrefs).not.toContain(gone);
    }
    // Overview is reachable, but only under the Tasks label — see below.
    expect(hrefs).toContain("overview");
  });

  it("lands on the first item in the sidebar", () => {
    expect(CLASSIC_LANDING_HREF).toBe(CLASSIC_NAV_GROUPS[0].items[0].href);
  });

  it("points every item at a section route that exists", () => {
    // The sidebar builds `${basePath}/${href}` and a bad href fails as a blank
    // page at runtime, which `vite build` does not catch. Reads the route
    // directory so a renamed or deleted section fails here instead.
    const dir = fileURLToPath(
      new URL("../../routes/_shell/listings/$listingId/", import.meta.url),
    );
    const routes = readdirSync(dir, { withFileTypes: true }).map((e) =>
      e.name.replace(/\.tsx$/, ""),
    );
    for (const item of CLASSIC_NAV_GROUPS.flatMap((g) => g.items)) {
      expect(routes, `no route for ${item.label}`).toContain(item.href);
    }
  });

  it("names the sections the way the classic sidebar names them", () => {
    // The crumb reads its label from the same set the sidebar renders, so the
    // three renamed sections must read as their classic names, not their modern
    // ones. Getting this wrong is invisible until someone reads the crumb.
    const label = (href: string) =>
      dealBreadcrumbTrail(`/listings/${ID}/${href}`, ID, true).sectionLabel;
    expect(label("overview")).toBe("Tasks");
    expect(label("files")).toBe("Attachments");
    expect(label("activities")).toBe("Activities");
    expect(label("deals")).toBe("Deals");
    // And the modern names still win when the deal is not classic.
    expect(dealBreadcrumbTrail(`/listings/${ID}/overview`, ID).sectionLabel).toBe(
      "Overview",
    );
    expect(dealBreadcrumbTrail(`/listings/${ID}/files`, ID).sectionLabel).toBe(
      "Files",
    );
  });

  it("reports no crumb for a classic-only section on a modern deal", () => {
    // `syndication`, `web-activity` and `deals` are absent from NAV_GROUPS, so a
    // modern deal must not label them — it cannot navigate to them either.
    for (const href of ["syndication", "web-activity", "deals"]) {
      expect(
        dealBreadcrumbTrail(`/listings/${ID}/${href}`, ID).sectionLabel,
      ).toBeNull();
    }
  });
});

describe("visibleNavGroups and the back-office wall", () => {
  it("drops the whole Back Office group, and Underwriting with it", () => {
    const shown = hrefs("sale", {
      leaseParent: false,
      showsUnderwriting: true,
      showsBackOffice: false,
    });
    for (const href of ["financials", "financial-documents", "notes", "underwriting"]) {
      expect(shown).not.toContain(href);
    }
    // Marketing and the Deal group are untouched.
    expect(shown).toContain("listing");
    expect(shown).toContain("overview");
  });

  it("drops a shell's Vouchers index too", () => {
    const shown = hrefs("shell", {
      leaseParent: true,
      showsUnderwriting: false,
      showsBackOffice: false,
    });
    expect(shown).not.toContain("vouchers");
  });

  it("applies to a classic deal's Financials group", () => {
    const shown = hrefs("sale", {
      leaseParent: false,
      showsUnderwriting: false,
      isClassic: true,
      showsBackOffice: false,
    });
    expect(shown).not.toContain("deals");
    expect(shown).toContain("website");
  });

  it("shows everything when access is not given an opinion", () => {
    const shown = hrefs("sale", { leaseParent: false, showsUnderwriting: true });
    expect(shown).toContain("financials");
    expect(shown).toContain("underwriting");
  });

  it("BACK_OFFICE_HREFS covers every section the guard must block", () => {
    for (const href of [
      "financials",
      "financial-documents",
      "notes",
      "vouchers",
      "underwriting",
      "deals",
    ]) {
      expect(BACK_OFFICE_HREFS).toContain(href);
    }
    expect(BACK_OFFICE_HREFS).not.toContain("overview");
    expect(BACK_OFFICE_HREFS).not.toContain("listing");
  });
});

describe("visibleNavGroups and the marketing wall", () => {
  it("drops the whole Marketing group, and keeps the money", () => {
    // The Back Office Manager's view: vouchers from every deal, no marketing.
    const shown = hrefs("sale", {
      leaseParent: false,
      showsUnderwriting: true,
      showsMarketing: false,
    });
    for (const href of ["listing", "website", "documents", "media", "grids"]) {
      expect(shown).not.toContain(href);
    }
    expect(shown).toContain("financials");
    expect(shown).toContain("overview");
  });

  it("applies to a classic deal's Listing group", () => {
    const shown = hrefs("sale", {
      leaseParent: false,
      showsUnderwriting: false,
      isClassic: true,
      showsMarketing: false,
    });
    expect(shown).not.toContain("website");
    expect(shown).not.toContain("syndication");
    expect(shown).toContain("deals");
  });

  it("leaves only the Deal group when both halves are withheld", () => {
    const shown = hrefs("sale", {
      leaseParent: false,
      showsUnderwriting: true,
      showsMarketing: false,
      showsBackOffice: false,
    });
    expect(shown).toEqual(["overview", "client-report", "activities", "history", "files"]);
  });

  it("MARKETING_HREFS and BACK_OFFICE_HREFS do not overlap", () => {
    // A section behind both walls would be unreachable by anyone but the team.
    for (const href of MARKETING_HREFS) {
      expect(BACK_OFFICE_HREFS, href).not.toContain(href);
    }
    expect(MARKETING_HREFS).toContain("website");
    expect(MARKETING_HREFS).toContain("syndication");
    expect(MARKETING_HREFS).not.toContain("overview");
  });
});
