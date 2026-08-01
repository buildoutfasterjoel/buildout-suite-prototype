import type { VisualMediaLink } from './types'

/**
 * A space shows its own assets plus the building-wide ones — a suite with no
 * photos of its own should still show the building's.
 */
export function mediaForUnit(
  links: VisualMediaLink[],
  unitId: string | null,
): VisualMediaLink[] {
  if (!unitId) return links
  return links.filter((l) => l.unitId === unitId || l.unitId == null)
}

/**
 * Leads do NOT fall back: an inquiry on the building's own listing is not an
 * inquiry on Suite 200, and showing it as one would misattribute the broker's
 * pipeline. Unlike media, no new field was needed for this — a contact's
 * `inquiredListingIds` already records exactly which listing(s) (the shell's
 * own, or a specific space deal's) they inquired against, and a contact can
 * legitimately appear under more than one space.
 */
export function leadsForSpaceDeal<T extends { inquiredListingIds?: string[] }>(
  leads: T[],
  spaceDealId: string | null,
): T[] {
  if (!spaceDealId) return leads
  return leads.filter((l) => (l.inquiredListingIds ?? []).includes(spaceDealId))
}
