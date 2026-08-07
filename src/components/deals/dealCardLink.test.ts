import { describe, it, expect } from "vitest";
import { createProposalListing, emptyDraft } from "./../../data/createListing";
import { addPropertyUnit, addSpaceToDeal } from "./../../data/leaseSpaces";
import { buildingSectionListingId, dealCardLinkProps } from "./dealCardLink";

describe("dealCardLinkProps", () => {
  it("sends a top-level deal to its own page", () => {
    const deal = createProposalListing({ ...emptyDraft(), name: "Tower Sale", dealType: "Sale" });
    expect(dealCardLinkProps(deal)).toEqual({
      to: "/listings/$listingId",
      params: { listingId: deal.id },
    });
  });

  it("sends a space to its own page under its building", () => {
    const props = dealCardLinkProps({ id: "S9", parentDealId: "L1" } as never);
    expect(props).toEqual({
      to: "/listings/$listingId/spaces/$spaceId/overview",
      params: { listingId: "L1", spaceId: "S9" },
    });
  });

  it("sends a non-space to its own deal page", () => {
    const props = dealCardLinkProps({ id: "L1", parentDealId: null } as never);
    expect(props).toEqual({ to: "/listings/$listingId", params: { listingId: "L1" } });
  });
});

describe("buildingSectionListingId", () => {
  it("keeps a top-level deal's own id", () => {
    const deal = createProposalListing({ ...emptyDraft(), name: "Tower Sale", dealType: "Sale" });
    expect(buildingSectionListingId(deal.id)).toBe(deal.id);
  });

  it("resolves a space to the building that owns the section", () => {
    const parent = createProposalListing({ ...emptyDraft(), name: "Plaza", dealType: "Lease" });
    const unit = addPropertyUnit(parent.propertyId, { label: "Suite 200", sqft: 1200, unitType: "office" })!;
    const child = addSpaceToDeal(parent.id, unit.id)!.deal;

    expect(buildingSectionListingId(child.id)).toBe(parent.id);
  });

  it("passes an unknown id through, rather than inventing a destination", () => {
    expect(buildingSectionListingId("no-such-deal")).toBe("no-such-deal");
  });
});
