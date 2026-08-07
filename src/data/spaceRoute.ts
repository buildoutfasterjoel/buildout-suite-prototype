import type { Listing, Property, PropertyUnit } from './types'
import { getListing, getProperty } from './store'

export interface SpaceRouteRecord {
  space: Listing
  property: Property
  /** The suite this space markets. Undefined if `unitId` is dangling. */
  unit: PropertyUnit | undefined
  /** The suite's display label, falling back to the deal name. */
  label: string
}

/**
 * Resolve `/listings/{shellId}/spaces/{spaceId}` to the records a section needs,
 * or null if the URL does not name a real space of that building.
 *
 * The guard is the reason this exists. The `shellId` segment declares which
 * building the page is scoped to, and a space whose parent differs must never
 * render under it — that would paint this suite's voucher and commission over
 * another landlord's frame, the bug `ab7b6be` caught during the reverted panel
 * work. Returning null (rather than redirecting) is deliberate: the store is
 * client-owned, so on a cold load a redirect computed from `parentDealId` would
 * fire against an empty map (`cf5676c`).
 */
export function resolveSpaceRoute(shellId: string, spaceId: string): SpaceRouteRecord | null {
  const space = getListing(spaceId)
  if (!space || space.parentDealId !== shellId) return null
  const property = getProperty(space.propertyId)
  if (!property) return null
  const unit = property.units.find((u) => u.id === space.unitId)
  return { space, property, unit, label: unit?.label ?? space.name }
}
