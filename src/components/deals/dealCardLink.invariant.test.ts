import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * A space deal has no page of its own. Nothing at the route level enforces that
 * — deliberately, and more than once: there is no redirect and no route guard,
 * so *the links are the enforcement*. That makes a link the whole invariant, and
 * links drift silently: the sweep that was supposed to fix them all grepped for
 * `to="/listings/$listingId"` and so missed every object-form navigate, every
 * template literal, every sub-route and every raw anchor — fourteen live sites,
 * two of them in the flow the change was about.
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
  "src/components/contacts/NewContactDealCard.tsx": "Leads quick link, id resolved",
  "src/components/contacts/ContactInquiryCard.tsx": "Leads deep link, id resolved",
  "src/components/contacts/NewContactInquiryCard.tsx": "Leads deep link, id resolved",
  "src/components/deals/PublishPreview.tsx": "new-tab Documents anchor, id resolved",
  "src/features/editor/EditorRoot.tsx": "Save and close → Documents, id resolved",

  // Pattern C — a space's terms moved to the roster, so the publish gate's
  // "Back to editing" branches on `parentDealId` instead of assuming /edit.
  "src/components/deals/StageGate.tsx": "publish gate branches space → roster, deal → /edit",

  // Within the deal whose page is already open: these link a deal to its own
  // sections, so the id is the URL's, never a card's.
  "src/components/properties/PropertyDetailHeader.tsx": "sections of the open deal",
  "src/components/properties/PropertyDetailSidebar.tsx": "sections of the open deal",
  "src/components/deals/DealMarketingEditor.tsx": "the open deal's own edit form, back to its overview",
  "src/components/deals/IngestionBanner.tsx": "rendered on the open deal's overview, links to its edit form",

  // Opens a deal it has just created. `createDeal` never sets `parentDealId` —
  // a space only ever comes from `addSpaceToDeal` — so neither can produce one.
  "src/components/deals/CreateDealModal.tsx": "opens the deal it just created",
  "src/components/call/CallRecapCard.tsx": "opens the deal it just created",

  // Reads a pathname rather than building one.
  "src/components/properties/dealNav.ts": "parses the section out of a deal URL",

  // The model composes its own path, so there is no link to fix: both of these
  // resolve a space id on the way out. See `rewriteSpaceDealPath`.
  "src/ai/tools.ts": "rewrites a model-supplied deal path",
};

const GUIDANCE = [
  "This file builds a link to a deal page, and a space deal has no page of its own.",
  "Route it through `dealCardLinkProps(listing)` to open a deal (a space opens its",
  "building's roster instead), or `buildingSectionListingId(id)` for a building-level",
  "section such as Documents or Leads. If the site genuinely cannot receive a space,",
  "add it to ALLOWED in this file with the reason.",
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
