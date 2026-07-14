import { useDataStore } from './dataStore'
import type { Comp, Contact, ContactDetail, DealSummary, Listing, Property, PropertyDetail, PropertyFinancialRecord, PropertyUnit } from './types'
import { getContactsForProperty, getOwnersForProperty } from './store'

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
 * store so it always reflects client mutations. Used by the People routes.
 */
export function getContactDetailClient(id: string): ContactDetail | null {
  const { contacts } = useDataStore.getState()
  const contact = contacts.get(id)
  if (!contact) return null

  // The deals a contact is a direct party to (seller/buyer/other) — the single
  // source of truth for the contact↔deal relationship. Reciprocal with the deal
  // detail page: every deal shown here lists this contact back among its parties.
  const listings: Listing[] = listDealsForContact(id)

  const deals: DealSummary[] = listings.map((l) => {
    const property = useDataStore.getState().properties.get(l.propertyId)
    return {
      id: l.id,
      name: l.name,
      city: property?.city ?? '',
      state: property?.state ?? '',
      status: l.status,
      dealType: l.dealType,
      planTotal: l.tasks.length,
      planDone: l.tasks.filter((t) => t.status === 'complete').length,
      leadName: l.internalBrokers[0]?.name ?? contact.assignedTo,
    }
  })

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
  const matches = (...fields: Array<string | null | undefined>) =>
    fields.filter(Boolean).join(' ').toLowerCase().includes(q)
  return {
    properties: [...properties.values()].filter((p) =>
      matches(p.name, p.street, p.city, p.state, p.zip, p.submarket, p.propertyType, p.apn),
    ),
    deals: [...listings.values()].filter((l) => {
      const p = properties.get(l.propertyId)
      return matches(l.name, p?.city, p?.state, l.dealType)
    }),
    contacts: [...contacts.values()].filter((c) =>
      matches(c.firstName, c.lastName, c.company, c.email, c.title, c.phone),
    ),
  }
}

/** All comps recorded against a property. */
export function listCompsForProperty(propertyId: string): Comp[] {
  const { comps } = useDataStore.getState()
  return [...comps.values()].filter((c) => c.propertyId === propertyId)
}

/**
 * Everything the property record page needs, assembled client-side from the live
 * store so it always reflects client mutations. Property analogue of
 * {@link getContactDetailClient}.
 */
export function getPropertyDetailClient(id: string): PropertyDetail | null {
  const { properties } = useDataStore.getState()
  const property = properties.get(id)
  if (!property) return null
  return {
    property,
    deals: listDealsForProperty(id),
    owners: getOwnersForProperty(id),
    contacts: getContactsForProperty(id),
    comps: listCompsForProperty(id),
  }
}

/** The current (newest) in-place financial record for a property, or undefined if none. */
export function latestFinancialRecord(property: Property): PropertyFinancialRecord | undefined {
  return property.financialRecords[0]
}

/**
 * Resolve a deal together with the property facts it references. Deals hold no
 * property data of their own — views join through `propertyId` (+ optional `unitId`).
 */
export function selectDealWithProperty(dealId: string):
  | { deal: Listing; property: Property | undefined; unit: PropertyUnit | undefined }
  | undefined {
  const { listings, properties } = useDataStore.getState()
  const deal = listings.get(dealId)
  if (!deal) return undefined
  const property = properties.get(deal.propertyId)
  const unit = deal.unitId && property ? property.units.find((u) => u.id === deal.unitId) : undefined
  return { deal, property, unit }
}
