import type { Property } from './types'
import { hash, pickFor, oneIn, spread } from '#/components/properties/propertyDisplay'

/**
 * Owner intelligence behind a Buildout Insights record.
 *
 * Two tiers, and the split is what the credit buys. The *ownership* tier —
 * who owns it, from what address, how much they hold — comes from public
 * records and is free to read. The *contact* tier — names, phones, emails — is
 * the researched part, and stays hidden until the property's owner is
 * unlocked (see `ownerCredits.ts`).
 *
 * Everything here is derived from the property id, so the same record always
 * resolves to the same owner: unlocking twice can't produce a different person,
 * and a contact saved to the CRM keeps a stable id.
 */

const FIRST_NAMES = [
  'Mark', 'Jason', 'Ben', 'Tim', 'Ted', 'Adam', 'Mary', 'Carol', 'Dennis',
  'Alicia', 'Ruth', 'Owen', 'Priya', 'Marcus', 'Elena', 'Grant', 'Nadia',
  'Curtis', 'Yvonne', 'Hector',
]

const LAST_NAMES = [
  'Schaffer', 'Trafzer', 'Knoll', 'Mann', 'Weaver', 'Caldwell', 'Okafor',
  'Lindqvist', 'Barrera', 'Whitfield', 'Nakamura', 'Delacroix', 'Ferris',
  'Abernathy', 'Solano', 'Kingsley',
]

const OWNER_TYPES = ['Private', 'Company', 'Trust', 'REIT'] as const
export type OwnerType = (typeof OWNER_TYPES)[number]

/**
 * What an owning entity files under, per type. Keyed by owner type rather than
 * drawn from one pool because the two fields sit side by side on the Ownership
 * tab — a "Trust" named Capital Partners reads as generated data.
 */
const ENTITY_SUFFIXES: Record<Exclude<OwnerType, 'Private'>, string[]> = {
  Company: ['Holdings LLC', 'Properties LP', 'Capital Partners', 'Realty Group', 'Investments LLC'],
  Trust: ['Family Trust', 'Living Trust', 'Legacy Trust'],
  REIT: ['Realty Trust', 'Income REIT', 'Property Trust'],
}

const PHONE_LABELS = ['Mobile', 'Office', 'Direct', 'Home'] as const

export interface ProspectPhone {
  number: string
  label: string
}

export interface ProspectOwnerContact {
  /** Stable across unlocks — becomes the CRM contact's id when saved. */
  id: string
  firstName: string
  lastName: string
  title: string
  phones: ProspectPhone[]
  emails: string[]
  /**
   * Researched rather than filed. Public records name the owner; everyone
   * else on the list was inferred, and the UI labels them as such.
   */
  aiSourced: boolean
}

export interface ProspectOwnership {
  ownerName: string
  ownerType: OwnerType
  ownerOccupied: boolean
  ownerAddress: string
  /** Properties this owner holds nationally, including this one. */
  portfolioCount: number
  totalAssessedValue: number
  propertyTypes: string[]
  /** Related operating company found at the same address, if any. */
  relatedCompany: { name: string; url: string; note: string } | null
  /** Hidden until the owner is unlocked. */
  contacts: ProspectOwnerContact[]
}

function phoneFor(id: string, field: string): string {
  const h = hash(`${id}#${field}`)
  const area = 200 + (h % 700)
  const exch = 200 + ((h >>> 7) % 700)
  const line = (h >>> 14) % 10000
  return `${area}.${String(exch).padStart(3, '0')}.${String(line).padStart(4, '0')}`
}

function emailFor(first: string, last: string, domain: string): string {
  return `${first}.${last}@${domain}`.toLowerCase()
}

