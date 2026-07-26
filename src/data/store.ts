import type {
  EntityMaps,
  Listing,
  Property,
  PropertyUnit,
  UnitType,
  Contact,
  PropertyType,
  RelationshipStage,
  DealUnderwriting,
  DealDocument,
  DealMessage,
  DealActivity,
} from './types'
import type { Email } from './emails'
import { useDataStore } from './dataStore'
import {
  DEFAULT_CONTACT_SHARES,
  TEAMMATES,
  type AccessTier,
  type ContactShare,
} from './teammates'
import { DEFAULT_STRATEGY, strategyLabel } from '#/components/deals/underwriting/strategies'
import { buildUnderwritingResult } from '#/components/deals/underwriting/underwritingResult'

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

/** Persist a patch to a listing (clone map → setState → persist). */
function patchListing(listingId: string, patch: Partial<Listing>): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  const updated: Listing = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    listings.set(listingId, updated)
    return { listings }
  })
  useDataStore.getState().persist()
  return updated
}

/**
 * Merge a patch into a deal's underwriting record — the AI generation flow
 * uses this to flip status ('generating' → 'ready') and record placement. Seeds
 * a fresh record when the deal had none.
 */
export function updateListingUnderwriting(
  listingId: string,
  patch: Partial<DealUnderwriting>,
): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  const base: DealUnderwriting =
    existing.underwriting ?? {
      strategy: DEFAULT_STRATEGY,
      tier: strategyLabel(DEFAULT_STRATEGY),
      selectedChecks: [],
    }
  return patchListing(listingId, { underwriting: { ...base, ...patch } })
}

/**
 * Compute a deal's underwriting result from its current scope + property and
 * persist it with a fresh timestamp. The single path every entry point uses so
 * the stored result never diverges. Stamps `generatedAt` here (not in the pure
 * builder, which must stay deterministic).
 */
export function generateUnderwritingResult(listingId: string): Listing | undefined {
  const listing = useDataStore.getState().listings.get(listingId)
  if (!listing?.underwriting) return undefined
  const property = getProperty(listing.propertyId)
  const result = buildUnderwritingResult(property, listing.underwriting)
  return updateListingUnderwriting(listingId, {
    result,
    generatedAt: new Date().toISOString(),
  })
}

/** Append a generated document to a deal's context documents (shows in the deal rail). */
export function addDealDocument(listingId: string, doc: DealDocument): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  return patchListing(listingId, { documents: [...(existing.documents ?? []), doc] })
}

/** Append a message to a deal's Messages thread (shows in the Activities-tab rail). */
export function addDealMessage(
  listingId: string,
  message: { author: string; text: string },
): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  const full: DealMessage = {
    id: crypto.randomUUID(),
    author: message.author,
    text: message.text,
    timestamp: new Date().toISOString(),
  }
  return patchListing(listingId, { messages: [...existing.messages, full] })
}

/** Append an activity to a deal's Activities list (shows in the Activities-tab rail). */
export function addDealActivity(
  listingId: string,
  activity: { type: string; note: string; actor: string },
): Listing | undefined {
  const existing = useDataStore.getState().listings.get(listingId)
  if (!existing) return undefined
  const full: DealActivity = {
    id: crypto.randomUUID(),
    type: activity.type,
    note: activity.note,
    actor: activity.actor,
    timestamp: new Date().toISOString(),
  }
  return patchListing(listingId, { activities: [...existing.activities, full] })
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

/**
 * Leads on a property's deals — its linked CRM contacts minus anyone already
 * named as the seller on one of those deals. The assigned seller is the
 * broker's own client, so seeing them listed as an inbound lead reads as a
 * data bug (and on the client report, shows the client to themselves).
 * Property-scoped rather than deal-scoped because child space deals share a
 * property, and a seller on one of them is nobody's lead on the others.
 */
export function getLeadsForProperty(propertyId: string): Contact[] {
  const sellerIds = new Set<string>()
  for (const l of getStore().listings.values()) {
    if (l.propertyId !== propertyId) continue
    for (const id of l.sellerContactIds) sellerIds.add(id)
  }
  return getContactsForProperty(propertyId).filter((c) => !sellerIds.has(c.id))
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

/** Map a Contact to the rich picker option shape. */
function toContactOption(c: Contact): ContactOption {
  return {
    value: c.id,
    label: contactLabel(c),
    name: `${c.firstName} ${c.lastName}`.trim(),
    company: c.company,
    title: c.title,
    relationship: c.relationship,
  }
}

/** Rich options over all contacts, for a contact picker. */
export function getContactOptions(): ContactOption[] {
  return [...getStore().contacts.values()]
    .map(toContactOption)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** A named group of contact options — used to section a picker (leads vs. CRM). */
export interface ContactOptionGroup {
  value: string
  label: string
  items: ContactOption[]
}

/**
 * Buyer/tenant options for the Under Contract gate, grouped so the property's
 * own leads surface first and the rest of the CRM follows — letting the broker
 * either confirm the lead that came in or search the whole book. The deal's own
 * seller isn't a lead, so they fall through to the CRM group. Empty groups are
 * omitted.
 */
export function getSellerOptionGroups(propertyId: string): ContactOptionGroup[] {
  const byName = (a: ContactOption, b: ContactOption) =>
    a.name.localeCompare(b.name)
  const linked = propertyId ? getLeadsForProperty(propertyId) : []
  const linkedIds = new Set(linked.map((c) => c.id))
  const leads = linked.map(toContactOption).sort(byName)
  const others = [...getStore().contacts.values()]
    .filter((c) => !linkedIds.has(c.id))
    .map(toContactOption)
    .sort(byName)
  const groups: ContactOptionGroup[] = []
  if (leads.length > 0)
    groups.push({ value: 'leads', label: 'Leads on this deal', items: leads })
  if (others.length > 0)
    groups.push({ value: 'crm', label: 'All Contacts', items: others })
  return groups
}

/** A deal picker option — the deal's id, display name, and side (Sale/Lease). */
export interface DealOption {
  value: string
  label: string
  dealType: string
}

/** Options over all deals (listings), for a deal picker. Sorted by name. */
export function getDealOptions(): DealOption[] {
  return [...getStore().listings.values()]
    .map((l) => ({ value: l.id, label: l.name, dealType: l.dealType }))
    .sort((a, b) => a.label.localeCompare(b.label))
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
