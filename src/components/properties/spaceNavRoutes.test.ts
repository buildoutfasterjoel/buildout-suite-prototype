import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
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

const routeSlugs = readdirSync(SPACE_ROUTES_DIR)
  .filter((f) => f.endsWith(".tsx") && f !== "index.tsx")
  .map((f) => f.replace(/\.tsx$/, ""))
  .sort();

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
    const unreachable = routeSlugs.filter((slug) => !navHrefs.includes(slug));
    expect(
      unreachable,
      "These space routes exist but no nav item points at them. Either add the nav item or delete the route.",
    ).toEqual([]);
  });

  it("finds the routes it is looking for at all", () => {
    // A guard on the guard: if the directory moved, both assertions above would
    // pass on empty sets.
    expect(routeSlugs.length).toBe(18);
    expect(routeSlugs).toContain("details");
    expect(routeSlugs).not.toContain("listing");
  });
});
