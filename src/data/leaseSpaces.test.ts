import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { getProperty, getListing } from './store'
import {
  addPropertyUnit, addSpaceToDeal, resyncChildFromParent,
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

  it('snapshots the parent template and re-syncs on demand', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 200', sqft: 1000, unitType: 'retail' })!
    // Parent gets a template.
    commitStageTransition({ dealId: parent.id, targetStage: 'proposal', actor: 'T', marketing: { leaseTitle: 'Mall Brand' } })
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(child.marketing.leaseTitle).toBe('Mall Brand')
    // Parent template changes after the child was created.
    commitStageTransition({ dealId: parent.id, targetStage: 'proposal', actor: 'T', marketing: { leaseTitle: 'Mall Rebrand' } })
    expect(getListing(child.id)!.marketing.leaseTitle).toBe('Mall Brand') // snapshot, unchanged
    resyncChildFromParent(child.id)
    expect(getListing(child.id)!.marketing.leaseTitle).toBe('Mall Rebrand') // re-pulled
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
