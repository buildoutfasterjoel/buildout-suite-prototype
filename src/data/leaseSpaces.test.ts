import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { getProperty, getListing, updateProperty } from './store'
import {
  addPropertyUnit, addSpaceToDeal,
  getChildDeals, isUmbrella, spacesStageBreakdown,
} from './leaseSpaces'
import { commitStageTransition, updateDealMarketing } from './actions'

function makeParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('lease space actions', () => {
  it('writes a new unit back to the property and spawns a bound child', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 2400, unitType: 'retail' })!
    expect(getProperty(parent.propertyId)!.units.some((u) => u.id === unit.id)).toBe(true)

    const res = addSpaceToDeal(parent.id, unit.id)!
    expect(res.deal.parentDealId).toBe(parent.id)
    expect(res.deal.unitId).toBe(unit.id)
    expect(res.deal.status).toBe('proposal')
    expect(res.deal.publishedAt).toBeNull()
    expect(res.deal.marketing.spaceLeaseTerms[0]?.unitId).toBe(unit.id)
    expect(isUmbrella(parent.id)).toBe(true)
    expect(getChildDeals(parent.id).map((c) => c.id)).toContain(res.deal.id)
  })

  it('moves the parent existing terms row onto the child', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 300', sqft: 3000, unitType: 'retail' })!
    // Broker priced the suite on the parent before promoting it.
    commitStageTransition({
      dealId: parent.id,
      targetStage: 'proposal',
      actor: 'T',
      marketing: {
        spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 28, leaseTermMonths: 60 }],
      },
    })

    const child = addSpaceToDeal(parent.id, unit.id)!.deal

    // The row moved to the child, carrying its numbers.
    expect(child.marketing.spaceLeaseTerms).toHaveLength(1)
    expect(child.marketing.spaceLeaseTerms[0]!.leaseRate).toBe(28)
    expect(child.marketing.spaceLeaseTerms[0]!.leaseTermMonths).toBe(60)
    // And is gone from the parent, so there is one editable home per unit.
    expect(getListing(parent.id)!.marketing.spaceLeaseTerms.some((t) => t.unitId === unit.id)).toBe(false)
  })

  it('seeds a blank row when the parent never priced the unit', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 400', sqft: 900, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(child.marketing.spaceLeaseTerms[0]!.unitId).toBe(unit.id)
    expect(child.marketing.spaceLeaseTerms[0]!.leaseRate).toBeNull()
  })

  it('rolls up child stages', () => {
    const parent = makeParent()
    const u1 = addPropertyUnit(parent.propertyId, { label: 'A', sqft: 500, unitType: 'retail' })!
    const u2 = addPropertyUnit(parent.propertyId, { label: 'B', sqft: 500, unitType: 'retail' })!
    const c1 = addSpaceToDeal(parent.id, u1.id)!.deal
    addSpaceToDeal(parent.id, u2.id)
    commitStageTransition({ dealId: c1.id, targetStage: 'active', actor: 'T' })
    const rollup = spacesStageBreakdown(parent.id)
    expect(rollup.total).toBe(2)
    expect(rollup.byStage.active).toBe(1)
    expect(rollup.byStage.proposal).toBe(1)
  })
})

/**
 * A broker opening a brand-new space should not have to retype what the building
 * already knows about that unit. The physical facts live on `PropertyUnit`, so the
 * space's terms row starts from them.
 *
 * Space *type* is deliberately not seeded: `UnitType` is a coarse category
 * ('office', 'retail') while `spaceType` is a fine-grained subtype ('Medical',
 * 'Strip Center'), so deriving one from the other would be inventing a judgement
 * that belongs to the broker.
 */
describe('a new space inherits what its unit already knows', () => {
  it('seeds the terms row from the unit physical facts', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 300', sqft: 2600, unitType: 'office',
    })!
    // Fill in what a seeded building would already carry for a suite. Re-read the
    // property AFTER adding the unit — mapping a stale copy would write the new
    // unit back out of existence.
    const property = getProperty(parent.propertyId)!
    updateProperty(property.id, {
      units: property.units.map((u) =>
        u.id === unit.id
          ? { ...u, suite: '300', floor: 3, ceilingHeight: 12, offices: 4, conferenceRooms: 1, furnished: true }
          : u,
      ),
    })

    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    const terms = child.marketing.spaceLeaseTerms[0]!

    expect(terms.spaceName).toBe('Suite 300')
    expect(terms.suite).toBe('300')
    expect(terms.floor).toBe(3)
    expect(terms.ceilingHeight).toBe(12)
    expect(terms.offices).toBe(4)
    expect(terms.conferenceRooms).toBe(1)
    expect(terms.furnished).toBe(true)
    // The size itself is not on the terms row — it is the space's own marketing.
    expect(child.marketing.availableSqFt).toBe(2600)
  })

  it('leaves a row the broker already priced on the parent untouched', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 400', sqft: 1800, unitType: 'retail',
    })!
    // Priced on the parent first — that row MOVES to the child as authored.
    updateDealMarketing(parent.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 31, spaceName: 'Corner unit' }],
    })

    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    const terms = child.marketing.spaceLeaseTerms[0]!
    expect(terms.leaseRate).toBe(31)
    expect(terms.spaceName).toBe('Corner unit')
  })
})
