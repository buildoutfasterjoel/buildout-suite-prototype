import type {
  BuildingClass, DealType, MarketingChannel, PropertyStatus, PropertySubtype, PropertyType,
} from './types'

const ALL_CHANNELS: MarketingChannel[] = [
  'None', 'My Brokerage Website', 'Buildout Syndication Network',
]

/** Nothing is marketed once the deal is off the board, either won or lost. */
const SETTLED_STATUSES: PropertyStatus[] = ['closed', 'inactive']

/**
 * Marketing channels offered at a given point in a deal's life.
 *
 * The PRD (§20/§21) narrowed this list at every stage below Active, which
 * described where a listing may be *published* but was enforced on the control
 * where a broker *sets one up* — and setup happens before a deal goes active.
 * That hid the decision at exactly the moment it was being made. Pitching and
 * Under Contract now offer the full list: picking a channel there records where
 * the listing should go once it is live.
 *
 * Closed and Lost still collapse to None. Those are not "not yet published",
 * they are done, and offering to syndicate a deal that has already ended is
 * offering something nobody wants.
 *
 * Takes no deal type: Buyer Network was the only channel that differed between
 * Sale and Lease, and it is gone.
 */
export function channelsFor(status: PropertyStatus): MarketingChannel[] {
  return SETTLED_STATUSES.includes(status) ? ['None'] : ALL_CHANNELS
}

const LAND_LIKE: PropertySubtype[] = ['Vacant Land', 'Industrial Outdoor Storage']

/** True when the subtype is land-like (auto-requires Lot Size, PRD §8). */
export function isLandLikeSubtype(subtype: PropertySubtype): boolean {
  return LAND_LIKE.includes(subtype)
}

/** Which downstream sections a primary property type reveals/requires (PRD §8 "Type effects"). */
export function propertyTypeEffects(type: PropertyType): {
  buildingClass: boolean; retailClientele: boolean; industrialCluster: boolean
  landSections: boolean; unitsRequired: boolean; hidesLease: boolean
} {
  return {
    buildingClass: type === 'office',
    retailClientele: type === 'retail',
    industrialCluster: type === 'industrial',
    landSections: type === 'land',
    unitsRequired: type === 'multifamily',
    hidesLease: type === 'multifamily' || type === 'hospitality',
  }
}

/** Building-class options; A+ only for eligible countries (PRD §6/§9). */
export function buildingClassOptions(country: string | undefined): BuildingClass[] {
  const base: BuildingClass[] = ['A', 'B', 'C']
  // unset country → treat as domestic (US): A+ eligible
  return !country || country === 'United States' ? ['A+', ...base] : base
}

/** Buyer section shows only for a Sale deal at Under Contract (PRD §23). */
export function showBuyerSection(dealType: DealType, status: PropertyStatus): boolean {
  return dealType === 'Sale' && status === 'under-contract'
}
