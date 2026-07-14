import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import {
  getContactDetailClient,
  getPropertyDetailClient,
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

describe('getContactDetailClient', () => {
  it('shows the deals the contact is a party to, reciprocally (one coherent graph)', () => {
    const { contacts, listings } = useDataStore.getState()
    // A contact who is a direct party to at least one deal.
    const contact = [...contacts.values()].find(
      (c) => listDealsForContact(c.id).length > 0,
    )!

    const detail = getContactDetailClient(contact.id)
    expect(detail).not.toBeNull()
    expect(detail!.contact.id).toBe(contact.id)
    expect(detail!.deals.length).toBeGreaterThan(0)

    // The deals shown are exactly the deals the contact is a direct party to.
    expect(new Set(detail!.deals.map((d) => d.id))).toEqual(
      new Set(listDealsForContact(contact.id).map((l) => l.id)),
    )

    // Reciprocity ("feels like 1"): opening any shown deal shows this contact
    // back among its parties, and the deal's property is one the contact is
    // associated with.
    for (const deal of detail!.deals) {
      expect(listContactsForDeal(deal.id).map((c) => c.id)).toContain(contact.id)
      const listing = listings.get(deal.id)!
      expect(contact.propertyIds).toContain(listing.propertyId)
    }
  })

  it('returns null for an unknown contact id', () => {
    expect(getContactDetailClient('nonexistent-contact-id')).toBeNull()
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

describe('getPropertyDetailClient', () => {
  it('assembles the property, its deals, owners, contacts, and comps', () => {
    const { properties } = useDataStore.getState()
    // A property that has at least one deal (every seeded property has ≥2 contacts).
    const property = [...properties.values()].find(
      (p) => listDealsForProperty(p.id).length > 0,
    )!

    const detail = getPropertyDetailClient(property.id)
    expect(detail).not.toBeNull()
    expect(detail!.property.id).toBe(property.id)
    expect(detail!.deals.map((d) => d.id)).toEqual(
      listDealsForProperty(property.id).map((d) => d.id),
    )
    // Owners are a subset of the property's contacts.
    expect(detail!.contacts.length).toBeGreaterThan(0)
    for (const owner of detail!.owners) {
      expect(detail!.contacts.map((c) => c.id)).toContain(owner.id)
      expect(owner.role).toBe('owner')
    }
    // Comps all belong to this property.
    for (const comp of detail!.comps) {
      expect(comp.propertyId).toBe(property.id)
    }
  })

  it('returns null for an unknown property id', () => {
    expect(getPropertyDetailClient('nonexistent-property-id')).toBeNull()
  })
})
