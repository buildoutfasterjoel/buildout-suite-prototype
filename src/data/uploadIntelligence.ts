import { emptySpaceLeaseTerms, SUGGESTED_DOCUMENTS } from './createListing'
import type {
  DealDocument,
  DealMarketing,
  DealPitchFinancials,
  DealTransaction,
  Listing,
  Property,
} from './types'

/**
 * The documents Buildout "extracts" from a broker's uploaded files. Uploads in
 * the demo are mostly T-12s, rent rolls, and listing agreements; each maps to
 * the catalog docs the AI can now produce. When any financial file is present,
 * the AI also drafts the core marketing deliverables (OM + BOV). Returned in
 * catalog order so the Selected list stays stable.
 */
export function recommendDocsFromUploads(files: DealDocument[]): string[] {
  const names = files.map((f) => f.name.toLowerCase())
  const has = (re: RegExp) => names.some((n) => re.test(n))

  const keys = new Set<string>()
  const hasRentRoll = has(/rent\s*roll/)
  const hasT12 = has(/t-?12|operating statement/)
  const hasListingAgreement = has(/listing agreement/)

  if (hasRentRoll) keys.add('rent-roll')
  if (hasT12) {
    keys.add('t12')
    keys.add('proforma')
    keys.add('noi')
  }
  if (hasListingAgreement) keys.add('listing-agreement')
  if (hasRentRoll || hasT12) {
    keys.add('om')
    keys.add('bov')
  }

  return SUGGESTED_DOCUMENTS.filter((d) => keys.has(d.key)).map((d) => d.key)
}

/** The field values that make a deal pass the Approve & Publish gate. */
export interface PublishReadyPatch {
  marketing: Partial<DealMarketing>
  transaction: Partial<DealTransaction>
  financials: Partial<DealPitchFinancials>
}

/** Local `YYYY-MM-DD` (no timezone drift), matching the stored date convention. */
function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/**
 * The square footage the drafted figures are computed against: the property
 * record's building size, else the deal's available SF, else a stand-in.
 */
export function draftSqFt(deal: Listing, property: Property | undefined): number {
  return property && property.buildingSqFt > 0
    ? property.buildingSqFt
    : deal.marketing.availableSqFt || 10000
}

/** Price per SF to two decimals, 0 when the size is unknown. */
export function pricePerSqFtFor(askingPrice: number, sqft: number): number {
  return sqft > 0 ? Math.round((askingPrice / sqft) * 100) / 100 : 0
}

/**
 * Compute the field values that make `deal` publish-ready — everything the
 * Approve & Publish gate requires EXCEPT `aiDocsReviewed`, which stays the
 * broker's one remaining review click. Stands in for the AI reading the
 * broker's uploaded documents (listing agreement → dates, financials → price).
 */
export function buildPublishReadyPatch(
  deal: Listing,
  property: Property | undefined,
): PublishReadyPatch {
  const now = new Date()
  const transaction: Partial<DealTransaction> = {
    listedOnDate: localISO(now),
    listingExpirationDate: localISO(
      new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()),
    ),
  }

  const address = property
    ? [property.street, property.city, property.state].filter(Boolean).join(', ') ||
      property.name
    : deal.name
  const sqft = draftSqFt(deal, property)

  if (deal.dealType === 'Lease') {
    const unitId = deal.unitId ?? property?.units[0]?.id ?? ''
    const marketing: Partial<DealMarketing> = {
      leaseTitle: `${address} — Space for Lease`,
      leaseDescription: `Well-positioned space available at ${address}. Buildout drafted this listing from your uploaded documents.`,
      availableSqFt: sqft,
      spaceLeaseTerms: [
        {
          ...emptySpaceLeaseTerms(unitId),
          leaseRate: 28,
          leaseRateUnits: 'SF/Yr',
          leaseTermMonths: 60,
        },
      ],
    }
    return { marketing, transaction, financials: {} }
  }

  const askingPrice =
    property && property.askingPrice > 0
      ? property.askingPrice
      : Math.max(500000, sqft * 250)
  const marketing: Partial<DealMarketing> = {
    saleTitle: `${address} — For Sale`,
    saleDescription: `Investment opportunity at ${address}. Buildout drafted this listing from your uploaded documents.`,
  }
  const financials: Partial<DealPitchFinancials> = {
    askingPrice,
    pricePerSqFt: pricePerSqFtFor(askingPrice, sqft),
  }
  return { marketing, transaction, financials }
}
