import { describe, expect, it } from "vitest";
import { getProperty, addProperty, addPropertyUnit } from "./store";
import { useDataStore } from "./dataStore";
import { createProposalListing, emptyDraft } from "./createListing";

describe("store selectors backed by useDataStore", () => {
  it("getStore reflects the live Zustand slice", () => {
    const anyId = [...useDataStore.getState().properties.keys()][0];
    expect(getProperty(anyId)).toBe(
      useDataStore.getState().properties.get(anyId),
    );
  });

  it("addProperty writes through the Zustand store", () => {
    const before = useDataStore.getState().properties.size;
    addProperty({ id: "p-test" } as any);
    expect(useDataStore.getState().properties.size).toBe(before + 1);
    expect(getProperty("p-test")).toBeTruthy();
  });
});

describe('addPropertyUnit occupancy defaults', () => {
  it('creates a unit that is vacant with no tenant on record', () => {
    const listing = createProposalListing({ ...emptyDraft(), name: 'Occupancy Fixture', dealType: 'Lease' })
    const unit = addPropertyUnit(listing.propertyId, {
      label: 'Suite 900', sqft: 1200, unitType: 'office',
    })!

    expect(unit.occupancy).toBe('vacant')
    expect(unit.tenantName).toBeNull()
    expect(unit.leaseExpiration).toBeNull()
  })
})