function contactFor(property: Property, index: number, ownerDomain: string): ProspectOwnerContact {
  const salt = `owner-${index}`
  const firstName = pickFor(FIRST_NAMES, property.id, `${salt}-first`)
  const lastName =
    // The owning family tends to repeat — the first two contacts share a
    // surname often enough that a roster of unrelated names reads as fake.
    index < 2
      ? pickFor(LAST_NAMES, property.id, 'owner-surname')
      : pickFor(LAST_NAMES, property.id, `${salt}-last`)

  const phoneCount = oneIn(4, property.id, `${salt}-phones`) ? 2 : 1
  const phones = Array.from({ length: phoneCount }, (_, i) => ({
    number: phoneFor(property.id, `${salt}-phone-${i}`),
    label: pickFor(PHONE_LABELS, property.id, `${salt}-phone-label-${i}`),
  }))

  // Most researched contacts surface a phone and nothing else — that gap is
  // the honest shape of this data, and the roster shouldn't hide it.
  const hasEmail = index === 0 || oneIn(3, property.id, `${salt}-email`)

  return {
    id: `prospect-contact-${property.id}-${index}`,
    firstName,
    lastName,
    title: pickFor(
      ['Owner', 'Managing Member', 'Principal', 'Partner', 'Trustee'],
      property.id,
      `${salt}-title`,
    ),
    phones,
    emails: hasEmail ? [emailFor(firstName, lastName, ownerDomain)] : [],
    aiSourced: index > 0 || oneIn(2, property.id, 'primary-ai'),
  }
}

export function getProspectOwnership(property: Property): ProspectOwnership {
  const ownerType = pickFor(OWNER_TYPES, property.id, 'owner-type')
  const surname = pickFor(LAST_NAMES, property.id, 'owner-surname')
  const firstName = pickFor(FIRST_NAMES, property.id, 'owner-0-first')

  const ownerName =
    ownerType === 'Private'
      ? `${firstName} ${surname}`
      : `${surname} ${pickFor(ENTITY_SUFFIXES[ownerType], property.id, 'owner-suffix')}`

  const domain = `${surname.toLowerCase()}${ownerType === 'Private' ? 'mail' : 'group'}.com`

  const portfolioCount = 1 + spread(hash(`${property.id}#portfolio`), 30)
  const contactCount = 2 + spread(hash(`${property.id}#contact-count`), 6)

  // A portfolio owner's other holdings are assessed in the same ballpark as
  // this one, so the national total tracks the record you're looking at.
  const totalAssessedValue = property.assessedTaxValue * portfolioCount

  const secondaryType = pickFor(
    ['Multifamily', 'Land', 'Retail', 'Industrial', 'Office'],
    property.id,
    'owner-second-type',
  )
  const primaryType = property.propertySubtype
  const propertyTypes =
    portfolioCount > 3 && secondaryType !== primaryType
      ? [primaryType, secondaryType]
      : [primaryType]

  const relatedCompany = oneIn(2, property.id, 'related-company')
    ? {
        name: `${surname} ${pickFor(['Design Engineering', 'Construction', 'Property Management', 'Development'], property.id, 'related-kind')}`,
        url: `http://www.${surname.toLowerCase()}co.com`,
        note: `Operates at the same address as ${ownerName}, indicating a tenant relationship.`,
      }
    : null

  return {
    ownerName,
    ownerType,
    ownerOccupied: oneIn(3, property.id, 'owner-occupied'),
    ownerAddress: `${1000 + spread(hash(`${property.id}#owner-street-no`), 8000)} ${pickFor(['Old State Rd N', 'Ridgeway Ave', 'Commerce Dr', 'Lakeshore Blvd', 'Church St'], property.id, 'owner-street')}, ${property.city}, ${property.state} ${property.zip}`,
    portfolioCount,
    totalAssessedValue,
    propertyTypes,
    relatedCompany,
    contacts: Array.from({ length: contactCount }, (_, i) =>
      contactFor(property, i, domain),
    ),
  }
}

/** Display name for an owner contact. */
export function ownerContactName(c: ProspectOwnerContact): string {
  return `${c.firstName} ${c.lastName}`
}
