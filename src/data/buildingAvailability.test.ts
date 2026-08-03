import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition } from './actions'
import { buildingAvailability, advertisedAvailability } from './buildingAvailability'

function makeParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('buildingAvailability', () => {
  it('returns one row per child, carrying the child stage as availability', () => {
    const parent = makeParent()
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite A', sqft: 1000, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite B', sqft: 2000, unitType: 'retail' })!
    const childA = addSpaceToDeal(parent.id, a.id)!.deal
    addSpaceToDeal(parent.id, b.id)

    commitStageTransition({
      dealId: childA.id,
      targetStage: 'active',
      actor: 'T',
      marketing: { spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(a.id), leaseRate: 28, leaseTermMonths: 60 }] },
    })

    const rows = buildingAvailability(parent.id)
    expect(rows).toHaveLength(2)

    const rowA = rows.find((r) => r.unitId === a.id)!
    expect(rowA.label).toBe('Suite A')
    expect(rowA.leaseRate).toBe(28)
    expect(rowA.availability).toBe('Available')
    expect(rowA.advertised).toBe(true)

    const rowB = rows.find((r) => r.unitId === b.id)!
    expect(rowB.availability).toBe('Not advertised')
    expect(rowB.advertised).toBe(false)
  })

  it('follows a child into Under Contract with no sync step', () => {
    const parent = makeParent()
    const u = addPropertyUnit(parent.propertyId, { label: 'Suite C', sqft: 800, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, u.id)!.deal
    commitStageTransition({ dealId: child.id, targetStage: 'active', actor: 'T' })
    commitStageTransition({ dealId: child.id, targetStage: 'under-contract', actor: 'T' })
    expect(buildingAvailability(parent.id)[0]!.availability).toBe('Under Contract')
  })

  it('returns nothing for a deal with no children', () => {
    expect(buildingAvailability(makeParent().id)).toEqual([])
  })

  it('hides Draft spaces from the advertised table but keeps them in the manager view', () => {
    const parent = makeParent()
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite D', sqft: 100, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite E', sqft: 200, unitType: 'retail' })!
    const live = addSpaceToDeal(parent.id, a.id)!.deal
    addSpaceToDeal(parent.id, b.id) // stays Draft
    commitStageTransition({ dealId: live.id, targetStage: 'active', actor: 'T' })

    expect(buildingAvailability(parent.id)).toHaveLength(2)
    const advertised = advertisedAvailability(parent.id)
    expect(advertised).toHaveLength(1)
    expect(advertised[0]!.label).toBe('Suite D')
  })
})
