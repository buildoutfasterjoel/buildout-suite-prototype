import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createProposalListing, emptyDraft } from "#/data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "#/data/leaseSpaces";
import { updateListingUnderwriting } from "#/data/store";
import { dealSupportsUnderwriting } from "./eligibility";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

describe("dealSupportsUnderwriting", () => {
  it("is false for a space even mid-run — 'generated' is the exact status that reaches the placement modal", () => {
    // `addSpaceToDeal` spreads `...parent` onto the child, so a space inherits
    // its parent's `underwriting` the moment it's created. A run sitting at
    // 'generated' is one click ("Save Underwriting" / `openPlacement`) away from
    // `UnderwritingPlacementModal` writing a document — the exact path a
    // contact's deal card offers via `BovFlow`. This predicate is the one
    // guard shared by that card's CTA, the other contact card, and the planner
    // row, so pinning it here pins all three.
    const parent = createProposalListing({
      ...emptyDraft(),
      name: "Rowan Center",
      dealType: "Lease",
    });
    updateListingUnderwriting(parent.id, {
      strategy: "value-add",
      tier: "Value-Add Strategy",
      selectedChecks: [0],
      status: "generated",
    });
    const unit = addPropertyUnit(parent.propertyId, {
      label: "Suite 300",
      sqft: 2000,
      unitType: "office",
    })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;

    // Sanity check: the space really did inherit the parent's in-flight run.
    expect(child.underwriting?.status).toBe("generated");
    expect(dealSupportsUnderwriting(child)).toBe(false);
  });

  it("is true for the parent itself — the exclusion is about being a space, not about the run's status", () => {
    const parent = createProposalListing({
      ...emptyDraft(),
      name: "Rowan Center",
      dealType: "Lease",
    });
    updateListingUnderwriting(parent.id, {
      strategy: "value-add",
      tier: "Value-Add Strategy",
      selectedChecks: [0],
      status: "generated",
    });
    expect(dealSupportsUnderwriting(parent)).toBe(true);
  });
});
