import type { Property } from "#/data/types";

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
