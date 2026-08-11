import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * A space deal's page lives under its building, at
 * `/listings/{shellId}/spaces/{spaceId}`. Nothing at the route level enforces
 * that a link uses it — so *the links are the enforcement*, and a link that
 * assumes `/listings/{spaceId}` lands on a page that renders the space as though
 * it were a building.
 *
 * That makes a link the whole invariant, and links drift silently: the sweep that
 * was supposed to fix them all grepped for `to="/listings/$listingId"` and so
 * missed every object-form navigate, every template literal, every sub-route and
 * every raw anchor — fourteen live sites, two of them in the flow the change was
 * about.
 *
 * So this test reads the source. Any file that builds a deal-page target has to
 * be on the list below, with a reason. A new one fails here rather than in a
 * demo. It is deliberately blunt: the point is to be loud, not clever.
 */

const SRC_DIR = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Every shape this codebase has been caught building a deal target with. All four
 * are needed: the original sweep used only the first and missed the rest.
 *
 * This file holds them as plain text and would match itself — it doesn't, because
 * tests are not scanned (see `sourceFiles`).
 */
const LINK_FORMS = [
  'to="/listings/$listingId', // <Link to="/listings/$listingId…">
  'to: "/listings/$listingId', // navigate({ to: "/listings/$listingId…" })
  "`/listings/${", // navigate(`/listings/${id}`), href strings, path prefixes
  "href={`/listings/${", // <a href={`/listings/${id}/…`}>
];

/**
 * Files allowed to build one, and why. Everything here either resolves the id
 * first (through `dealCardLinkProps` / `buildingSectionListingId`) or cannot be
 * handed a space in the first place.
 */
const ALLOWED: Record<string, string> = {
  // The rule itself.
  "src/components/deals/dealCardLink.ts": "defines the two resolvers",

  // Pattern B — a building-level section, with the id resolved through
  // `buildingSectionListingId` before it is interpolated.
  "src/components/contacts/ContactDealCard.tsx": "Documents/Leads quick links, id resolved",
  "src/components/deals/PublishPreview.tsx": "new-tab Documents anchor, id resolved",
  "src/features/editor/EditorRoot.tsx": "Save and close → Documents, id resolved",

  // Leads is NOT a building-level section — a space's Leads page is the
  // building's list filtered to that suite, so it stays on the space. These
  // three cards used to route through `buildingSectionListingId` (wrong, and
  // now fixed); they now share `useOpenLeadsRow`, which resolves the id through
  // `spaceLeadsTarget` instead.
  "src/components/contacts/useOpenLeadsRow.ts": "Leads deep link, id resolved via spaceLeadsTarget",

  // Pattern C — a space's marketing fields live on its own Details page, so the
  // publish gate's "Back to editing" branches on `parentDealId` to reach it
  // instead of assuming the building's /listing form.
  "src/components/deals/StageGate.tsx": "publish gate branches space → its own Details, deal → /listing",

  // Within the deal whose page is already open: these link a deal to its own
  // sections, so the id is the URL's, never a card's.
  "src/components/properties/PropertyDetailHeader.tsx": "sections of the open deal",
  "src/components/deals/edit/DealEditor.tsx": "the open deal's own edit form, back to its overview",
  "src/components/listings/edit/ListingEditor.tsx": "the open deal's own edit form, cross-links to the Deal page when conflicts remain there",
  "src/components/deals/IngestionBanner.tsx": "rendered on the open deal's overview, links to whichever edit page holds the first unresolved conflict",

  // Opens a deal it has just created. `createDeal` never sets `parentDealId` —
  // a space only ever comes from `addSpaceToDeal` — so neither can produce one.
  "src/components/deals/CreateDealModal.tsx": "opens the deal it just created",
  "src/components/call/CallRecapCard.tsx": "opens the deal it just created",

  // Reads a pathname rather than building one.
  "src/components/properties/dealNav.ts": "parses the section out of a deal URL",

  // The context rail's "Parent" card links up from a space to its building.
  // `parentDealId` only ever points to a building — a space cannot itself have
  // a child space — so the id it links with is guaranteed never a space's.
  "src/components/deals/DealContextRail.tsx": "links a space up to its parent building, whose id can never be a space",

  // The space's own page (Task 7 of the space-deal-pages plan). `shell.id` always
  // resolves to the building — a space cannot itself be a shell, so this can never
  // receive a space id — and the `spaceId` link targets the space's own page,
  // which is the thing this file exists to render the header for.
  "src/components/deals/SpaceDetailHeader.tsx": "the open space's own crumbs: shell.id is always a building, spaceId is the page this task adds",

  // The sidebar's "Building" link out of a space's Marketing group. The id it
  // links with is `buildingLink.listingId`, which the caller always sets to the
  // shell's own id from the URL — a space's route is nested under its shell's id
  // segment, so this can never be a space id.
  "src/components/properties/PropertyDetailSidebar.tsx": "space sidebar links up to the building, whose id can never be a space",

  // The model composes its own path, so there is no link to fix: both of these
  // resolve a space id on the way out. See `rewriteSpaceDealPath`.
  "src/ai/tools.ts": "rewrites a model-supplied deal path",
};

const GUIDANCE = [
  "This file builds a link to a deal page, and a space deal's page lives under its",
  "building at /listings/{shellId}/spaces/{spaceId}.",
  "Route it through `dealCardLinkProps(listing)` to open a deal,",
  "`buildingSectionListingId(id)` for a building-level section such as Documents or",
  "Website, or `spaceLeadsTarget(id)` for Leads specifically — Leads is a filtered",
  "view that stays on the space, not a building-owned section. If the site",
  "genuinely cannot receive a space, add it to ALLOWED in this file with the reason.",
].join("\n");

/**
 * Every non-test source file under `src/`. Tests are skipped: they assert *about*
 * these paths rather than navigating to them, and skipping them is what keeps
 * this file from reporting itself.
 */
function sourceFiles(dir = SRC_DIR, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) sourceFiles(`${dir}${entry.name}/`, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(`${dir}${entry.name}`);
    }
  }
  return acc;
}

/** Route files are allowed wholesale: a route under `/listings/$listingId/` owns
 *  that param, so every link it builds is already within the deal on screen. */
const isRouteFile = (rel: string) => rel.startsWith("src/routes/");

const filesBuildingDealLinks = sourceFiles()
  .filter((abs) => {
    const source = readFileSync(abs, "utf8");
    return LINK_FORMS.some((form) => source.includes(form));
  })
  .map((abs) => `src/${abs.slice(SRC_DIR.length)}`)
  .sort();

describe("who is allowed to build a link to a deal page", () => {
  it("is only the files on the allowlist", () => {
    const unexpected = filesBuildingDealLinks.filter(
      (rel) => !isRouteFile(rel) && !(rel in ALLOWED),
    );
    expect(unexpected, GUIDANCE).toEqual([]);
  });

  it("has no allowlist entry that has stopped needing one", () => {
    const stale = Object.keys(ALLOWED)
      .filter((rel) => !filesBuildingDealLinks.includes(rel))
      .sort();
    expect(
      stale,
      "These files no longer build a deal link (moved, renamed, or fixed). Drop them from ALLOWED so it keeps meaning something.",
    ).toEqual([]);
  });

  it("finds the links it is looking for at all", () => {
    // A guard on the guard: if a refactor renamed the route or the patterns
    // stopped matching, both assertions above would pass on an empty set.
    expect(filesBuildingDealLinks.length).toBeGreaterThan(10);
    expect(filesBuildingDealLinks).toContain("src/components/deals/dealCardLink.ts");
  });
});
