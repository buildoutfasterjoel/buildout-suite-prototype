import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { visibleNavGroups } from "./dealNav";

/**
 * Every nav item a space shows must have a route file, and every route file must
 * be reachable from the nav.
 *
 * The sidebar builds its targets by interpolation — `${basePath}/${item.href}` —
 * so TypeScript cannot check them. A nav item whose section has no route is a
 * blank page in a demo; a route no nav item points at is dead code. This test is
 * what per-route typing does not give us.
 */

const SPACE_ROUTES_DIR = fileURLToPath(
  new URL("../../routes/_shell/listings/$listingId_/spaces/$spaceId/", import.meta.url),
);

/**
 * Space routes that are deliberately not nav sections. `edit` is the space's Edit
 * Deal form, entered from the Transaction pencil on its Voucher — the same rule
 * the building's `/edit` follows (it isn't in `NAV_GROUPS` either; it just lives
 * in a directory this test doesn't scan). Anything added here needs a reason:
 * the default is that a route is reachable from the sidebar.
 */
const NOT_NAV_SECTIONS = ["edit"];

const routeSlugs = readdirSync(SPACE_ROUTES_DIR)
  .filter((f) => f.endsWith(".tsx") && f !== "index.tsx")
  .map((f) => f.replace(/\.tsx$/, ""))
  .sort();

/** The slugs the nav is answerable for — every route file bar the exemptions. */
const navigableSlugs = routeSlugs.filter(
  (slug) => !NOT_NAV_SECTIONS.includes(slug),
);

const navHrefs = visibleNavGroups("space", {
  leaseParent: false,
  showsUnderwriting: true,
})
  .flatMap((g) => g.items.map((i) => i.href))
  .sort();

describe("a space's nav and its routes", () => {
  it("has a route for every nav item", () => {
    const missing = navHrefs.filter((href) => !routeSlugs.includes(href));
    expect(
      missing,
      "These sections are in a space's sidebar with no route file, so clicking them blanks the page.",
    ).toEqual([]);
  });

  it("has a nav item for every route", () => {
    const unreachable = navigableSlugs.filter(
      (slug) => !navHrefs.includes(slug),
    );
    expect(
      unreachable,
      "These space routes exist but no nav item points at them. Either add the nav item, delete the route, or — if it is entered some other way, like the building's /edit is — add it to NOT_NAV_SECTIONS with a reason.",
    ).toEqual([]);
  });

  it("finds the routes it is looking for at all", () => {
    // A guard on the guard: `readdirSync` throws on a missing directory, so this
    // isn't protecting against the directory moving — it's protecting against
    // one of the two sets above going empty (e.g. `visibleNavGroups` filtering
    // everything out for "space") while the other still has entries, which
    // would let both assertions above pass without actually comparing anything.
    // `5` is a floor, not a count that tracks the current section list — it only
    // needs to be clearly non-empty, so removing another space section in the
    // future does not require touching this number.
    expect(routeSlugs.length).toBeGreaterThan(5);
    expect(routeSlugs).toContain("details");
    expect(routeSlugs).not.toContain("listing");
  });

  it("guards every section route", () => {
    // A suite must never render another landlord's voucher under the wrong
    // building's frame — see ab7b6be. Every route file under a space must call
    // `useSpaceRoute` to enforce that.
    const unguarded = readdirSync(SPACE_ROUTES_DIR)
      .filter((f) => f.endsWith(".tsx") && f !== "index.tsx")
      .filter((f) => !readFileSync(`${SPACE_ROUTES_DIR}${f}`, "utf8").includes("useSpaceRoute("));
    expect(unguarded, "A space section route must call useSpaceRoute — see ab7b6be.").toEqual([]);
  });
});
