import { describe, expect, it } from 'vitest'
import {
  findPayableBroker,
  isPayableSettled,
  payableBalance,
  payableBrokers,
  payableGrossPaid,
  payableNetPaid,
  payableShare,
  payablesForDeposit,
  paymentNet,
} from './payables'
import type {
  DealBroker,
  FinancialReceivable,
  Listing,
  VoucherDeposit,
  VoucherPayable,
  VoucherPayment,
} from './types'

function broker(over: Partial<DealBroker> = {}): DealBroker {
  return {
    id: 'b1',
    name: 'Nikos Buse',
    role: 'Primary Broker - Sell Side',
    email: 'nikos@buildout.com',
    side: 'internal',
    commissionSplitPct: 100,
    grossCommission: 10000,
    commissionPlan: 'Standard Commission Plan',
    personalSplitPct: 55,
    ...over,
  }
}

function outside(over: Partial<DealBroker> = {}): DealBroker {
  return broker({
    id: 'b-out',
    name: 'Outside Broker Co.',
    role: 'Outside Broker',
    side: 'outside',
    commissionSplitPct: 50,
    grossCommission: 5000,
    commissionPlan: undefined,
    personalSplitPct: undefined,
    ...over,
  })
}

function receivable(over: Partial<FinancialReceivable> = {}): FinancialReceivable {
  return {
    id: 'r1',
    payerContactId: 'c1',
    billToCompany: false,
    dueDate: '2025-04-14',
    billingDescription: 'Full Payment',
    amount: 50000,
    credited: 0,
    ...over,
  }
}

function deposit(over: Partial<VoucherDeposit> = {}): VoucherDeposit {
  return {
    id: 'dep1',
    date: '2025-04-16',
    amount: 50000,
    referenceNumber: '1234',
    createdAt: '2025-04-16T00:00:00.000Z',
    createdById: 'you',
    receivableAllocations: [{ targetId: 'r1', amount: 50000 }],
    deductionAllocations: [],
    ...over,
  }
}

function payment(over: Partial<VoucherPayment> = {}): VoucherPayment {
  return {
    id: 'pay1',
    date: '2025-05-01',
    grossAmount: 1000,
    deductions: [],
    createdAt: '2025-05-01T00:00:00.000Z',
    createdById: 'you',
    ...over,
  }
}

function payable(over: Partial<VoucherPayable> = {}): VoucherPayable {
  return {
    id: 'pbl1',
    brokerId: 'b1',
    depositId: 'dep1',
    date: '2025-04-16',
    grossAmount: 10000,
    payments: [],
    ...over,
  }
}

describe('payableShare', () => {
  it('gives the broker their whole gross when the deposit pays the voucher off', () => {
    expect(
      payableShare({
        broker: broker({ grossCommission: 10000 }),
        depositAmount: 50000,
        allReceivables: [receivable({ amount: 50000 })],
      }),
    ).toBe(10000)
  })

  it('scales the share to what actually arrived', () => {
    expect(
      payableShare({
        broker: broker({ grossCommission: 10000 }),
        depositAmount: 12500,
        allReceivables: [receivable({ amount: 50000 })],
      }),
    ).toBe(2500)
  })

  // The reason the denominator is the whole voucher and not the receivables the
  // deposit touched. Paid in two halves, the broker must end up with their gross
  // once — not once per deposit.
  it('does not pay a full share twice when a voucher is paid in two parts', () => {
    const all = [
      receivable({ id: 'r1', amount: 25000 }),
      receivable({ id: 'r2', amount: 25000 }),
    ]
    const first = payableShare({
      broker: broker({ grossCommission: 10000 }),
      depositAmount: 25000,
      allReceivables: all,
    })
    const second = payableShare({
      broker: broker({ grossCommission: 10000 }),
      depositAmount: 25000,
      allReceivables: all,
    })
    expect(first).toBe(5000)
    expect(second).toBe(5000)
    expect(first + second).toBe(10000)
  })

  it('reads $0.00 rather than dividing by zero on a voucher with nothing billed', () => {
    expect(
      payableShare({
        broker: broker(),
        depositAmount: 50000,
        allReceivables: [],
      }),
    ).toBe(0)
  })

  it('rounds to the cent', () => {
    expect(
      payableShare({
        broker: broker({ grossCommission: 10000 }),
        depositAmount: 1,
        allReceivables: [receivable({ amount: 30000 })],
      }),
    ).toBe(0.33)
  })
})

