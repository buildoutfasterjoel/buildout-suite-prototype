import { describe, it, expect } from 'vitest'
import {
  resolveGate,
  fieldSatisfied,
  canConfirm,
  publishReadiness,
  seedGateForm,
  type GateFormState,
} from './stageGates'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { updateDealMarketing, updateDealTransaction } from './actions'
import { dealShape } from './dealShape'

const EMPTY: GateFormState = {
  buyerLinked: false, listedOnDate: null, listingExpirationDate: null,
  contractExecutedDate: null, closeDate: null, salePrice: null,
  commissionAmount: null, commissionPct: null, deadReason: null,
  aiDocsAllReviewed: false, unpublishOnExit: true, buyerContactId: null,
  saleTitle: '', saleDescription: '', askingPrice: null,
  tenantLinked: false, tenantContactId: null,
  leaseRate: null, leaseRateUnits: 'SF/Yr', availableSqFt: null,
  leaseTermMonths: null, leaseCommencementDate: null, shellActive: false,
}

describe('space deal Approve & Publish gate', () => {
  const gate = resolveGate('proposal', 'active', 'Lease', 'space')

  it('gates on the space own numbers plus a live building', () => {
    expect(gate.required).toEqual(['leaseRate', 'availableSqFt', 'leaseTermMonths', 'shellActive'])
  })

  it('does not require property-level fields the space cannot own', () => {
    for (const f of ['saleTitle', 'saleDescription', 'aiDocsReviewed', 'listedOnDate', 'listingExpirationDate']) {
      expect(gate.required).not.toContain(f)
    }
  })

  it('blocks until the shell is Active', () => {
    const priced = { ...EMPTY, leaseRate: 28, availableSqFt: 4200, leaseTermMonths: 60 }
    expect(canConfirm(gate, priced)).toBe(false)
    expect(canConfirm(gate, { ...priced, shellActive: true })).toBe(true)
  })

  it('satisfies shellActive only when true', () => {
    expect(fieldSatisfied('shellActive', EMPTY)).toBe(false)
    expect(fieldSatisfied('shellActive', { ...EMPTY, shellActive: true })).toBe(true)
  })
})

describe('shell Approve & Publish gate', () => {
  const gate = resolveGate('proposal', 'active', 'Lease', 'shell')

  it('gates on the building marketing content only', () => {
    expect(gate.required).toEqual([
      'saleTitle',
      'saleDescription',
      'aiDocsReviewed',
      'listedOnDate',
      'listingExpirationDate',
    ])
  })

  it('never asks a shell for a rate or an available SF it cannot hold', () => {
    expect(gate.required).not.toContain('leaseRate')
    expect(gate.required).not.toContain('availableSqFt')
  })

  it('is satisfiable from the content fields alone', () => {
    const filled: GateFormState = {
      ...EMPTY,
      saleTitle: 'Grandview Commons',
      saleDescription: 'Two-level retail centre on the square.',
      aiDocsAllReviewed: true,
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    expect(canConfirm(gate, filled)).toBe(true)
  })

  /**
   * The regression that killed the whole flow: once every priced row has moved
   * to a child deal the shell holds `spaceLeaseTerms: []`, so a gate that asked
   * for a rate could never be satisfied — and no space could ever publish.
   */
  it('a shell whose terms rows all moved to children can still publish', () => {
    const parent = createProposalListing({
      ...emptyDraft(),
      name: 'Grandview Commons',
      dealType: 'Lease',
    })
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 200',
      sqft: 4200,
      unitType: 'retail',
    })!
    // Price the unit on the parent first, so the row genuinely MOVES on promote.
    updateDealMarketing(parent.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 28 }],
      availableSqFt: 4200,
      leaseTitle: 'Grandview Commons',
      leaseDescription: 'Two-level retail centre on the square.',
    })
    updateDealTransaction(parent.id, {
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    })
    addSpaceToDeal(parent.id, unit.id)

    const shell = getListing(parent.id)!
    expect(dealShape(shell)).toBe('shell')
    expect(shell.marketing.spaceLeaseTerms).toEqual([])

    // Nothing structurally unreachable is left outstanding: the rate and the SF
    // are gone from the requirement list, and the only gap is the doc-review
    // attestation, which the broker ticks inside the modal.
    const readiness = publishReadiness(shell, { shape: 'shell' })
    expect(readiness.missing).not.toContain('leaseRate')
    expect(readiness.missing).not.toContain('availableSqFt')
    expect(readiness.missing).toEqual(['aiDocsReviewed'])

    const gate = resolveGate('proposal', 'active', 'Lease', 'shell')
    const form = seedGateForm(shell)
    expect(canConfirm(gate, form)).toBe(false)
    expect(canConfirm(gate, { ...form, aiDocsAllReviewed: true })).toBe(true)
  })
})

describe('other shapes are unchanged', () => {
  it('leaves a flat lease deal on the original publish gate', () => {
    const g = resolveGate('proposal', 'active', 'Lease', 'flat-lease')
    expect(g.required).toContain('saleTitle')
    expect(g.required).toContain('aiDocsReviewed')
    expect(g.required).toContain('leaseRate')
    expect(g.required).toContain('availableSqFt')
  })

  it('leaves a sale deal on the asking-price publish gate', () => {
    const g = resolveGate('proposal', 'active', 'Sale', 'sale')
    expect(g.required).toContain('askingPrice')
    expect(g.required).not.toContain('leaseRate')
  })

  it('defaults the shape from dealType when the argument is omitted', () => {
    expect(resolveGate('proposal', 'active', 'Lease').required)
      .toEqual(resolveGate('proposal', 'active', 'Lease', 'flat-lease').required)
  })
})
