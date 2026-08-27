import { describe, expect, it } from 'vitest'
import {
  depositsForReceivable,
  generateDepositReference,
  previewDeposit,
} from './deposits'
import type { FinancialDeduction, FinancialReceivable, VoucherDeposit } from './types'

function receivable(over: Partial<FinancialReceivable> = {}): FinancialReceivable {
  return {
    id: 'r1',
    payerContactId: 'c1',
    billToCompany: false,
    dueDate: '2025-04-14',
    billingDescription: 'Full Payment',
    amount: 144300,
    credited: 0,
    ...over,
  }
}

function deduction(over: Partial<FinancialDeduction> = {}): FinancialDeduction {
  return {
    id: 'd1',
    category: 'Marketing',
    description: 'Signage (Vendor Name)',
    pct: 0,
    amount: 10000,
    covered: null,
    ...over,
  }
}

/** The two receivables and the one deduction from the reference design. */
function reference() {
  const first = receivable({ id: 'r1', dueDate: '2025-04-14' })
  const second = receivable({ id: 'r2', dueDate: '2025-07-20' })
  return { all: [first, second], deductions: [deduction()] }
}

describe('previewDeposit', () => {
  it('matches the reference design’s figures', () => {
    const { all, deductions } = reference()
    const preview = previewDeposit({
      amount: 5555.55,
      selected: all,
      allReceivables: all,
      deductions,
    })
    expect(preview.receivables).toEqual([
      { targetId: 'r1', balance: 144300, applied: 5555.55 },
      { targetId: 'r2', balance: 144300, applied: 0 },
    ])
    // 5555.55 x (10000 / 288600) = 192.50 exactly.
    //
    // The reference design reads $192.49. That cent is the rounding residual of
    // the three broker payables it also lists: their proportional shares round up
    // to 2777.78 + 1292.64 + 1292.64, which with a 192.50 deduction totals a cent
    // more than the deposit, and the reference lands the difference on the
    // deduction because it is the last line. Payables are out of this pass, so
    // there is no residual to land and the honest figure is the proportional one.
    expect(preview.deductions).toEqual([
      { targetId: 'd1', balance: 10000, applied: 192.5 },
    ])
    expect(preview.unapplied).toBe(0)
  })

  it('fills the oldest receivable first, whatever order they arrive in', () => {
    const { all } = reference()
    const preview = previewDeposit({
      amount: 200000,
      selected: [all[1], all[0]],
      allReceivables: all,
      deductions: [],
    })
    expect(preview.receivables).toEqual([
      { targetId: 'r1', balance: 144300, applied: 144300 },
      { targetId: 'r2', balance: 144300, applied: 55700 },
    ])
  })

  it('never gives a receivable more than it still owes', () => {
    const partPaid = receivable({ amount: 1000, credited: 600 })
    const preview = previewDeposit({
      amount: 900,
      selected: [partPaid],
      allReceivables: [partPaid],
      deductions: [],
    })
    expect(preview.receivables[0]).toEqual({ targetId: 'r1', balance: 400, applied: 400 })
    // The 500 the selection could not absorb is reported, not swallowed.
    expect(preview.unapplied).toBe(500)
  })

  it('leaves a settled receivable at zero rather than dropping its row', () => {
    const settled = receivable({ id: 'paid', amount: 1000, credited: 1000 })
    const open = receivable({ id: 'open', dueDate: '2025-09-01', amount: 1000 })
    const preview = previewDeposit({
      amount: 300,
      selected: [settled, open],
      allReceivables: [settled, open],
      deductions: [],
    })
    expect(preview.receivables).toEqual([
      { targetId: 'paid', balance: 0, applied: 0 },
      { targetId: 'open', balance: 1000, applied: 300 },
    ])
  })

  it('bases a deduction’s share on every receivable, not just the selected ones', () => {
    // Selecting one of two receivables must not hand the deduction the share it
    // would get from the whole voucher — two part deposits would over-cover it.
    const { all, deductions } = reference()
    const preview = previewDeposit({
      amount: 5555.55,
      selected: [all[0]],
      allReceivables: all,
      deductions,
    })
    expect(preview.deductions).toEqual([
      { targetId: 'd1', balance: 10000, applied: 192.5 },
    ])
  })

  it('never covers a deduction past what is left of it', () => {
    const nearlyCovered = deduction({ amount: 10000, covered: 9950 })
    const r = receivable({ amount: 10000 })
    const preview = previewDeposit({
      amount: 10000,
      selected: [r],
      allReceivables: [r],
      deductions: [nearlyCovered],
    })
    // Its share would be the full 10,000; only 50 is left uncovered.
    expect(preview.deductions).toEqual([
      { targetId: 'd1', balance: 50, applied: 50 },
    ])
  })

  it('applies nothing when the voucher has no receivable amount to divide by', () => {
    const zero = receivable({ amount: 0 })
    const preview = previewDeposit({
      amount: 500,
      selected: [zero],
      allReceivables: [zero],
      deductions: [deduction()],
    })
    expect(preview.receivables).toEqual([{ targetId: 'r1', balance: 0, applied: 0 }])
    expect(preview.deductions).toEqual([{ targetId: 'd1', balance: 10000, applied: 0 }])
    expect(preview.unapplied).toBe(500)
  })

  it('reports every cent as unapplied when the amount is zero', () => {
    const { all, deductions } = reference()
    const preview = previewDeposit({
      amount: 0,
      selected: all,
      allReceivables: all,
      deductions,
    })
    expect(preview.receivables.every((l) => l.applied === 0)).toBe(true)
    expect(preview.deductions.every((l) => l.applied === 0)).toBe(true)
    expect(preview.unapplied).toBe(0)
  })
})

