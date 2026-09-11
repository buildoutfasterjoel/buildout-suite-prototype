import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { createContact, linkContactToDeal, linkContactToProperty } from './actions'
import { getContact, getListing } from './store'
import {
  contactRoleFor,
  defaultPropertyRole,
  isBuildingLevelRole,
  propertyContactRows,
  propertyLinksFor,
  spaceContactRows,
} from './propertyContacts'

function makeShellWithUnit() {
  const shell = createProposalListing({ ...emptyDraft(), name: 'Tower', dealType: 'Lease' })
  const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
  return { shell, unit }
}

const person = (first: string, extra: Parameters<typeof createContact>[0] extends infer T ? Partial<T> : never = {}) =>
  createContact({ firstName: first, lastName: 'Test', ...extra }).contact

describe('property links', () => {
  it('reads a legacy contact (ids, no links) as one building-level link per property', () => {
    const { shell } = makeShellWithUnit()
    const c = person('Legacy', { role: 'owner', propertyIds: [shell.propertyId] })
    expect(propertyLinksFor(c)).toEqual([
      { propertyId: shell.propertyId, role: 'owner-landlord', unitId: null },
    ])
  })

  it('maps book roles to property roles and back', () => {
    expect(defaultPropertyRole('owner')).toBe('owner-landlord')
    expect(defaultPropertyRole('broker')).toBe('owner-agent')
    expect(defaultPropertyRole('tenant')).toBe('tenant')
    expect(contactRoleFor('tenant-agent')).toBe('tenant')
    expect(contactRoleFor('owner-user')).toBe('owner')
    expect(isBuildingLevelRole('owner-landlord')).toBe(true)
    expect(isBuildingLevelRole('tenant')).toBe(false)
    expect(isBuildingLevelRole('buyer')).toBe(false)
  })

  it('linkContactToProperty writes the link and keeps propertyIds in step, one link per property+unit', () => {
    const { shell, unit } = makeShellWithUnit()
    const c = person('Linked')
    linkContactToProperty(c.id, { propertyId: shell.propertyId, role: 'owner-agent' })
    linkContactToProperty(c.id, { propertyId: shell.propertyId, role: 'tenant', unitId: unit.id })
    // Re-adding at the building level replaces the role rather than stacking.
    linkContactToProperty(c.id, { propertyId: shell.propertyId, role: 'owner-landlord' })

    const after = getContact(c.id)!
    expect(after.propertyIds).toEqual([shell.propertyId])
    expect(after.propertyLinks).toEqual([
      { propertyId: shell.propertyId, role: 'tenant', unitId: unit.id },
      { propertyId: shell.propertyId, role: 'owner-landlord', unitId: null },
    ])
  })

  it('createContact with propertyLinks fills propertyIds from them', () => {
    const { shell } = makeShellWithUnit()
    const c = person('Fresh', { propertyLinks: [{ propertyId: shell.propertyId, role: 'lender' }] })
    expect(c.propertyIds).toEqual([shell.propertyId])
    expect(propertyContactRows(shell.propertyId).find((r) => r.contact.id === c.id)?.role).toBe('lender')
  })
})

describe('propertyContactRows', () => {
  it('lists one row per contact, preferring the building-level link', () => {
    const { shell, unit } = makeShellWithUnit()
    const both = person('Both')
    linkContactToProperty(both.id, { propertyId: shell.propertyId, role: 'tenant', unitId: unit.id })
    linkContactToProperty(both.id, { propertyId: shell.propertyId, role: 'owner-user' })
    const suiteOnly = person('Suite')
    linkContactToProperty(suiteOnly.id, { propertyId: shell.propertyId, role: 'tenant-agent', unitId: unit.id })

    const rows = propertyContactRows(shell.propertyId)
    expect(rows.find((r) => r.contact.id === both.id)).toMatchObject({ role: 'owner-user', unitId: null })
    expect(rows.find((r) => r.contact.id === suiteOnly.id)).toMatchObject({ role: 'tenant-agent', unitId: unit.id })
  })
})

describe('spaceContactRows', () => {
  it("inherits the building's owner-side contacts, keeps the suite's own, and never inherits a buyer", () => {
    const { shell, unit } = makeShellWithUnit()
    const other = addPropertyUnit(shell.propertyId, { label: 'Suite 200', sqft: 900, unitType: 'office' })!
    const landlord = person('Landlord')
    linkContactToProperty(landlord.id, { propertyId: shell.propertyId, role: 'owner-landlord' })
    const buyer = person('Buyer')
    linkContactToProperty(buyer.id, { propertyId: shell.propertyId, role: 'buyer' })
    const tenant100 = person('Tenant100')
    linkContactToProperty(tenant100.id, { propertyId: shell.propertyId, role: 'tenant', unitId: unit.id })
    const tenant200 = person('Tenant200')
    linkContactToProperty(tenant200.id, { propertyId: shell.propertyId, role: 'tenant', unitId: other.id })

    const rows = spaceContactRows(shell.propertyId, unit.id)
    const byId = (id: string) => rows.find((r) => r.contact.id === id)
    expect(byId(tenant100.id)).toMatchObject({ source: 'space', role: 'tenant' })
    expect(byId(landlord.id)).toMatchObject({ source: 'property', role: 'owner-landlord' })
    expect(byId(buyer.id)).toBeUndefined()
    expect(byId(tenant200.id)).toBeUndefined()
    // The suite's own people lead.
    expect(rows[0].contact.id).toBe(tenant100.id)
  })

  it("surfaces the child deal's tenant party as a tenant when the unit does not link them yet", () => {
    const { shell, unit } = makeShellWithUnit()
    const child = addSpaceToDeal(shell.id, unit.id)!.deal
    const tenant = person('DealTenant')
    linkContactToDeal(child.id, tenant.id, 'tenant')
    // Not on the property at all — only on the deal.
    expect(getContact(tenant.id)!.propertyIds).toEqual([])

    // Re-read the deal: `linkContactToDeal` replaced the stored object.
    const rows = spaceContactRows(shell.propertyId, unit.id, getListing(child.id)!)
    expect(rows.find((r) => r.contact.id === tenant.id)).toMatchObject({ source: 'deal', role: 'tenant' })

    // Once attached to the unit, the unit's own link wins and the deal row is not doubled.
    linkContactToProperty(tenant.id, { propertyId: shell.propertyId, role: 'tenant-contact', unitId: unit.id })
    const again = spaceContactRows(shell.propertyId, unit.id, getListing(child.id)!)
    expect(again.filter((r) => r.contact.id === tenant.id)).toHaveLength(1)
    expect(again.find((r) => r.contact.id === tenant.id)).toMatchObject({ source: 'space', role: 'tenant-contact' })
  })
})
