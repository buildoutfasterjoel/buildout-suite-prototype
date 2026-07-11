import { useDataStore } from './dataStore'
import { getListingsForProperty } from './store'
import type { Contact, ContactDetail, DealSummary, Listing, Property } from './types'

/** All contacts attached to a deal (seller + buyer + other), deduped. */
export function listContactsForDeal(dealId: string): Contact[] {
  const { listings, contacts } = useDataStore.getState()
  const listing = listings.get(dealId)
  if (!listing) return []
  const ids = new Set([
    ...listing.sellerContactIds,
    ...listing.buyerContactIds,
    ...listing.otherContactIds,
  ])
  return [...ids].map((id) => contacts.get(id)).filter((c): c is Contact => !!c)
}

/** All deals a contact is attached to, in any role. Reverse of the listing arrays. */
export function listDealsForContact(contactId: string): Listing[] {
  const { listings } = useDataStore.getState()
  return [...listings.values()].filter(
    (l) =>
      l.sellerContactIds.includes(contactId) ||
      l.buyerContactIds.includes(contactId) ||
      l.otherContactIds.includes(contactId),
  )
}

/** All deals (listings) for a property. */
export function listDealsForProperty(propertyId: string): Listing[] {
  const { listings } = useDataStore.getState()
  return [...listings.values()].filter((l) => l.propertyId === propertyId)
}

/**
 * Everything the contact detail page needs, assembled client-side from the live
 * store. Mirrors `getContactDetail` in `#/lib/contacts` (the server fn) so it never
 * sees client mutations; this is the client-owned equivalent used by the People routes.
 */
export function getContactDetailClient(id: string): ContactDetail | null {
  const { contacts } = useDataStore.getState()
  const contact = contacts.get(id)
  if (!contact) return null

  // Linked properties → their listings (deduped by listing id).
  const seen = new Set<string>()
  const listings: Listing[] = []
  for (const propertyId of contact.propertyIds) {
    for (const listing of getListingsForProperty(propertyId)) {
      if (!seen.has(listing.id)) {
        seen.add(listing.id)
        listings.push(listing)
      }
    }
  }

  const deals: DealSummary[] = listings.map((l) => ({
    id: l.id,
    name: l.name,
    city: l.city,
    state: l.state,
    status: l.status,
    dealType: l.dealType,
    planTotal: l.tasks.length,
    planDone: l.tasks.filter((t) => t.status === 'complete').length,
    leadName: l.internalBrokers[0]?.name ?? contact.assignedTo,
  }))

  const openTaskCount = listings.reduce(
    (n, l) =>
      n + l.tasks.filter((t) => t.status === 'open' || t.status === 'overdue').length,
    0,
  )

  return { contact, deals, openTaskCount }
}

/** Simple case-insensitive omnisearch over the in-memory world. */
export function searchAll(query: string): {
  properties: Property[]
  deals: Listing[]
  contacts: Contact[]
} {
  const q = query.trim().toLowerCase()
  const { properties, listings, contacts } = useDataStore.getState()
  if (!q) return { properties: [], deals: [], contacts: [] }
  return {
    properties: [...properties.values()].filter((p) =>
      [p.street, p.city, p.state].filter(Boolean).join(' ').toLowerCase().includes(q),
    ),
    deals: [...listings.values()].filter((l) => l.name.toLowerCase().includes(q)),
    contacts: [...contacts.values()].filter((c) =>
      `${c.firstName} ${c.lastName} ${c.company}`.toLowerCase().includes(q),
    ),
  }
}