describe('depositsForReceivable', () => {
  function deposit(over: Partial<VoucherDeposit> = {}): VoucherDeposit {
    return {
      id: 'dep1',
      date: '2026-01-10',
      amount: 1000,
      referenceNumber: '',
      createdAt: '2026-01-10T00:00:00.000Z',
      createdById: 't1',
      receivableAllocations: [],
      deductionAllocations: [],
      ...over,
    }
  }

  it('reports the allocation, not the deposit’s whole amount', () => {
    // One deposit split across two receivables. A child row under r1 reading
    // $25,000 would be stating money that went to r2.
    const split = deposit({
      amount: 25000,
      receivableAllocations: [
        { targetId: 'r1', amount: 10000 },
        { targetId: 'r2', amount: 15000 },
      ],
    })
    expect(depositsForReceivable([split], 'r1')).toEqual([
      { deposit: split, amount: 10000 },
    ])
  })

  it('orders by the date the money landed, not the order it was filed', () => {
    const later = deposit({ id: 'b', date: '2026-03-01', receivableAllocations: [{ targetId: 'r1', amount: 2 }] })
    const earlier = deposit({ id: 'a', date: '2026-02-01', receivableAllocations: [{ targetId: 'r1', amount: 1 }] })
    expect(depositsForReceivable([later, earlier], 'r1').map((d) => d.deposit.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('skips deposits that never touched this receivable, and a missing list', () => {
    const other = deposit({ receivableAllocations: [{ targetId: 'r2', amount: 5 }] })
    expect(depositsForReceivable([other], 'r1')).toEqual([])
    expect(depositsForReceivable(undefined, 'r1')).toEqual([])
  })
})

describe('generateDepositReference', () => {
  it('spells a four-digit reference, the same shape a wire reference has', () => {
    expect(generateDepositReference('deposit-abc', [])).toMatch(/^[1-9]\d{3}$/)
  })

  it('gives the same seed the same reference, so a reseed is stable', () => {
    expect(generateDepositReference('deposit-abc', [])).toBe(
      generateDepositReference('deposit-abc', []),
    )
  })

  it('steps past a reference the voucher already carries', () => {
    const first = generateDepositReference('deposit-abc', [])
    const next = generateDepositReference('deposit-abc', [first])
    expect(next).not.toBe(first)
    expect(Number(next)).toBe(Number(first) + 1)
  })

  it('steps past one the broker typed by hand, not just generated ones', () => {
    // A generated reference colliding with a real cheque number on the same
    // voucher would put two different payments under one identifier.
    const first = generateDepositReference('deposit-abc', [])
    const second = String(Number(first) + 1)
    const third = generateDepositReference('deposit-abc', [first, second])
    expect([first, second]).not.toContain(third)
  })

  it('stays in range when it has to wrap past the top of it', () => {
    // Seeded so the hash lands near 9999 and the step has to wrap to 1000.
    const taken = Array.from({ length: 20 }, (_, i) => String(9980 + i))
    const ref = generateDepositReference('deposit-xyz', taken)
    expect(Number(ref)).toBeGreaterThanOrEqual(1000)
    expect(Number(ref)).toBeLessThanOrEqual(9999)
  })
})
