import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { saveSpaceDetails } from './actions'
import { getListing, getProperty, updatePropertyUnit } from './store'
import { propertySpaces } from './propertySpaces'

function makeSpace() {
  const shell = createProposalListing({ ...emptyDraft(), name: 'Tower', dealType: 'Lease' })
  const unit = addPropertyUnit(shell.propertyId, {
    label: 'Suite 100',
    sqft: 1000,
    unitType: 'office',
    suite: '100',
    floor: 1,
  })!
  const space = addSpaceToDeal(shell.id, unit.id)!.deal
  return { shell, unit, space }
}

const unitOf = (propertyId: string, unitId: string) =>
  getProperty(propertyId)!.units.find((u) => u.id === unitId)!

describe('updatePropertyUnit', () => {
  it('patches only the named unit and keeps its id', () => {
    const { shell, unit } = makeSpace()
    const other = addPropertyUnit(shell.propertyId, { label: 'Suite 200', sqft: 500, unitType: 'office' })!
    const updated = updatePropertyUnit(shell.propertyId, unit.id, { floor: 7, id: 'ignored' } as never)!
    expect(updated.id).toBe(unit.id)
    expect(updated.floor).toBe(7)
    expect(unitOf(shell.propertyId, other.id).floor).toBeNull()
  })

  it('returns undefined for an unknown unit', () => {
    const { shell } = makeSpace()
    expect(updatePropertyUnit(shell.propertyId, 'nope', { floor: 1 })).toBeUndefined()
  })
})

describe('saveSpaceDetails', () => {
  it('writes physical facts through to the unit as well as the terms row', () => {
    const { shell, unit, space } = makeSpace()
    const terms = space.marketing.spaceLeaseTerms![0]
    saveSpaceDetails(space.id, {
      terms: { ...terms, ceilingHeight: 14, floor: 3, suite: ' 300 ', offices: 4, conferenceRooms: 2, furnished: true },
      availableSqFt: 950,
    })

    const deal = getListing(space.id)!
    expect(deal.marketing.spaceLeaseTerms![0].ceilingHeight).toBe(14)
    expect(deal.marketing.availableSqFt).toBe(950)

    const u = unitOf(shell.propertyId, unit.id)
    expect(u.ceilingHeight).toBe(14)
    expect(u.floor).toBe(3)
    expect(u.suite).toBe('300')
    expect(u.offices).toBe(4)
    expect(u.conferenceRooms).toBe(2)
    expect(u.furnished).toBe(true)

    // The asset roster sees the new value without any other write.
    expect(propertySpaces(shell.propertyId)[0].floor).toBe(3)
  })

  it('leaves the unit alone for commercial terms and display overrides', () => {
    const { shell, unit, space } = makeSpace()
    const before = unitOf(shell.propertyId, unit.id)
    const terms = space.marketing.spaceLeaseTerms![0]
    saveSpaceDetails(space.id, {
      terms: { ...terms, leaseRate: 52, spaceName: 'The Corner Suite', tenantName: 'Acme' },
      availableSqFt: 1000,
    })
    const after = unitOf(shell.propertyId, unit.id)
    expect(after.label).toBe(before.label)
    expect(after.tenantName).toBe(before.tenantName)
    expect(after.sqft).toBe(before.sqft)
    // The physical keys the form did not change round-trip unchanged too.
    expect(after.floor).toBe(before.floor)
    expect(after.suite).toBe(before.suite)
  })

  it('clears a cleared size to 0, the value the publish gate reads as unmet', () => {
    const { space } = makeSpace()
    saveSpaceDetails(space.id, { terms: space.marketing.spaceLeaseTerms![0], availableSqFt: null })
    expect(getListing(space.id)!.marketing.availableSqFt).toBe(0)
  })
})
