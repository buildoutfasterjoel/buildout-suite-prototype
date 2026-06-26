import type { PropertyType, DealType, Property } from './types'
import type { NewListingDraft } from './createListing'
import { getStore } from './store'

/**
 * Simulated AI ingestion. This is a prototype — there is no real document parsing
 * or model call. The "AI" picks a matching property from the CRM (seeded data),
 * derives the listing from it, and layers any details sniffed from the prompt on
 * top. Always resolves something believable so the demo looks good.
 */

const TYPE_KEYWORDS: { type: PropertyType; words: string[] }[] = [
  { type: 'office', words: ['office', 'suite', 'corporate', 'class a'] },
  { type: 'retail', words: ['retail', 'storefront', 'shopping', 'strip', 'restaurant'] },
  { type: 'industrial', words: ['industrial', 'warehouse', 'distribution', 'flex', 'manufacturing'] },
  { type: 'multifamily', words: ['multifamily', 'apartment', 'units', 'residential'] },
  { type: 'mixed-use', words: ['mixed-use', 'mixed use'] },
  { type: 'land', words: ['land', 'vacant', 'acre', 'parcel'] },
  { type: 'hospitality', words: ['hotel', 'motel', 'hospitality', 'lodging'] },
  { type: 'special-purpose', words: ['self-storage', 'storage', 'medical', 'special purpose'] },
]

const DESCRIPTION_BY_TYPE: Record<PropertyType, string> = {
  office:
    'Well-positioned office offering with flexible floor plates, modern common areas, and on-site parking — a strong fit for professional and corporate tenants.',
  retail:
    'High-visibility retail space with excellent frontage, ample parking, and strong surrounding co-tenancy. Ideal for QSR, service, or specialty users.',
  industrial:
    'Functional industrial space with generous clear heights, dock access, and efficient column spacing — well-suited for warehouse, distribution, or flex use.',
  multifamily:
    'Stabilized multifamily offering with consistent occupancy and value-add upside through unit renovations and operational improvements.',
  'mixed-use':
    'Versatile mixed-use asset blending ground-floor commercial with upper-level space in a walkable, amenity-rich setting.',
  land: 'Developable land parcel in a growing corridor with favorable zoning and strong access — a clean canvas for ground-up development.',
  hospitality:
    'Hospitality asset with steady demand drivers, established flag potential, and upside through repositioning and revenue management.',
  'special-purpose':
    'Specialty asset with a durable, mission-critical use and dependable in-place income.',
}

/** Parse "$2.4M", "2,400,000", "$1.2m", "950k" into a dollar number. */
function parsePrice(text: string): number | null {
  const m = text.match(/\$?\s*([\d,.]+)\s*(m|mm|million|k|thousand)?/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  if (Number.isNaN(n)) return null
  const unit = (m[2] || '').toLowerCase()
  if (unit.startsWith('m')) return Math.round(n * 1_000_000)
  if (unit === 'k' || unit === 'thousand') return Math.round(n * 1_000)
  // Bare number: treat small values as millions, large as literal dollars.
  if (n < 1000) return Math.round(n * 1_000_000)
  return Math.round(n)
}

/** Parse "12,000 SF" / "12000 sqft" / "12k sf" into a square-foot number. */
function parseSqFt(text: string): number | null {
  const m = text.match(/([\d,.]+)\s*(k)?\s*(?:sf|sq\.?\s?ft|sqft|square feet)/i)
  if (!m) return null
  let n = parseFloat(m[1].replace(/,/g, ''))
  if (Number.isNaN(n)) return null
  if ((m[2] || '').toLowerCase() === 'k') n *= 1000
  return Math.round(n)
}

/** Parse a commission percentage near the word "commission" ("3% commission"). */
function parseCommissionPct(text: string): number | null {
  const m =
    text.match(/([\d.]+)\s*%\s*comm/i) ||
    text.match(/comm(?:ission)?\s*(?:of\s*)?([\d.]+)\s*%/i)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isNaN(n) ? null : n
}

function detectType(text: string): PropertyType | null {
  const lower = text.toLowerCase()
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return type
  }
  return null
}

function detectDealType(text: string): DealType | null {
  const lower = text.toLowerCase()
  const lease = lower.includes('lease') || lower.includes('for rent') || /\$\s*[\d.]+\s*\/\s*sf/.test(lower)
  const sale = lower.includes('sale') || lower.includes('for sale') || lower.includes('acquisition')
  if (lease && sale) return 'Sale / Lease'
  if (lease) return 'Lease'
  if (sale) return 'Sale'
  return null
}

/** Pick a CRM property to attach to — prefer one matching the desired type. */
function pickProperty(preferredType: PropertyType): Property | undefined {
  const all = [...getStore().properties.values()]
  return all.find((p) => p.propertyType === preferredType) ?? all[0]
}

/** Derive a listing draft from a real CRM property. */
function draftFromProperty(property: Property): Partial<NewListingDraft> {
  const address = [property.street, property.city, property.state].filter(Boolean).join(', ')
  const place = property.submarket
    ? `the ${property.submarket} submarket of ${property.city}, ${property.state}`
    : `${property.city}, ${property.state}`
  return {
    propertyId: property.id,
    address,
    name: address,
    propertyType: property.propertyType,
    dealType: 'Sale',
    listingPrice: property.askingPrice,
    availableSqFt: property.buildingSqFt,
    commissionPct: 3,
    description: DESCRIPTION_BY_TYPE[property.propertyType],
    locationDescription: `Located in ${place}, with convenient access to major corridors, transit, and area amenities.`,
  }
}

const FAKE_LATENCY_MS = 1200

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Keyword-sniff offering details from a free-text prompt (not the property). */
function parsePromptOverrides(text: string): Partial<NewListingDraft> {
  const draft: Partial<NewListingDraft> = {}
  const price = parsePrice(text)
  const sqft = parseSqFt(text)
  const dealType = detectDealType(text)
  const commission = parseCommissionPct(text)

  if (price != null) draft.listingPrice = price
  if (sqft != null) draft.availableSqFt = sqft
  if (dealType) draft.dealType = dealType
  if (commission != null) draft.commissionPct = commission
  // Seed the listing description from the broker's own words.
  draft.description = text
  return draft
}

/**
 * Turn an uploaded document and/or a free-text prompt into a partial listing
 * draft. The AI matches a CRM property (by type) and derives the listing from it,
 * then layers any details typed in the prompt on top. Both inputs are optional.
 * Resolves after a short fake latency so the modal can show an "Analyzing…" state.
 */
export async function extractListingDraft(input: {
  prompt?: string
  fileName?: string
}): Promise<Partial<NewListingDraft>> {
  await delay(FAKE_LATENCY_MS)

  const text = (input.prompt || '').trim()
  const fileHint = (input.fileName || '').toLowerCase()

  // Decide which property type the AI "found", from the prompt or the file name.
  const preferredType: PropertyType =
    detectType(text) ??
    (fileHint.includes('retail')
      ? 'retail'
      : fileHint.includes('industrial') || fileHint.includes('warehouse')
        ? 'industrial'
        : 'office')

  const property = pickProperty(preferredType)
  const base = property ? draftFromProperty(property) : {}
  const overrides = text ? parsePromptOverrides(text) : {}
  return { ...base, ...overrides }
}
