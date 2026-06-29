import type { PropertyType, Property } from './types'
import type { NewListingDraft } from './createListing'
import { getStore, getOwnersForProperty } from './store'

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

/** How each type reads as a noun phrase in a marketing blurb. */
const TYPE_NOUN: Record<PropertyType, string> = {
  office: 'office building',
  retail: 'retail property',
  industrial: 'industrial facility',
  multifamily: 'multifamily community',
  'mixed-use': 'mixed-use asset',
  land: 'land parcel',
  hospitality: 'hospitality asset',
  'special-purpose': 'special-purpose asset',
}

/** The "why a buyer should care" sentence per type (lowercase lead, capitalized on use). */
const TYPE_PITCH: Record<PropertyType, string> = {
  office:
    'efficient floor plates and modern common areas make it a strong fit for corporate and professional tenants',
  retail:
    'strong frontage, ample parking, and established co-tenancy make it ideal for QSR, service, and specialty users',
  industrial:
    'generous clear heights, dock access, and efficient column spacing suit warehouse, distribution, and flex users',
  multifamily:
    'stabilized occupancy offers value-add upside through unit renovations and operational improvements',
  'mixed-use':
    'ground-floor commercial paired with upper-level space anchors a walkable, amenity-rich setting',
  land: 'favorable zoning and strong access make it a clean canvas for ground-up development',
  hospitality:
    'steady demand drivers provide upside through repositioning and revenue management',
  'special-purpose':
    'a durable, mission-critical use delivers dependable in-place income',
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Build a marketing-style listing description from a property's real attributes. */
function buildDescription(p: Property): string {
  const cls = p.buildingClass ? `Class ${p.buildingClass} ` : ''
  const subtype = p.propertySubtype ? `${p.propertySubtype.toLowerCase()} ` : ''
  const sf = p.buildingSqFt > 0 ? ` totaling ${p.buildingSqFt.toLocaleString()} SF` : ''
  const stories = p.stories > 1 ? ` across ${p.stories} stories` : ''
  const lead = `${cls}${subtype}${TYPE_NOUN[p.propertyType]}${sf}${stories}.`

  const facts: string[] = []
  if (p.yearBuilt > 0) {
    facts.push(
      p.yearRenovated
        ? `built in ${p.yearBuilt} and renovated in ${p.yearRenovated}`
        : `built in ${p.yearBuilt}`,
    )
  }
  if (p.parkingSpaces > 0) {
    facts.push(`${p.parkingSpaces.toLocaleString()} on-site parking spaces`)
  }
  const detail = facts.length ? ` ${cap(facts.join(', with '))}.` : ''

  const where = p.submarket ? ` in the ${p.submarket} submarket` : ''
  const pitch = ` ${cap(TYPE_PITCH[p.propertyType])}${where}.`

  return `${lead}${detail}${pitch}`
}

/** Build a location-description blurb from a property's market and zoning. */
function buildLocationDescription(p: Property): string {
  const place = p.submarket
    ? `the ${p.submarket} submarket of ${p.city}, ${p.state}`
    : `${p.city}, ${p.state}`
  const zoning = p.zoning ? ` Zoned ${p.zoning}.` : ''
  return `Located in ${place}, with convenient access to major corridors, transit, and area amenities.${zoning}`
}

/**
 * Parse "$2.4M", "2,400,000", "$1.2m", "950k" into a dollar number. Requires a
 * `$` sign or a magnitude unit (M/K/B) so it never mistakes a street number like
 * "123 Main St" for a price.
 */
function parsePrice(text: string): number | null {
  const m =
    text.match(/\$\s*([\d,.]+)\s*(b|billion|m|mm|million|k|thousand)?/i) ||
    text.match(/\b([\d,.]+)\s*(b|billion|m|mm|million|k|thousand)\b/i)
  if (!m) return null
  const n = parseFloat(m[1].replace(/,/g, ''))
  if (Number.isNaN(n)) return null
  const unit = (m[2] || '').toLowerCase()
  if (unit.startsWith('b')) return Math.round(n * 1_000_000_000)
  if (unit.startsWith('m')) return Math.round(n * 1_000_000)
  if (unit === 'k' || unit === 'thousand') return Math.round(n * 1_000)
  // $-prefixed bare number: small → millions, large → literal dollars.
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

/**
 * Pick a CRM property to attach to. Prefer one matching the desired type that also
 * has an owner on file, so the simulated match can demonstrate setting the seller;
 * otherwise fall back to any property of the type, then anything.
 */
function pickProperty(preferredType: PropertyType): Property | undefined {
  const all = [...getStore().properties.values()]
  const ofType = all.filter((p) => p.propertyType === preferredType)
  const withOwner = ofType.find((p) => getOwnersForProperty(p.id).length > 0)
  return withOwner ?? ofType[0] ?? all[0]
}

/**
 * Derive a listing draft from a real CRM property. Only property-level facts come
 * from the record (address, type, size, marketing copy). Deal terms — asking price
 * and commission — are NOT stored on the property; the broker states those, so they
 * arrive via {@link parsePromptOverrides}, not here.
 */
function draftFromProperty(property: Property): Partial<NewListingDraft> {
  const address = [property.street, property.city, property.state].filter(Boolean).join(', ')
  // Owner on file → assume the seller. With one owner it's unambiguous, so set it;
  // with several, leave it blank and let the modal ask which one is selling.
  const owners = getOwnersForProperty(property.id)
  return {
    propertyId: property.id,
    address,
    name: address,
    propertyType: property.propertyType,
    dealType: 'Sale',
    availableSqFt: property.buildingSqFt,
    description: buildDescription(property),
    locationDescription: buildLocationDescription(property),
    sellerContactId: owners.length === 1 ? owners[0].id : '',
  }
}

const FAKE_LATENCY_MS = 1200

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Keyword-sniff offering details from a free-text prompt to layer over CRM data. */
function parsePromptOverrides(text: string): Partial<NewListingDraft> {
  const draft: Partial<NewListingDraft> = {}
  const price = parsePrice(text)
  const sqft = parseSqFt(text)
  const commission = parseCommissionPct(text)

  if (price != null) draft.listingPrice = price
  if (sqft != null) draft.availableSqFt = sqft
  if (commission != null) draft.commissionPct = commission
  return draft
}

/**
 * Turn an uploaded document and/or a free-text prompt into a partial listing draft.
 * The "AI" locates a matching property in the broker's CRM (by type) and prefills the
 * deal from that record — address, size, asking price, and a generated description —
 * then layers on any numbers explicitly stated in the prompt. The resulting draft
 * carries the matched `propertyId` so the form shows it preselected.
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

/**
 * Refine an in-progress draft from a follow-up message (e.g. "asking $2.6M at
 * 2.5%"). Unlike {@link extractListingDraft} this never re-matches the property —
 * it only layers structured details sniffed from the text, so the conversation can
 * iterate without clobbering the already-connected property. Returns only the fields
 * it actually found.
 */
export async function refineListingDraft(text: string): Promise<Partial<NewListingDraft>> {
  await delay(700)

  const draft: Partial<NewListingDraft> = {}
  const price = parsePrice(text)
  const sqft = parseSqFt(text)
  const commission = parseCommissionPct(text)

  if (price != null) draft.listingPrice = price
  if (sqft != null) draft.availableSqFt = sqft
  if (commission != null) draft.commissionPct = commission
  return draft
}
