import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { getProperty, getListing } from './store'
import {
  addPropertyUnit, addSpaceToDeal,
  getChildDeals, isUmbrella, spacesStageBreakdown,
} from './leaseSpaces'
import { commitStageTransition } from './actions'

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
