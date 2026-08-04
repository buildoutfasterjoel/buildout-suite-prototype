import { describe, it, expect } from "vitest";
import { createProposalListing, emptyDraft } from "./../../data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "./../../data/leaseSpaces";
import { dealCardLinkProps } from "./dealCardLink";

describe("dealCardLinkProps", () => {
  it("sends a top-level deal to its own page", () => {
    const deal = createProposalListing({ ...emptyDraft(), name: "Tower Sale", dealType: "Sale" });
    expect(dealCardLinkProps(deal)).toEqual({
      to: "/listings/$listingId",
      params: { listingId: deal.id },
    });
  });

  it("sends a space deal to its building roster with its row named", () => {
    const parent = createProposalListing({ ...emptyDraft(), name: "Mall", dealType: "Lease" });
    const unit = addPropertyUnit(parent.propertyId, { label: "Suite 100", sqft: 900, unitType: "retail" })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;

    expect(dealCardLinkProps(child)).toEqual({
      to: "/listings/$listingId/spaces",
      params: { listingId: parent.id },
      search: { space: child.id },
    });
  });
});
