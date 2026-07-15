import { describe, expect, it } from 'vitest'
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  type GateFormState,
} from './stageGates'

const emptyForm: GateFormState = {
  buyerLinked: false,
  listedOnDate: null,
  listingExpirationDate: null,
  contractExecutedDate: null,
  closeDate: null,
  salePrice: null,
  commissionAmount: null,
  deadReason: null,
  aiDocsAllReviewed: true,
  websiteReviewed: false,
  unpublishOnExit: true,
  buyerContactId: null,
}

/** A publish gate satisfied on every requirement. */
const readyToPublish: GateFormState = {
  ...emptyForm,
  aiDocsAllReviewed: true,
  websiteReviewed: true,
  listedOnDate: '2026-07-01',
  listingExpirationDate: '2026-12-31',
}

describe('resolveGate', () => {
  it('Pitching → Active is a publishing field gate — attestations + listing dates only', () => {
    const g = resolveGate('proposal', 'active')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(true)
    expect(g.required).toEqual(
      expect.arrayContaining([
        'aiDocsReviewed',
        'websiteReviewed',
        'listedOnDate',
        'listingExpirationDate',
      ]),
    )
    // Seller/Side are captured at creation — the gate must NOT re-require them.
    expect(g.required).not.toContain('sellerLinked')
    expect(g.required).not.toContain('dealSide')
  })

  it('Active → Under Contract requires buyer + economics', () => {
    const g = resolveGate('active', 'under-contract')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(false)
    expect(g.required).toEqual(
      expect.arrayContaining(['buyerLinked', 'salePrice', 'commissionAmount']),
    )
  })

  it('Under Contract → Closed requires only the close date', () => {
    const g = resolveGate('under-contract', 'closed')
    expect(g.kind).toBe('field')
    expect(g.required).toEqual(['closeDate'])
  })

  it('any stage → Lost is a dead gate requiring reason + close date', () => {
    const g = resolveGate('active', 'inactive')
    expect(g.kind).toBe('dead')
    expect(g.required).toEqual(expect.arrayContaining(['deadReason', 'closeDate']))
  })

  it('a backward move is a confirm gate with no required fields', () => {
    const g = resolveGate('under-contract', 'active')
    expect(g.kind).toBe('confirm')
    expect(g.required).toEqual([])
    expect(g.leavesActive).toBe(false)
  })

  it('a backward move OUT of Active flags leavesActive', () => {
    const g = resolveGate('active', 'proposal')
    expect(g.kind).toBe('confirm')
    expect(g.leavesActive).toBe(true)
  })

  it('reopening from Lost into Active runs the publishing field gate', () => {
    const g = resolveGate('inactive', 'active')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(true)
  })
})

describe('canConfirm', () => {
  it('confirm gates are always confirmable', () => {
    expect(canConfirm(resolveGate('under-contract', 'active'), emptyForm)).toBe(true)
  })

  it('the publish gate blocks until docs + website reviewed and dates set', () => {
    const g = resolveGate('proposal', 'active')
    expect(canConfirm(g, emptyForm)).toBe(false)
    expect(canConfirm(g, readyToPublish)).toBe(true)
  })

  it('the AI-doc checklist blocks the publish gate when not all reviewed', () => {
    const g = resolveGate('proposal', 'active')
    expect(canConfirm(g, { ...readyToPublish, aiDocsAllReviewed: false })).toBe(false)
  })

  it('the website attestation blocks the publish gate when unchecked', () => {
    const g = resolveGate('proposal', 'active')
    expect(canConfirm(g, { ...readyToPublish, websiteReviewed: false })).toBe(false)
  })

  it('a missing listing date blocks the publish gate', () => {
    const g = resolveGate('proposal', 'active')
    expect(canConfirm(g, { ...readyToPublish, listingExpirationDate: null })).toBe(false)
  })

  it('Under Contract blocks until buyer + economics are provided', () => {
    const g = resolveGate('active', 'under-contract')
    expect(canConfirm(g, emptyForm)).toBe(false)
    expect(
      canConfirm(g, {
        ...emptyForm,
        buyerLinked: true,
        salePrice: 100,
        commissionAmount: 3,
      }),
    ).toBe(true)
  })
})

describe('buildTransitionInput', () => {
  it('maps a publish gate form to the action input (dates + publish, no seller/side)', () => {
    const g = resolveGate('proposal', 'active')
    const input = buildTransitionInput(g, readyToPublish, 'deal-1', 'Jane Broker')
    expect(input.targetStage).toBe('active')
    expect(input.publish).toBe(true)
    expect(input.transaction).toMatchObject({
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    })
    // Seller/Side are not re-captured by the publish gate.
    expect(input.dealSide).toBeUndefined()
    expect(input.sellerContactId).toBeUndefined()
  })

  it('maps a backward-out-of-Active gate with unpublish selected', () => {
    const g = resolveGate('active', 'proposal')
    const input = buildTransitionInput(g, { ...emptyForm, unpublishOnExit: true }, 'deal-1', 'Jane Broker')
    expect(input.unpublish).toBe(true)
    expect(input.publish).toBeUndefined()
  })
})
