import type { Listing, Property } from './types'
import { getListing } from './store'
import { dealShape } from './dealShape'

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

/**
 * The child space deal a contact inquired about on this property, if any.
 *
 * An inquiry is not a record of its own, so every edit to one is stored under a
 * listing id — and a suite's inquiry is the *suite's* inquiry no matter which
 * page it was opened from. Keying it to whichever page the broker happened to
 * be on (the building's Inquiries table, its Web Activity log) would write two
 * records for one inquiry and let the two disagree, so both surfaces resolve
 * the id through here.
 */
export function inquiredSpaceDeal(
  contact: { inquiredListingIds?: string[] },
  property: Property,
): Listing | undefined {
  for (const listingId of contact.inquiredListingIds ?? []) {
    const deal = getListing(listingId)
    // Only a child space deal names a unit; a building-level inquiry does not.
    if (!deal?.parentDealId) continue
    if (property.units.some((u) => u.id === deal.unitId)) return deal
  }
  return undefined
}

/** The listing an inquiry's edits are stored under, from any deal's page. */
export function inquiryListingId(
  contact: { inquiredListingIds?: string[] },
  listing: Listing,
  property: Property,
): string {
  // On a space page every inquiry shown is that space's own.
  if (dealShape(listing) === 'space') return listing.id
  return inquiredSpaceDeal(contact, property)?.id ?? listing.id
}