describe('payablesForDeposit', () => {
  it('raises one payable per broker, dated from the deposit', () => {
    const rows = payablesForDeposit({
      deposit: deposit({ id: 'dep-a', date: '2026-08-27', amount: 25000 }),
      brokers: [outside(), broker()],
      allReceivables: [receivable({ amount: 50000 })],
    })
    expect(rows).toEqual([
      {
        brokerId: 'b-out',
        depositId: 'dep-a',
        date: '2026-08-27',
        grossAmount: 2500,
        payments: [],
      },
      {
        brokerId: 'b1',
        depositId: 'dep-a',
        date: '2026-08-27',
        grossAmount: 5000,
        payments: [],
      },
    ])
  })

  it('skips a broker whose share rounds to nothing', () => {
    const rows = payablesForDeposit({
      deposit: deposit(),
      brokers: [broker({ grossCommission: 0 }), broker({ id: 'b2' })],
      allReceivables: [receivable()],
    })
    expect(rows.map((r) => r.brokerId)).toEqual(['b2'])
  })
})

describe('paymentNet', () => {
  it('takes the broker’s own split off the gross', () => {
    expect(paymentNet(payment({ grossAmount: 1000 }), broker())).toBe(550)
  })

  // An outside broker's gross IS their cheque — the co-broke was already struck
  // as a percentage of the deal's commission.
  it('pays an outside broker their gross, having no split of their own', () => {
    expect(paymentNet(payment({ grossAmount: 2777.78 }), outside())).toBe(2777.78)
  })

  it('takes deductions off after the split', () => {
    const net = paymentNet(
      payment({
        grossAmount: 1000,
        deductions: [
          { id: 'x', description: 'Advance', amount: 100 },
          { id: 'y', description: 'Marketing', amount: 50 },
        ],
      }),
      broker(),
    )
    // 1000 x 55% = 550, less 150.
    expect(net).toBe(400)
  })

  it('floors at zero rather than paying the brokerage back', () => {
    expect(
      paymentNet(
        payment({
          grossAmount: 100,
          deductions: [{ id: 'x', description: 'Advance', amount: 5000 }],
        }),
        broker(),
      ),
    ).toBe(0)
  })

  it('treats an unresolvable broker as taking all of it', () => {
    expect(paymentNet(payment({ grossAmount: 1000 }), undefined)).toBe(1000)
  })
})

describe('payable totals', () => {
  const paid = payable({
    grossAmount: 10000,
    payments: [
      payment({ id: 'p1', grossAmount: 4000 }),
      payment({
        id: 'p2',
        grossAmount: 1000,
        deductions: [{ id: 'x', description: 'Advance', amount: 50 }],
      }),
    ],
  })

  it('sums gross paid before the split', () => {
    expect(payableGrossPaid(paid)).toBe(5000)
  })

  it('sums net paid after the split and its deductions', () => {
    // 4000 x 55% = 2200, plus 1000 x 55% - 50 = 500.
    expect(payableNetPaid(paid, broker())).toBe(2700)
  })

  it('leaves the balance as what is still owed gross', () => {
    expect(payableBalance(paid)).toBe(5000)
    expect(isPayableSettled(paid)).toBe(false)
  })

  it('settles at zero and never goes negative', () => {
    const over = payable({
      grossAmount: 1000,
      payments: [payment({ grossAmount: 1500 })],
    })
    expect(payableBalance(over)).toBe(0)
    expect(isPayableSettled(over)).toBe(true)
  })
})

describe('payableBrokers', () => {
  const deal = {
    internalBrokers: [broker({ id: 'in1' }), broker({ id: 'in2' })],
    outsideBrokers: [outside({ id: 'out1' })],
  } as Listing

  // Outside first: a co-broke comes off the top before the house splits the
  // rest with its own people, so this is the order the money leaves in.
  it('lists outside brokers before the house’s own', () => {
    expect(payableBrokers(deal).map((b) => b.id)).toEqual(['out1', 'in1', 'in2'])
  })

  it('finds a broker from either list, and nothing for an unknown id', () => {
    expect(findPayableBroker(deal, 'in2')?.id).toBe('in2')
    expect(findPayableBroker(deal, 'out1')?.id).toBe('out1')
    expect(findPayableBroker(deal, 'nope')).toBeUndefined()
  })
})
