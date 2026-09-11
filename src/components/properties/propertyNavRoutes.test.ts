import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PROPERTY_NAV_ITEMS, propertySectionLabel } from "./propertyNav";

/**
 * Every nav item on the Property record must have a route file, and every route
 * file must be reachable from the nav. The sidebar builds its targets by
 * interpolation — `/properties/${id}/${href}` — so TypeScript cannot check them.
 * Same contract as `spaceNavRoutes.test.ts`.
 *
 * Scans only `$propertyId/` — the space asset page lives in `$propertyId_/`
 * (trailing underscore, escaping the layout) and is deliberately not a section.
 */
const ROUTES_DIR = fileURLToPath(
  new URL("../../routes/_shell/properties/$propertyId/", import.meta.url),
);

const routeSlugs = readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith(".tsx") && f !== "index.tsx")
  .map((f) => f.replace(/\.tsx$/, ""))
  .sort();

const navHrefs = PROPERTY_NAV_ITEMS.map((i) => i.href).sort();

describe("the property record's nav and its routes", () => {
  it("has a route for every nav item", () => {
    expect(navHrefs.filter((h) => !routeSlugs.includes(h))).toEqual([]);
  });

  it("has a nav item for every route", () => {
    expect(routeSlugs.filter((s) => !navHrefs.includes(s))).toEqual([]);
  });
});

describe("propertySectionLabel", () => {
  it("reads the section after the id and ignores anything deeper", () => {
    expect(propertySectionLabel("/properties/p1/spaces", "p1")).toBe("Spaces");
    expect(propertySectionLabel("/properties/p1/overview/", "p1")).toBe("Overview");
    expect(propertySectionLabel("/properties/p1", "p1")).toBeNull();
    expect(propertySectionLabel("/properties/p1/nope", "p1")).toBeNull();
    expect(propertySectionLabel("/properties/p2/spaces", "p1")).toBeNull();
  });
});
