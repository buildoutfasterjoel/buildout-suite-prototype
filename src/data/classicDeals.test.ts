import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { classicDeals } from './classicDeals'
import { getProperty } from './store'
import { getRefId } from '#/components/properties/propertyDisplay'

/**
 * A listing with a street address — the only kind this page ever renders for. A
 * classic deal comes from the seed, and every seeded property has an address;
 * `createProposalListing` sets `isClassic: false`, so a deal created without one
 * can never reach the Deals table.
 */
function makeListing() {
  return createProposalListing({
    ...emptyDraft(),
    name: 'Thompson Block',
    address: '46418 Bernhard Drives',
    dealType: 'Sale',
  })
}

describe('classicDeals', () => {
  it('leads with the listing’s own deal', () => {
    const listing = makeListing()
    const [own] = classicDeals(listing.id)
    expect(own.listingId).toBe(listing.id)
    expect(own.title).toBe(listing.name)
    expect(own.dealType).toBe(listing.dealType)
    expect(own.stage).toBe(listing.status)
  })

  it('numbers the own row the way its page header does', () => {
    // Not `Listing.dealId` — that is a seed counter, and a table showing 101
    // beside a header showing #30514 reads as two different records.
    const listing = makeListing()
    expect(classicDeals(listing.id)[0].dealId).toBe(getRefId(listing.id))
  })

  it('gives every row the same location and property type', () => {
    // The rows all sit on one property, so a row disagreeing with it would be a
    // bug in the fixtures rather than a difference worth showing.
    const listing = makeListing()
    const property = getProperty(listing.propertyId)!
    // Built the same way the module builds it — a brand-new listing has no city
    // or state yet, and the point here is that all rows agree, not the wording.
    const expected = [property.city, property.state].filter(Boolean).join(', ')
    const rows = classicDeals(listing.id)
    for (const row of rows) {
      expect(row.location).toBe(expected)
      expect(row.propertyType).toBe(property.propertyType)
    }
  })

  it('leaves the location empty rather than showing a stray comma', () => {
    // A new deal's property has a street but no city or state yet, and ", " in
    // the Location column reads as a broken cell.
    const listing = makeListing()
    expect(classicDeals(listing.id)[0].location).toBe('')
  })

  it('never shows a blank title, even with no address on the property', () => {
    // `street` is '' on a property with no address, and an empty first column
    // reads as a broken row — so the title falls back to the deal's own name.
    const noAddress = createProposalListing({
      ...emptyDraft(),
      name: 'No Address Deal',
      dealType: 'Sale',
    })
    for (const row of classicDeals(noAddress.id)) {
      expect(row.title.trim()).not.toBe('')
      expect(row.title.startsWith(' — ')).toBe(false)
    }
  })

  it('marks companion rows as having no deal to open', () => {
    // The table renders their titles as plain text on the strength of this.
    const listing = makeListing()
    const companions = classicDeals(listing.id).slice(1)
    expect(companions).not.toHaveLength(0)
    for (const row of companions) expect(row.listingId).toBeNull()
  })

  it('gives every row a distinct title', () => {
    // Two rows on the same property once shared the street address, which reads
    // as a duplicated row rather than a second deal.
    const listing = makeListing()
    const titles = classicDeals(listing.id).map((r) => r.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('keeps row ids unique so the table can key on them', () => {
    const listing = makeListing()
    const ids = classicDeals(listing.id).map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('reads the same on every call — the companions are fixed, not drawn', () => {
    const listing = makeListing()
    expect(classicDeals(listing.id)).toEqual(classicDeals(listing.id))
  })

  it('returns nothing for an unknown listing rather than throwing', () => {
    expect(classicDeals('no-such-deal')).toEqual([])
  })
})
