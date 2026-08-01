import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition } from './actions'
import {
  dealShape, availableStages, dealStageLabel, spaceAvailability, gateContext, canAddSpaces,
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
  it('caps a shell at Pitching, Active, Lost', () => {
    expect(availableStages('shell')).toEqual(['proposal', 'active', 'inactive'])
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
})

describe('dealStageLabel', () => {
  it('labels proposal Draft on a space deal', () => {
    expect(dealStageLabel('proposal', 'space')).toBe('Draft')
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
})
