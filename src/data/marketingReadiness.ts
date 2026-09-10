import type { DealShape } from './dealShape'
import type { Listing, Property } from './types'

/**
 * The fields a deal must hold before its marketing output — documents, the
 * public website, email campaigns, syndication, grids — can be built, by hand
 * or by the AI.
 *
 * A twin of `publishReadiness` in `stageGates.ts`, deliberately kept separate
 * rather than folded into it. The two answer different questions and neither
 * contains the other: publish-readiness is about whether a deal may go Active
 * (dates, a linked buyer, doc review), and this is about whether there is
 * enough content to render a flyer. A deal can be live and still have nothing
 * to print, and it can have everything to print and no listing agreement.
 */
export type MarketingField =
  | 'askingPrice'
  | 'saleDescription'
  | 'locationDescription'
  | 'buildingClass'
  | 'buildingSqFt'
  | 'leaseType'
  | 'leaseTitle'
  | 'leaseDescription'

export const MARKETING_FIELD_LABEL: Record<MarketingField, string> = {
  askingPrice: 'Sale Price',
  saleDescription: 'Sale Description',
  locationDescription: 'Location Description',
  buildingClass: 'Building Class',
  buildingSqFt: 'Building Size',
  leaseType: 'Lease Type',
  leaseTitle: 'Lease Title',
  leaseDescription: 'Lease Description',
}

/**
 * Which form the broker fixes each field on. Three of the eight are not on the
 * Listing form: the sale price is a Deal-form figure and the lease type is a
 * per-space one, so a banner that named them without saying where to go would
 * be a dead end.
 */
export type MarketingFieldForm = 'listing' | 'deal' | 'space'

export const MARKETING_FIELD_FORM: Record<MarketingField, MarketingFieldForm> = {
  askingPrice: 'deal',
  saleDescription: 'listing',
  locationDescription: 'listing',
  buildingClass: 'listing',
  buildingSqFt: 'listing',
  leaseType: 'space',
  leaseTitle: 'listing',
  leaseDescription: 'listing',
}

/** The sale-side and lease-side requirement sets, in the order a banner reads them. */
const SALE_FIELDS: MarketingField[] = [
  'askingPrice',
  'saleDescription',
  'locationDescription',
  'buildingClass',
  'buildingSqFt',
]
const LEASE_FIELDS: MarketingField[] = ['leaseType', 'leaseTitle', 'leaseDescription']

function satisfied(field: MarketingField, deal: Listing, property: Property): boolean {
  switch (field) {
    case 'askingPrice':
      return deal.financials.askingPrice > 0
    case 'saleDescription':
      return deal.marketing.saleDescription.trim() !== ''
    case 'locationDescription':
      return deal.marketing.locationDescription.trim() !== ''
    case 'buildingClass':
      return Boolean(property.buildingClass)
    case 'buildingSqFt':
      return property.buildingSqFt > 0
    case 'leaseType':
      return Boolean(deal.marketing.spaceLeaseTerms[0]?.leaseType)
    case 'leaseTitle':
      return deal.marketing.leaseTitle.trim() !== ''
    case 'leaseDescription':
      return deal.marketing.leaseDescription.trim() !== ''
  }
}

/**
 * Which marketing requirements this deal has not met yet.
 *
 * Two shapes get a narrowed list, both because the field in question is
 * physically somewhere else:
 *
 * - A **shell** has no lease type of its own. `addSpaceToDeal` moves every
 *   `spaceLeaseTerms` row onto the child, so a split building structurally
 *   cannot satisfy the field — its suites each carry their own.
 * - A **space** is marketed as part of its building, and `BUILDING_OWNED_HREFS`
 *   already keeps every gated section off a suite's sidebar. Checking it here
 *   would only produce a banner about output the suite never renders.
 */
export function marketingReadiness(
  deal: Listing,
  property: Property,
  shape?: DealShape,
): { ready: boolean; missing: MarketingField[] } {
  if (shape === 'space') return { ready: true, missing: [] }

  let required = deal.dealType === 'Lease' ? LEASE_FIELDS : SALE_FIELDS
  if (shape === 'shell') required = required.filter((f) => f !== 'leaseType')

  const missing = required.filter((f) => !satisfied(f, deal, property))
  return { ready: missing.length === 0, missing }
}

/**
 * What a deal would still be missing the moment it is created — asked by the
 * create-deal wizard, which has a draft and no record to run `marketingReadiness`
 * against.
 *
 * Every content field is empty on a fresh deal: the wizard collects no price and
 * no copy, `emptyDraft` starts `listingPrice` at 0, and `spaceLeaseTerms` at [].
 * So the only real question is what the chosen property already knows — its class
 * and size — and a raw address answers neither, since `createListing` sizes a new
 * property from the draft's available SF.
 *
 * Lives here rather than in the modal so the wizard's warning cannot list a
 * different set of fields than the banner the broker lands on afterwards.
 */
export function newDealMarketingGaps(
  dealType: Listing['dealType'],
  property: Pick<Property, 'buildingClass' | 'buildingSqFt'> | undefined,
): MarketingField[] {
  const blank = {
    dealType,
    financials: { askingPrice: 0 },
    marketing: {
      saleDescription: '',
      locationDescription: '',
      leaseTitle: '',
      leaseDescription: '',
      spaceLeaseTerms: [],
    },
  } as unknown as Listing
  const asset = (property ?? { buildingClass: '', buildingSqFt: 0 }) as Property
  return marketingReadiness(blank, asset, dealType === 'Lease' ? 'flat-lease' : 'sale')
    .missing
}
