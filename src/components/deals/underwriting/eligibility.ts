import type { Listing, Property } from "#/data/types";

/**
 * Asset classes the AI underwriting flow supports. The generation is only
 * offered for these — Multi-Family, Self Storage, and Industrial Outdoor
 * Storage — so the underwriting row and the create-deal option stay hidden for
 * every other property type.
 */
export function propertyQualifiesForUnderwriting(
  property: Property | undefined,
): boolean {
  if (!property) return false;
  if (property.propertyType === "multifamily") return true;
  return (
    property.propertySubtype === "Self-Storage" ||
    property.propertySubtype === "Industrial Outdoor Storage"
  );
}

/**
 * Whether underwriting belongs to this deal at all — independent of asset-class
 * eligibility (`propertyQualifiesForUnderwriting`, which needs the property and
 * varies per call site) or run state. A space never gets underwriting: its
 * payoff is a document, and documents belong to the building, never a suite —
 * the same reason the space's Underwriting nav item is gone (`dealNav.ts`) and
 * its Documents route stays deleted.
 *
 * Shared by the planner row (`showsUnderwritingRow`, in
 * `UnderwritingPlannerRow.tsx`) and both contact-page deal cards' "Build
 * Underwriting" CTA
 * (`ContactDealCard`/`NewContactDealCard`), so the space exclusion lives in one
 * place instead of three checks that can drift — see the third-surface finding
 * this closes.
 */
export function dealSupportsUnderwriting(listing: Listing): boolean {
  return listing.parentDealId == null;
}
