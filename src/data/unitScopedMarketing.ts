/**
 * A space shows its own assets plus the building-wide ones — a suite with no
 * photos of its own should still show the building's.
 *
 * Generic over `{ unitId }` rather than `VisualMediaLink[]` because `photos` and
 * `links` carry the same discriminator and want the same three rules.
 *
 * The Media *editor* deliberately does NOT use this one. It renders what a suite
 * owns and what it inherits in two visibly separate blocks — that boundary is the
 * whole point of the page — so it needs `ownedByUnit` and `buildingWide` apart.
 * This merged view is for public and preview surfaces, where the fallback is what
 * matters and the distinction is not.
 */
export function mediaForUnit<T extends { unitId: string | null }>(
  links: T[],
  unitId: string | null,
): T[] {
  if (!unitId) return links
  return links.filter((l) => l.unitId === unitId || l.unitId == null)
}

/**
 * Strictly the unit's own — no building-wide fallback. Powers a suite's four
 * editable Media sections: a suite may only edit what it owns.
 */
export function ownedByUnit<T extends { unitId: string | null }>(
  list: T[],
  unitId: string,
): T[] {
  return list.filter((l) => l.unitId === unitId)
}

/**
 * Only the assets that belong to no unit. Powers the building's own four
 * sections, and a suite's read-only "From the building" block.
 */
export function buildingWide<T extends { unitId: string | null }>(list: T[]): T[] {
  return list.filter((l) => l.unitId == null)
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
