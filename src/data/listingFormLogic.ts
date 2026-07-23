import type {
  DealType, MarketingChannel, PropertyStatus, PropertySubtype, PropertyType,
} from './types'

const ALL_SALE_CHANNELS: MarketingChannel[] = [
  'None', 'Buildout Buyer Network', 'My Brokerage Website', 'Buildout Syndication Network',
]

/** Sale marketing channels available at a given deal status (PRD §20). */
export function saleChannelsFor(status: PropertyStatus): MarketingChannel[] {
  switch (status) {
    case 'active': return ALL_SALE_CHANNELS
    case 'under-contract':
      return ALL_SALE_CHANNELS.filter((c) => c !== 'Buildout Syndication Network')
    default: return ['None'] // proposal | inactive | closed
  }
}

/** Lease marketing channels available at a given deal status (PRD §21). */
export function leaseChannelsFor(status: PropertyStatus): MarketingChannel[] {
  if (status === 'active') {
    return ['None', 'My Brokerage Website', 'Buildout Syndication Network']
  }
  return ['None']
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
export function buildingClassOptions(country: string | undefined): string[] {
  const base = ['A', 'B', 'C']
  // unset country → treat as domestic (US): A+ eligible
  return !country || country === 'United States' ? ['A+', ...base] : base
}

/** Buyer section shows only for a Sale deal at Under Contract (PRD §23). */
export function showBuyerSection(dealType: DealType, status: PropertyStatus): boolean {
  return dealType === 'Sale' && status === 'under-contract'
}
