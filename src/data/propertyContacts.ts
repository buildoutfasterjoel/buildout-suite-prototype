import type {
  Contact,
  ContactRole,
  Listing,
  PropertyContactLink,
  PropertyContactRole,
} from './types'
import { getStore } from './store'

/** Buildout's role list, in its dropdown order. */
export const PROPERTY_CONTACT_ROLES: PropertyContactRole[] = [
  'owner-landlord',
  'owner-agent',
  'owner-contact',
  'owner-user',
  'tenant',
  'tenant-contact',
  'tenant-agent',
  'buyer',
  'lender',
  'other',
]

export const PROPERTY_CONTACT_ROLE_LABELS: Record<PropertyContactRole, string> = {
  'owner-landlord': 'Owner / Landlord',
  'owner-agent': 'Owner Agent',
  'owner-contact': 'Owner Contact',
  'owner-user': 'Owner / User',
  tenant: 'Tenant',
  'tenant-contact': 'Tenant Contact',
  'tenant-agent': 'Tenant Agent',
  buyer: 'Buyer',
  lender: 'Lender',
  other: 'Other',
}

/** Roles that describe the building, and so hold for every space on it. */
export const BUILDING_LEVEL_ROLES: ReadonlySet<PropertyContactRole> = new Set([
  'owner-landlord',
  'owner-agent',
  'owner-contact',
  'owner-user',
  'lender',
])

/** Roles that describe one suite, and so attach to a unit rather than the building. */
export const SPACE_LEVEL_ROLES: PropertyContactRole[] = ['tenant', 'tenant-contact', 'tenant-agent']

export function isBuildingLevelRole(role: PropertyContactRole): boolean {
  return BUILDING_LEVEL_ROLES.has(role)
}

/**
 * The property role a contact with no explicit link reads as, from the role it
 * carries in the broker's book. Seeded contacts have `propertyIds` and no
 * `propertyLinks`; this is what keeps them on the property page with a
 * sensible word beside them.
 */
export function defaultPropertyRole(role: ContactRole): PropertyContactRole {
  switch (role) {
    case 'owner':
      return 'owner-landlord'
    case 'tenant':
      return 'tenant'
    case 'buyer':
      return 'buyer'
    case 'lender':
      return 'lender'
    case 'broker':
      return 'owner-agent'
  }
}

/** The book-level role a newly created contact gets from the property role it is added with. */
export function contactRoleFor(role: PropertyContactRole): ContactRole {
  if (role.startsWith('owner')) return 'owner'
  if (role.startsWith('tenant')) return 'tenant'
  if (role === 'buyer') return 'buyer'
  if (role === 'lender') return 'lender'
  return 'owner'
}

/**
 * Every property link a contact has, explicit or derived. A contact whose
 * `propertyIds` name a property no link covers reads as attached to the
 * building with `defaultPropertyRole(contact.role)`.
 */
export function propertyLinksFor(contact: Contact): PropertyContactLink[] {
  const explicit = contact.propertyLinks ?? []
  const covered = new Set(explicit.map((l) => l.propertyId))
  const derived = contact.propertyIds
    .filter((id) => !covered.has(id))
    .map((propertyId): PropertyContactLink => ({
      propertyId,
      role: defaultPropertyRole(contact.role),
      unitId: null,
    }))
  return [...explicit, ...derived]
}

export interface PropertyContactRow {
  contact: Contact
  role: PropertyContactRole
  /** The space the link is to, when it is to one. */
  unitId: string | null
}

/**
 * The property's contacts, one row per contact. A contact linked both to the
 * building and to a suite shows its building-level link; one linked only to a
 * suite shows that link, unit and all — the tenant of Suite 300 is a contact of
 * the building too.
 */
export function propertyContactRows(propertyId: string): PropertyContactRow[] {
  const rows: PropertyContactRow[] = []
  for (const contact of getStore().contacts.values()) {
    const links = propertyLinksFor(contact).filter((l) => l.propertyId === propertyId)
    if (links.length === 0) continue
    const link = links.find((l) => !l.unitId) ?? links[0]
    rows.push({ contact, role: link.role, unitId: link.unitId ?? null })
  }
  return rows
}

export type SpaceContactSource = 'space' | 'property' | 'deal'

export interface SpaceContactRow extends PropertyContactRow {
  /** Where the row comes from: the suite's own link, inherited from the building, or the deal's tenant party. */
  source: SpaceContactSource
}

/**
 * A space's contacts:
 *
 * - links to **this unit** — the suite's own tenant-side people;
 * - **inherited** building-level links — owner-side roles hold for every space;
 * - the child **deal's tenant party**, when the deal names one the unit does not
 *   yet link, so a suite under contract shows its tenant before anyone has
 *   attached them to the unit.
 *
 * A building-level `buyer` is not inherited: buying is a deal fact, and a
 * space has no buyer. Deal sellers are not surfaced either — on a lease shell
 * they are the landlord, who is already the building's owner-side contact.
 */
export function spaceContactRows(
  propertyId: string,
  unitId: string,
  deal: Listing | null = null,
): SpaceContactRow[] {
  const rows: SpaceContactRow[] = []
  const seen = new Set<string>()
  for (const contact of getStore().contacts.values()) {
    const links = propertyLinksFor(contact).filter((l) => l.propertyId === propertyId)
    const own = links.find((l) => l.unitId === unitId)
    if (own) {
      rows.push({ contact, role: own.role, unitId, source: 'space' })
      seen.add(contact.id)
      continue
    }
    const inherited = links.find((l) => !l.unitId && isBuildingLevelRole(l.role))
    if (inherited) {
      rows.push({ contact, role: inherited.role, unitId: null, source: 'property' })
      seen.add(contact.id)
    }
  }
  for (const id of deal?.tenantContactIds ?? []) {
    if (seen.has(id)) continue
    const contact = getStore().contacts.get(id)
    if (!contact) continue
    rows.push({ contact, role: 'tenant', unitId, source: 'deal' })
    seen.add(id)
  }
  // Own links first, then inherited, then the deal's — the suite's people lead.
  const rank: Record<SpaceContactSource, number> = { space: 0, deal: 1, property: 2 }
  return rows.sort((a, b) => rank[a.source] - rank[b.source])
}
