import { describe, expect, it } from "vitest";
import { visibleListingGroups } from "#/components/listings/edit/listingFormGroups";

const ids = (o: Parameters<typeof visibleListingGroups>[0]) =>
  visibleListingGroups(o).map((g) => g.id);

describe("visibleListingGroups", () => {
  it("always shows location, asset, units, marketing, and notes", () => {
    expect(ids({ dealType: "Lease", propertyType: "office" }))
      .toEqual(["location", "asset", "units", "marketing", "notes"]);
  });

  it("adds condos for a Sale but never for a Lease", () => {
    expect(ids({ dealType: "Sale", propertyType: "office" }))
      .toContain("condos");
    expect(ids({ dealType: "Lease", propertyType: "office" }))
      .not.toContain("condos");
  });

  it("adds lots only for a land property type", () => {
    expect(ids({ dealType: "Sale", propertyType: "land" }))
      .toContain("lots");
    expect(ids({ dealType: "Sale", propertyType: "office" }))
      .not.toContain("lots");
  });

  it("orders groups location → asset → units → lots → condos → marketing → notes", () => {
    expect(ids({ dealType: "Sale", propertyType: "land" })).toEqual([
      "location", "asset", "units", "lots", "condos", "marketing", "notes",
    ]);
  });
});
