import type { Property, PropertySubtype } from './types'

/**
 * The subtypes that describe housing. They're the multifamily block of
 * `PropertySubtype` — `DEFAULT_SUBTYPE.multifamily` is 'Mid-Rise', so the
 * rise/plex range is residential here even though other taxonomies apply
 * "Mid-Rise" to an office tower.
 *
 * Same rule as `isMultifamilyOnly`, one level down: housing is managed, not
 * leased space-by-space, so these are not offered as the type of a leased space.
 */
export const RESIDENTIAL_SUBTYPES: PropertySubtype[] = [
  'Low-Rise/Garden',
  'Mid-Rise',
  'High-Rise',
  'Townhouse',
  'Duplex',
  'Triplex',
  'Fourplex',
]

export function isResidentialSubtype(subtype: PropertySubtype): boolean {
  return RESIDENTIAL_SUBTYPES.includes(subtype)
}

/**
 * A property whose every asset class is multifamily. Such a building is *managed*
 * — the only assignment a broker wins on it is property management, not a lease
 * or a sale of individual space. So it never belongs in a Lease property picker.
 *
 * "Only" is the operative word. A mixed-use building with apartments over ground-
 * floor retail has genuinely leasable commercial space and stays eligible, as does
 * a multifamily property carrying a second, non-residential asset class.
 */
export function isMultifamilyOnly(property: Property | undefined | null): boolean {
  if (!property) return false
  if (property.propertyType !== 'multifamily') return false
  return (property.additionalPropertyTypes ?? []).every((t) => t.type === 'multifamily')
}

/**
 * Whether a lease deal can be started on this property. An unknown property — a
 * free-typed address with no record yet — is leasable: there is no asset class to
 * disqualify it, and the broker classifies it after the deal exists.
 */
export function canLeaseProperty(property: Property | undefined | null): boolean {
  return !isMultifamilyOnly(property)
}
