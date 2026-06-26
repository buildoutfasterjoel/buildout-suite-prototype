import type { DataStore, Listing, Property } from './types'
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
