import { describe, it, expect } from 'vitest'
import { resolveGate, fieldSatisfied, canConfirm, type GateFormState } from './stageGates'

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

describe('other shapes are unchanged', () => {
  it('leaves a flat lease deal on the original publish gate', () => {
    const g = resolveGate('proposal', 'active', 'Lease', 'flat-lease')
    expect(g.required).toContain('saleTitle')
    expect(g.required).toContain('aiDocsReviewed')
    expect(g.required).toContain('leaseRate')
  })

  it('defaults the shape from dealType when the argument is omitted', () => {
    expect(resolveGate('proposal', 'active', 'Lease').required)
      .toEqual(resolveGate('proposal', 'active', 'Lease', 'flat-lease').required)
  })
})
