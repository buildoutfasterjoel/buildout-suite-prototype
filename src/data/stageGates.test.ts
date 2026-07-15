import { describe, expect, it } from 'vitest'
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  type GateFormState,
} from './stageGates'

const emptyForm: GateFormState = {
  sellerLinked: false,
  buyerLinked: false,
  dealSide: null,
  listedOnDate: null,
  listingExpirationDate: null,
  contractExecutedDate: null,
  closeDate: null,
  salePrice: null,
  commissionAmount: null,
  deadReason: null,
  aiDocsAllReviewed: true,
  sellerConfirmed: false,
  unpublishOnExit: true,
  sellerContactId: null,
  buyerContactId: null,
}

describe('resolveGate', () => {
  it('Pitching → Active is a publishing field gate', () => {
    const g = resolveGate('proposal', 'active')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(true)
    expect(g.required).toEqual(
      expect.arrayContaining([
        'sellerConfirmed',
        'aiDocsReviewed',
        'sellerLinked',
        'dealSide',
        'listedOnDate',
        'listingExpirationDate',
      ]),
    )
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

  it('a field gate blocks until all required fields are satisfied', () => {
    const g = resolveGate('proposal', 'active')
    expect(canConfirm(g, emptyForm)).toBe(false)
    const filled: GateFormState = {
      ...emptyForm,
      sellerConfirmed: true,
      aiDocsAllReviewed: true,
      sellerLinked: true,
      dealSide: 'seller',
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    expect(canConfirm(g, filled)).toBe(true)
  })

  it('the AI-doc checklist blocks the publish gate when not all reviewed', () => {
    const g = resolveGate('proposal', 'active')
    const filled: GateFormState = {
      ...emptyForm,
      sellerConfirmed: true,
      sellerLinked: true,
      dealSide: 'seller',
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
      aiDocsAllReviewed: false,
    }
    expect(canConfirm(g, filled)).toBe(false)
  })
})

describe('buildTransitionInput', () => {
  it('maps a publish gate form to the action input', () => {
    const g = resolveGate('proposal', 'active')
    const form: GateFormState = {
      ...emptyForm,
      sellerConfirmed: true,
      sellerLinked: true,
      sellerContactId: 'contact-1',
      dealSide: 'seller',
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    const input = buildTransitionInput(g, form, 'deal-1', 'Jane Broker')
    expect(input.targetStage).toBe('active')
    expect(input.publish).toBe(true)
    expect(input.dealSide).toBe('seller')
    expect(input.sellerContactId).toBe('contact-1')
    expect(input.transaction).toMatchObject({
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    })
  })

  it('maps a backward-out-of-Active gate with unpublish selected', () => {
    const g = resolveGate('active', 'proposal')
    const input = buildTransitionInput(g, { ...emptyForm, unpublishOnExit: true }, 'deal-1', 'Jane Broker')
    expect(input.unpublish).toBe(true)
    expect(input.publish).toBeUndefined()
  })
})
