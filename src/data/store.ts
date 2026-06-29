import type { DataStore, Listing, Property, Contact } from './types'
import { generateDataset } from './seed'

let _store: DataStore | null = null

export function getStore(): DataStore {
  if (_store !== null) return _store

  const { properties, listings, comps, contacts } = generateDataset()

  _store = {
    properties: new Map(properties.map((p) => [p.id, p])),
    listings: new Map(listings.map((l) => [l.id, l])),
    comps: new Map(comps.map((c) => [c.id, c])),
    contacts: new Map(contacts.map((ct) => [ct.id, ct])),
  }

  return _store
}

export function _resetStore(): void {
  _store = null
}

export function getProperty(propertyId: string): Property | undefined {
  return getStore().properties.get(propertyId)
}

export function getListing(listingId: string): Listing | undefined {
  return getStore().listings.get(listingId)
}

/** All listings (spaces) that belong to a property. */
export function getListingsForProperty(propertyId: string): Listing[] {
  return [...getStore().listings.values()].filter((l) => l.propertyId === propertyId)
}

/** Insert a property into the in-memory store. */
export function addProperty(property: Property): void {
  getStore().properties.set(property.id, property)
}

/** { value: propertyId, label: address } options for a property picker. */
export function getPropertyOptions(): { value: string; label: string }[] {
  return [...getStore().properties.values()]
    .map((p) => ({
      value: p.id,
      label: [p.street, p.city, p.state].filter(Boolean).join(', '),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Insert a listing into the in-memory store. */
export function addListing(listing: Listing): void {
  getStore().listings.set(listing.id, listing)
}

export function getContact(contactId: string): Contact | undefined {
  return getStore().contacts.get(contactId)
}

/** All contacts linked to a property in the CRM. */
export function getContactsForProperty(propertyId: string): Contact[] {
  return [...getStore().contacts.values()].filter((c) =>
    c.propertyIds.includes(propertyId),
  )
}

/** Owner-role contacts linked to a property — the candidate sellers for a sale. */
export function getOwnersForProperty(propertyId: string): Contact[] {
  return getContactsForProperty(propertyId).filter((c) => c.role === 'owner')
}

/** Display name for a contact, e.g. "Jane Doe · Acme Holdings". */
export function contactLabel(c: Contact): string {
  const name = `${c.firstName} ${c.lastName}`.trim()
  return c.company ? `${name} · ${c.company}` : name
}

/**
 * { value: contactId, label } options for a seller picker. Prefers the property's
 * own contacts (owners listed first); falls back to all contacts when the property
 * has none on file so the broker can still pick someone.
 */
export function getSellerOptions(propertyId: string): { value: string; label: string }[] {
  const linked = propertyId ? getContactsForProperty(propertyId) : []
  const pool = linked.length > 0 ? linked : [...getStore().contacts.values()]
  return pool
    .slice()
    .sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1
      if (b.role === 'owner' && a.role !== 'owner') return 1
      return contactLabel(a).localeCompare(contactLabel(b))
    })
    .map((c) => ({ value: c.id, label: contactLabel(c) }))
}
