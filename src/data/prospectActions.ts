import type { Contact, Property } from './types'
import { addProperty, getContact, getProperty } from './store'
import { useDataStore } from './dataStore'
import { createContact } from './actions'
import { useOwnerCredits, type LookupDepth } from './ownerCredits'
import { getProspectOwnership, type ProspectOwnerContact } from './prospectOwners'

/**
 * The writes behind the prospecting flows. Both entry points — the tile's Add
 * Property CTA and the flyout's Ownership tab — funnel through here, and both
 * are idempotent: a record can be reached either way, and arriving twice must
 * not mint a second copy of the property or the contact.
 */

/** True once the prospect record has been added to the company database. */
export function isInDatabase(propertyId: string): boolean {
  return getProperty(propertyId) !== undefined
}

/**
 * File a prospect record in the company database. Adding a property never
 * creates a deal — the record lands with no stage (see `Property.status`).
 */
export function addProspectProperty(property: Property): Property {
  const existing = getProperty(property.id)
  if (existing) return existing
  const added: Property = { ...property, createdAt: new Date().toISOString() }
  addProperty(added)
  return added
}

/**
 * Unlock a property's owner contacts, spending a credit unless this property
 * was already unlocked. Returns the roster the chosen depth reveals.
 */
export function unlockOwnerContacts(
  property: Property,
  depth: LookupDepth = 'in-depth',
): { contacts: ProspectOwnerContact[]; creditSpent: boolean } {
  const creditSpent = useOwnerCredits.getState().unlock(property.id, depth)
  return { contacts: visibleOwnerContacts(property, depth), creditSpent }
}

/**
 * The roster a lookup at this depth reveals. A quick lookup answers "who owns
 * it and how do I call them" — the owner of record, phone only. An in-depth
 * lookup returns everyone researched at the entity, with emails.
 */
export function visibleOwnerContacts(
  property: Property,
  depth: LookupDepth,
): ProspectOwnerContact[] {
  const all = getProspectOwnership(property).contacts
  if (depth === 'in-depth') return all
  return all.slice(0, 1).map((c) => ({ ...c, emails: [] }))
}

/**
 * Save one researched owner contact to the CRM, associating it with the
 * property — creating the property first if it isn't in the database yet,
 * which is what the Save Contact dialog promises.
 *
 * A prospect contact's id is stable across unlocks, so the already-saved check
 * is exact rather than a name match.
 */
export function saveProspectContact(
  property: Property,
  owner: ProspectOwnerContact,
): { contact: Contact; alreadySaved: boolean } {
  addProspectProperty(property)

  const existing = getContact(owner.id)
  if (existing) return { contact: existing, alreadySaved: true }

  const ownership = getProspectOwnership(property)
  const { contact } = createContact({
    id: owner.id,
    firstName: owner.firstName,
    lastName: owner.lastName,
    title: owner.title,
    company: ownership.ownerType === 'Private' ? '' : ownership.ownerName,
    email: owner.emails[0] ?? '',
    phone: owner.phones[0]?.number ?? '',
    role: 'owner',
    propertyIds: [property.id],
    source: 'Prospect by Buildout',
    tags: ['Prospect'],
    notes: `Owner contact sourced from Buildout Insights for ${property.street}, ${property.city}, ${property.state}.`,
  })

  // They own the building, not merely correspond about it. Recording that on
  // `ownedPropertyIds` too is what puts it in the contact's "Properties Owned"
  // panel rather than only in the deal-derived list.
  setOwnedProperty(contact.id, property.id)
  return { contact: getContact(contact.id) ?? contact, alreadySaved: false }
}

/**
 * Add the property to the database and, when the caller asked for owner data,
 * unlock the owner and save the primary contact in one step. This is the tile
 * CTA's whole flow — the dialog's checkbox is the only branch.
 */
export function addProspectWithOwner(
  property: Property,
  includeOwnerContact: boolean,
): { property: Property; contact: Contact | null; creditSpent: boolean } {
  const added = addProspectProperty(property)
  if (!includeOwnerContact) return { property: added, contact: null, creditSpent: false }

  const { contacts, creditSpent } = unlockOwnerContacts(property)
  const primary = contacts[0]
  if (!primary) return { property: added, contact: null, creditSpent }

  const { contact } = saveProspectContact(property, primary)
  return { property: added, contact, creditSpent }
}

/** Record the property on the contact's owned list, without duplicating it. */
function setOwnedProperty(contactId: string, propertyId: string): void {
  const contact = getContact(contactId)
  if (!contact) return
  const owned = contact.ownedPropertyIds ?? []
  if (owned.includes(propertyId)) return
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contactId, { ...contact, ownedPropertyIds: [...owned, propertyId] })
    return { contacts }
  })
  useDataStore.getState().persist()
}
