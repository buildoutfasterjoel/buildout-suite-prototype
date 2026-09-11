import type { Property, PropertyUnit } from './types'
import { getProperty } from './store'
import { propertySpaces, type SpaceRow } from './propertySpaces'

export interface PropertySpaceRouteRecord {
  property: Property
  unit: PropertyUnit
  /** The unit's roster row — status, deal join, terms. */
  row: SpaceRow
}

/**
 * Resolve `/properties/{propertyId}/spaces/{unitId}` to the records the asset
 * page needs, or null if the URL does not name a real space of that property.
 *
 * The asset-side twin of `resolveSpaceRoute`. Its guard is simpler because a
 * unit id is only meaningful inside its property's `units` array: a unit from
 * another property cannot render here since the lookup never leaves this one.
 * Null rather than a redirect, for the same reason as the deal side (`cf5676c`):
 * the store is client-owned and empty during `beforeLoad` on a cold load.
 *
 * The whole-property stub resolves to null too — it is not a space, and the
 * roster never links to it.
 */
export function resolvePropertySpaceRoute(
  propertyId: string,
  unitId: string,
): PropertySpaceRouteRecord | null {
  const property = getProperty(propertyId)
  if (!property) return null
  const unit = property.units.find((u) => u.id === unitId)
  if (!unit) return null
  const row = propertySpaces(propertyId).find((r) => r.unitId === unitId)
  if (!row) return null
  return { property, unit, row }
}
