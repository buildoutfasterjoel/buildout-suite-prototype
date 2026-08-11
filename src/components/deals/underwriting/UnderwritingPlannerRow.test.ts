import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createProposalListing, emptyDraft } from "#/data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "#/data/leaseSpaces";
import { updateListingUnderwriting } from "#/data/store";
import { showsUnderwritingRow } from "./UnderwritingPlannerRow";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

describe("showsUnderwritingRow", () => {
  it("hides the row for a space that inherited underwriting from its parent shell", () => {
    // `addSpaceToDeal` spreads `...parent` onto the child, so a space carries its
    // parent's `underwriting` the moment it's created — this is what makes the
    // `listing.underwriting != null` branch below true for a space with no run of
    // its own. Without a space exclusion, the row would render on every suite
    // under a building that has run underwriting, and its terminal step would try
    // to save into the suite's own (unread) document list — see FIX-1.
    const parent = createProposalListing({
      ...emptyDraft(),
      name: "Rowan Center",
      dealType: "Lease",
    });
    updateListingUnderwriting(parent.id, {
      strategy: "value-add",
      tier: "Value-Add Strategy",
      selectedChecks: [0],
      status: "ready",
    });
    const unit = addPropertyUnit(parent.propertyId, {
      label: "Suite 300",
      sqft: 2000,
      unitType: "office",
    })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;

    // Sanity check: the space really did inherit the parent's underwriting, so
    // this test would fail without the fix rather than passing vacuously.
    expect(child.underwriting).not.toBeNull();
    expect(showsUnderwritingRow(child, undefined)).toBe(false);
  });
});
