import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import {
  listContactsForDeal,
  listDealsForContact,
  listDealsForProperty,
  searchAll,
} from './selectors'

describe('reverse-relationship selectors', () => {
  it('listContactsForDeal and listDealsForContact are consistent', () => {
    const listing = [...useDataStore.getState().listings.values()].find(
      (l) => l.sellerContactIds.length + l.buyerContactIds.length > 0,
    )!
    const contactId = [...listing.sellerContactIds, ...listing.buyerContactIds][0]
    expect(listContactsForDeal(listing.id).map((c) => c.id)).toContain(contactId)
    expect(listDealsForContact(contactId).map((l) => l.id)).toContain(listing.id)
  })

  it('listDealsForProperty includes a listing for its own property', () => {
    const listing = [...useDataStore.getState().listings.values()][0]!
    expect(listDealsForProperty(listing.propertyId).map((l) => l.id)).toContain(listing.id)
  })
})

describe('searchAll', () => {
  it('returns all-empty results for an empty or whitespace-only query', () => {
    expect(searchAll('')).toEqual({ properties: [], deals: [], contacts: [] })
    expect(searchAll('   ')).toEqual({ properties: [], deals: [], contacts: [] })
  })

  it('is case-insensitive when matching contacts', () => {
    const contact = [...useDataStore.getState().contacts.values()][0]!
    const haystack = `${contact.firstName} ${contact.lastName} ${contact.company}`
    const substring = haystack.slice(0, Math.max(3, Math.ceil(haystack.length / 2)))
    const result = searchAll(substring.toUpperCase())
    expect(result.contacts.map((c) => c.id)).toContain(contact.id)
  })

  it('matches properties by street/city substring', () => {
    const property = [...useDataStore.getState().properties.values()][0]!
    const haystack = [property.street, property.city].filter(Boolean).join(' ')
    const substring = haystack.slice(0, Math.max(3, Math.ceil(haystack.length / 2)))
    const result = searchAll(substring)
    expect(result.properties.map((p) => p.id)).toContain(property.id)
  })

  it('matches deals by name substring', () => {
    const listing = [...useDataStore.getState().listings.values()][0]!
    const substring = listing.name.slice(0, Math.max(3, Math.ceil(listing.name.length / 2)))
    const result = searchAll(substring)
    expect(result.deals.map((l) => l.id)).toContain(listing.id)
  })
})
