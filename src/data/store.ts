import type {
  EntityMaps,
  Listing,
  Property,
  PropertyUnit,
  UnitType,
  Contact,
  PropertyType,
  RelationshipStage,
} from './types'
import type { Email } from './emails'
import { useDataStore } from './dataStore'
import {
  DEFAULT_CONTACT_SHARES,
  TEAMMATES,
  type AccessTier,
  type ContactShare,
} from './teammates'

/** All email campaigns from the live store (seeded mocks + any AI/user drafts). */
export function getEmailsList(): Email[] {
  return [...useDataStore.getState().emails.values()]
}

/** Look up a single campaign by id from the live store. */
export function getEmailById(id: string): Email | undefined {
  return useDataStore.getState().emails.get(id)
}

/** Live view of the four core entity maps from the Zustand store. */
export function getStore(): EntityMaps {
  const { properties, listings, comps, contacts } = useDataStore.getState()
  return { properties, listings, comps, contacts }
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
  useDataStore.setState((s) => {
    const properties = new Map(s.properties)
    properties.set(property.id, property)
    return { properties }
  })
  useDataStore.getState().persist()
}

/** Merge a patch into a stored property (e.g. from an in-editor edit) and return it. */
export function updateProperty(
  propertyId: string,
  patch: Partial<Property>,
): Property | undefined {
  const existing = useDataStore.getState().properties.get(propertyId)
  if (!existing) return undefined
  const updated: Property = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  useDataStore.setState((s) => {
    const properties = new Map(s.properties)
    properties.set(propertyId, updated)
    return { properties }
  })
  useDataStore.getState().persist()
  return updated
}

/** Append a new unit shell to a Property (source of truth) and return the created unit. */
export function addPropertyUnit(
  propertyId: string,
  unit: { label: string; sqft: number; unitType: UnitType },
): PropertyUnit | undefined {
  const existing = getStore().properties.get(propertyId)
  if (!existing) return undefined
  const created: PropertyUnit = {
    id: crypto.randomUUID(),
    label: unit.label,
    unitType: unit.unitType,
    sqft: unit.sqft,
    beds: null,
    baths: null,
    suite: null,
    floor: null,
    ceilingHeight: null,
    offices: null,
    conferenceRooms: null,
    furnished: false,
    saleHistory: [],
  }
  updateProperty(propertyId, { units: [...existing.units, created] })
  return created
}

/** A property picker option — carries `label` (address) plus display metadata. */
export interface PropertyOption {
  value: string
  /** Full address — used for filtering and the input display. */
  label: string
  propertyType: PropertyType
  /** Subtype label, e.g. "Multi-Tenant". */
  subtype: string
  /** Building size, e.g. "45,000 SF", or null when unknown. */
  sizeLabel: string | null
}

/** Rich options for a property picker (address label + type/size metadata). */
export function getPropertyOptions(): PropertyOption[] {
  return [...getStore().properties.values()]
    .map((p) => ({
      value: p.id,
      label: [p.street, p.city, p.state].filter(Boolean).join(', '),
      propertyType: p.propertyType,
      subtype: p.propertySubtype,
      sizeLabel: p.buildingSqFt > 0 ? `${p.buildingSqFt.toLocaleString()} SF` : null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Insert a listing into the in-memory store. */
export function addListing(listing: Listing): void {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    listings.set(listing.id, listing)
    return { listings }
  })
  useDataStore.getState().persist()
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

/** A contact picker option — carries `label` (name · company) plus display metadata. */
export interface ContactOption {
  value: string
  /** "Name · Company" — used for filtering and the input display. */
  label: string
  /** Full name, shown as the option's primary line. */
  name: string
  company: string
  title: string
  /** Relationship stage (client, active, past client, …) surfaced as a pill. */
  relationship: RelationshipStage
}

/** Rich options over all contacts, for a contact picker. */
export function getContactOptions(): ContactOption[] {
  return [...getStore().contacts.values()]
    .map((c) => ({
      value: c.id,
      label: contactLabel(c),
      name: `${c.firstName} ${c.lastName}`.trim(),
      company: c.company,
      title: c.title,
      relationship: c.relationship,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ── Contact sharing ─────────────────────────────────────────────────────────

/**
 * Who has access to a contact. Returns the stored list, or the default seed for
 * a contact that's never been shared explicitly. The default is a single stable
 * reference, so untouched contacts read the same value across renders.
 */
export function getContactShares(contactId: string): ContactShare[] {
  return useDataStore.getState().contactShares.get(contactId) ?? DEFAULT_CONTACT_SHARES
}

function setContactShares(contactId: string, shares: ContactShare[]): void {
  useDataStore.setState((s) => {
    const contactShares = new Map(s.contactShares)
    contactShares.set(contactId, shares)
    return { contactShares }
  })
  useDataStore.getState().persist()
}

/** Grant access to the given members at a tier (skips duplicates). */
export function grantContactShares(
  contactId: string,
  memberIds: string[],
  tier: AccessTier,
): void {
  const next = [...getContactShares(contactId)]
  for (const id of memberIds) {
    const member = TEAMMATES.find((m) => m.id === id)
    if (!member || next.some((s) => s.member.id === id)) continue
    next.push({ member, tier })
  }
  setContactShares(contactId, next)
}

/** Change an existing member's tier. */
export function changeContactShareTier(
  contactId: string,
  memberId: string,
  tier: AccessTier,
): void {
  setContactShares(
    contactId,
    getContactShares(contactId).map((s) =>
      s.member.id === memberId ? { ...s, tier } : s,
    ),
  )
}

/** Revoke a member's access. */
export function revokeContactShare(contactId: string, memberId: string): void {
  setContactShares(
    contactId,
    getContactShares(contactId).filter((s) => s.member.id !== memberId),
  )
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
