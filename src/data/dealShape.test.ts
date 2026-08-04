import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition } from './actions'
import { useDataStore } from './dataStore'
import {
  dealShape, availableStages, dealStageLabel, spaceAvailability, gateContext,
  canAddSpaces, isLeaseParent,
} from './dealShape'

function makeLeaseParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('dealShape', () => {
  it('classifies a sale deal as sale', () => {
    const sale = createProposalListing({ ...emptyDraft(), name: 'Tower Sale', dealType: 'Sale' })
    expect(dealShape(sale)).toBe('sale')
  })

  it('classifies a childless lease deal as flat-lease and a parented one as space', () => {
    const parent = makeLeaseParent()
    expect(dealShape(parent)).toBe('flat-lease')
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 2400, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(dealShape(child)).toBe('space')
  })

  it('promotes the parent to shell once a child exists', () => {
    const parent = makeLeaseParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 200', sqft: 1200, unitType: 'retail' })!
    addSpaceToDeal(parent.id, unit.id)
    expect(dealShape(parent)).toBe('shell')
  })
})

describe('availableStages', () => {
  it('caps a shell at Pitching and Active — no Lost, that is a per-space outcome', () => {
    expect(availableStages('shell')).toEqual(['proposal', 'active'])
  })

  it('gives a space deal the full ladder', () => {
    expect(availableStages('space')).toEqual([
      'proposal', 'active', 'under-contract', 'closed', 'inactive',
    ])
  })

  it('leaves sale and flat-lease on the full ladder', () => {
    expect(availableStages('sale')).toEqual(availableStages('space'))
    expect(availableStages('flat-lease')).toEqual(availableStages('space'))
  })

  /**
   * Guards the subscription shape the deal page depends on. A parent's ladder
   * truncates the instant a child exists, but adding a child does not touch the
   * parent's own object — so a component keyed on `listings.get(parentId)` compares
   * referentially equal, skips its re-render, and keeps offering Under Contract and
   * Closed on a deal that can no longer reach them. `$listingId.tsx` subscribes to
   * the whole map for exactly this reason.
   */
  it('truncates the parent ladder on a child insert that leaves the parent object identical', () => {
    const parent = makeLeaseParent()
    expect(availableStages(dealShape(parent))).toHaveLength(5)

    const before = useDataStore.getState().listings
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 300', sqft: 900, unitType: 'office' })!
    addSpaceToDeal(parent.id, unit.id)
    const after = useDataStore.getState().listings

    // The map is replaced; the parent record within it is not.
    expect(after).not.toBe(before)
    expect(after.get(parent.id)).toBe(before.get(parent.id))

    // Yet the ladder it should offer has changed.
    expect(availableStages(dealShape(after.get(parent.id)!))).toEqual([
      'proposal', 'active',
    ])
  })
})

describe('dealStageLabel', () => {
  it('labels proposal Inactive on a space deal', () => {
    expect(dealStageLabel('proposal', 'space')).toBe('Inactive')
  })

  it('labels proposal Pitching everywhere else', () => {
    expect(dealStageLabel('proposal', 'shell')).toBe('Pitching')
    expect(dealStageLabel('proposal', 'sale')).toBe('Pitching')
    expect(dealStageLabel('proposal', 'flat-lease')).toBe('Pitching')
  })

  it('leaves every other stage untouched', () => {
    expect(dealStageLabel('active', 'space')).toBe('Active')
    expect(dealStageLabel('under-contract', 'space')).toBe('Under Contract')
    expect(dealStageLabel('closed', 'space')).toBe('Closed')
    expect(dealStageLabel('inactive', 'space')).toBe('Lost')
  })
})

describe('spaceAvailability', () => {
  it('maps a child stage to what the building advertises', () => {
    expect(spaceAvailability('proposal')).toBe('Not advertised')
    expect(spaceAvailability('active')).toBe('Available')
    expect(spaceAvailability('under-contract')).toBe('Under Contract')
    expect(spaceAvailability('closed')).toBe('Leased')
    expect(spaceAvailability('inactive')).toBe('Not advertised')
  })
})

describe('gateContext', () => {
  it('reports the shell as inactive until the building is live', () => {
    const parent = makeLeaseParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 500', sqft: 700, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(gateContext(child)).toEqual({ shape: 'space', shellActive: false })

    commitStageTransition({ dealId: parent.id, targetStage: 'active', actor: 'T' })
    expect(gateContext(child).shellActive).toBe(true)
  })
})

describe('isLeaseParent', () => {
  it('is true for a flat lease deal and stays true once it becomes a shell', () => {
    const parent = makeLeaseParent()
    expect(isLeaseParent(parent)).toBe(true)
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 300', sqft: 900, unitType: 'retail' })!
    addSpaceToDeal(parent.id, unit.id)
    expect(dealShape(parent)).toBe('shell')
    expect(isLeaseParent(parent)).toBe(true)
  })

  it('is false for a space deal and for a sale deal', () => {
    const parent = makeLeaseParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 400', sqft: 900, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(isLeaseParent(child)).toBe(false)
    expect(isLeaseParent({ ...parent, dealType: 'Sale' })).toBe(false)
  })

  it('is false for a missing deal, so callers need no null dance', () => {
    expect(isLeaseParent(undefined)).toBe(false)
    expect(isLeaseParent(null)).toBe(false)
  })

  it('stays true for a Lost shell — the tab survives, only the button goes', () => {
    const parent = makeLeaseParent()
    const lost = { ...parent, status: 'inactive' as const }
    expect(isLeaseParent(lost)).toBe(true)
    expect(canAddSpaces(lost)).toBe(false)
  })
})

describe('canAddSpaces', () => {
  it('allows Pitching and Active lease parents', () => {
    const parent = makeLeaseParent()
    expect(canAddSpaces(parent)).toBe(true)
    expect(canAddSpaces({ ...parent, status: 'active' })).toBe(true)
  })

  it('blocks a deal already past Active, a space deal, and a sale deal', () => {
    const parent = makeLeaseParent()
    expect(canAddSpaces({ ...parent, status: 'under-contract' })).toBe(false)
    expect(canAddSpaces({ ...parent, status: 'closed' })).toBe(false)
    expect(canAddSpaces({ ...parent, parentDealId: 'p1' })).toBe(false)
    expect(canAddSpaces({ ...parent, dealType: 'Sale' })).toBe(false)
  })

  it('blocks a tenant-rep lease deal — the split is a landlord-rep concept', () => {
    const parent = makeLeaseParent()
    expect(parent.dealSide).toBe('seller')
    expect(canAddSpaces({ ...parent, dealSide: 'buyer' })).toBe(false)
    expect(canAddSpaces({ ...parent, dealSide: 'buyer', status: 'active' })).toBe(false)
  })
})
