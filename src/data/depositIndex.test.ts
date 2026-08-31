import { describe, it, expect } from 'vitest'
import type {
  Contact,
  DealBroker,
  FinancialDeduction,
  FinancialReceivable,
  Listing,
  VoucherDeposit,
  VoucherPayable,
  VoucherPayment,
} from './types'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { useDataStore } from './dataStore'
import {
  allDeposits,
  brokerShares,
  deductedPreSplit,
  depositBuckets,
  depositPayer,
  depositTotals,
  depositYears,
  houseSplit,
  type DepositRow,
} from './depositIndex'

/** Fixed "today", so the year dropdown's assertions are deterministic. */
const NOW = new Date(2026, 7, 24) // 24 Aug 2026

function resetStore() {
  useDataStore.setState({
    properties: new Map(),
    listings: new Map(),
    comps: new Map(),
    contacts: new Map(),
  })
}

/** A payer in the store, so `voucherParty` can resolve a name for the row. */
function addContact(id: string, firstName: string, lastName: string, company = '') {
  const contact = {
    id,
    firstName,
    lastName,
    company,
    email: `${firstName}.${lastName}@example.com`.toLowerCase(),
    phone: '',
  } as unknown as Contact
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(id, contact)
    return { contacts }
  })
  return contact
}

function makeSale(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Sale' })
}

function makeLease(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Lease' })
}

/**
 * Writes a voucher's money records straight onto the stored deal.
 *
 * The write path is not what is under test here — `applyDeposit` and
 * `approveVoucher` have their own suites — and driving a deal all the way to
 * Approved to get one payable would make every case below depend on the stage
 * gates. So the fixture is set directly, and the assertions stay about what
 * `depositIndex` READS.
 */
function setVoucher(
  dealId: string,
  patch: {
    receivables?: FinancialReceivable[]
    preSplitDeductions?: FinancialDeduction[]
    deposits?: VoucherDeposit[]
    payables?: VoucherPayable[]
    internalBrokers?: DealBroker[]
  },
) {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    const deal = listings.get(dealId)!
    const next: Listing = {
      ...deal,
      internalBrokers: patch.internalBrokers ?? deal.internalBrokers,
      transaction: {
        ...deal.transaction,
        backOffice: {
          ...deal.transaction.backOffice,
          receivables:
            patch.receivables ?? deal.transaction.backOffice.receivables,
          preSplitDeductions:
            patch.preSplitDeductions ??
            deal.transaction.backOffice.preSplitDeductions,
          deposits: patch.deposits ?? deal.transaction.backOffice.deposits,
          payables: patch.payables ?? deal.transaction.backOffice.payables,
        },
      },
    }
    listings.set(dealId, next)
    return { listings }
  })
}

function receivable(over: Partial<FinancialReceivable> = {}): FinancialReceivable {
  return {
    id: 'r1',
    payerContactId: 'c-1',
    billToCompany: false,
    dueDate: '2026-05-20',
    billingDescription: 'Full Payment',
    amount: 600000,
    credited: 0,
    ...over,
  }
}

function deposit(over: Partial<VoucherDeposit> = {}): VoucherDeposit {
  return {
    id: 'dep1',
    date: '2026-05-22',
    amount: 600000,
    referenceNumber: '234',
    createdAt: '2026-05-22T00:00:00.000Z',
    createdById: 'you',
    receivableAllocations: [{ targetId: 'r1', amount: 600000 }],
    deductionAllocations: [],
    ...over,
  }
}

function broker(over: Partial<DealBroker> = {}): DealBroker {
  return {
    id: 'b1',
    name: 'Nikos Buse',
    role: 'Primary Broker - Sell Side',
    email: 'nikos@buildout.com',
    side: 'internal',
    commissionSplitPct: 100,
    grossCommission: 400000,
    commissionPlan: 'Standard Commission Plan',
    personalSplitPct: 50,
    ...over,
  }
}

function payment(over: Partial<VoucherPayment> = {}): VoucherPayment {
  return {
    id: 'pmt1',
    date: '2026-06-01',
    grossAmount: 0,
    deductions: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    createdById: 'you',
    ...over,
  }
}

function payable(over: Partial<VoucherPayable> = {}): VoucherPayable {
  return {
    id: 'pbl1',
    brokerId: 'b1',
    depositId: 'dep1',
    date: '2026-05-22',
    grossAmount: 400000,
    payments: [],
    ...over,
  }
}

/** The one deposit on `dealId`, as the index renders it. */
function onlyRow(dealId: string): DepositRow {
  const rows = allDeposits().filter((r) => r.dealId === dealId)
  expect(rows).toHaveLength(1)
  return rows[0]
}

describe('deductedPreSplit', () => {
  it('sums what the deposit put against pre-split deductions', () => {
    expect(
      deductedPreSplit(
        deposit({
          deductionAllocations: [
            { targetId: 'd1', amount: 192.49 },
            { targetId: 'd2', amount: 1311.74 },
          ],
        }),
      ),
    ).toBe(1504.23)
  })

  it('reads a deposit that covered nothing as zero, not undefined', () => {
    expect(deductedPreSplit(deposit())).toBe(0)
  })
})

describe('houseSplit', () => {
  it('is whatever the other three columns did not claim', () => {
    expect(
      houseSplit({ amount: 43412.34, deducted: 1504.23, paid: 0, open: 34332.39 }),
    ).toBe(7575.72)
  })

  it('floors at zero rather than reporting the brokerage owes money it received', () => {
    expect(houseSplit({ amount: 1000, deducted: 0, paid: 0, open: 5000 })).toBe(0)
  })
})

describe('brokerShares', () => {
  it('reads Paid To Brokers as the NET cheque, not the payable gross', () => {
    resetStore()
    const deal = makeSale('113 S Mary Ave Apartments')
    setVoucher(deal.id, {
      internalBrokers: [broker({ personalSplitPct: 50 })],
      receivables: [receivable()],
      deposits: [deposit()],
      // Half the payable paid, at a 50% personal split, less a $250 hold-back:
      // 200,000 x 0.5 - 250.
      payables: [
        payable({ payments: [
          payment({
            grossAmount: 200000,
            deductions: [{ id: 'pd1', description: 'Advance', amount: 250 }],
          }),
        ] }),
      ],
    })

    expect(brokerShares(getListing(deal.id)!, 'dep1')).toEqual({
      paid: 99750,
      open: 200000,
    })
  })

  it('reads Open Payables as the GROSS balance the next cheque is written against', () => {
    resetStore()
    const deal = makeSale('1135 Kline St')
    setVoucher(deal.id, {
      internalBrokers: [broker({ personalSplitPct: 50 })],
      receivables: [receivable()],
      deposits: [deposit()],
      payables: [payable({ grossAmount: 15015, payments: [] })],
    })

    // Gross, not the 7,507.50 the broker would take home from it.
    expect(brokerShares(getListing(deal.id)!, 'dep1').open).toBe(15015)
  })

  it('counts only the payables THIS deposit raised', () => {
    resetStore()
    const deal = makeSale('Two Instalments')
    setVoucher(deal.id, {
      internalBrokers: [broker()],
      receivables: [receivable()],
      deposits: [deposit(), deposit({ id: 'dep2', date: '2026-06-09' })],
      payables: [
        payable({ id: 'pbl1', depositId: 'dep1', grossAmount: 400000 }),
        payable({ id: 'pbl2', depositId: 'dep2', grossAmount: 111111 }),
      ],
    })

    expect(brokerShares(getListing(deal.id)!, 'dep1').open).toBe(400000)
    expect(brokerShares(getListing(deal.id)!, 'dep2').open).toBe(111111)
  })

  it('reads a voucher with no payables at all as nothing paid and nothing owed', () => {
    resetStore()
    const deal = makeSale('Draft Voucher')
    setVoucher(deal.id, { receivables: [receivable()], deposits: [deposit()] })
    expect(brokerShares(getListing(deal.id)!, 'dep1')).toEqual({ paid: 0, open: 0 })
  })
})

describe('depositPayer', () => {
  it('names the one party that paid', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    setVoucher(deal.id, { receivables: [receivable()], deposits: [deposit()] })
    expect(depositPayer(getListing(deal.id)!, deposit())).toBe('Mandana Massih')
  })

  it('names the company when the line it paid was billed to one', () => {
    resetStore()
    addContact('c-1', 'George', 'Mountis', 'ACME Company')
    const deal = makeSale('113 S Mary Ave Apartments')
    setVoucher(deal.id, {
      receivables: [receivable({ billToCompany: true })],
      deposits: [deposit()],
    })
    expect(depositPayer(getListing(deal.id)!, deposit())).toBe('ACME Company')
  })

  it('reads Multiple when one deposit paid two parties, naming neither', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    addContact('c-2', 'Portland', 'Prosper')
    const deal = makeSale('Both Sides')
    const split = deposit({
      receivableAllocations: [
        { targetId: 'r1', amount: 300000 },
        { targetId: 'r2', amount: 300000 },
      ],
    })
    setVoucher(deal.id, {
      receivables: [
        receivable({ id: 'r1', payerContactId: 'c-1', amount: 300000 }),
        receivable({ id: 'r2', payerContactId: 'c-2', amount: 300000 }),
      ],
      deposits: [split],
    })
    expect(depositPayer(getListing(deal.id)!, split)).toBe('Multiple')
  })

  it('reads a dash for cash that reached no receivable', () => {
    resetStore()
    const deal = makeSale('Unspread Cash')
    setVoucher(deal.id, { receivables: [], deposits: [] })
    expect(
      depositPayer(getListing(deal.id)!, deposit({ receivableAllocations: [] })),
    ).toBe('--')
  })
})

describe('allDeposits', () => {
  it('divides a deposit into four columns that foot back to its amount', () => {
    resetStore()
    addContact('c-1', 'Buildout', 'Inc', 'Buildout, Inc.')
    const deal = makeSale('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [broker({ grossCommission: 34332.39, personalSplitPct: 50 })],
      receivables: [receivable({ id: 'r1', amount: 43412.34, billToCompany: true })],
      preSplitDeductions: [
        {
          id: 'd1',
          category: 'Marketing',
          description: 'Signage',
          pct: 0,
          amount: 1504.23,
          covered: null,
        },
      ],
      deposits: [
        deposit({
          id: 'dep1',
          date: '2026-08-27',
          amount: 43412.34,
          referenceNumber: '165259',
          receivableAllocations: [{ targetId: 'r1', amount: 43412.34 }],
          deductionAllocations: [{ targetId: 'd1', amount: 1504.23 }],
        }),
      ],
      payables: [payable({ grossAmount: 34332.39 })],
    })

    const row = onlyRow(deal.id)
    expect(row.payerName).toBe('Buildout, Inc.')
    expect(row.referenceNumber).toBe('165259')
    expect(row.amount).toBe(43412.34)
    expect(row.deductedPreSplit).toBe(1504.23)
    expect(row.paidToBrokers).toBe(0)
    expect(row.openPayables).toBe(34332.39)
    expect(row.collectedHouseSplit).toBe(7575.72)
    // `toBeCloseTo`, not `toBe`: the four figures are each rounded to the cent,
    // but adding four floats back up in the assertion reintroduces the tail the
    // row itself does not carry.
    expect(
      row.deductedPreSplit +
        row.paidToBrokers +
        row.openPayables +
        row.collectedHouseSplit,
    ).toBeCloseTo(row.amount, 2)
  })

  it('gives a deposit on a voucher with no payables entirely to the house', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    setVoucher(deal.id, {
      receivables: [receivable({ amount: 818.12 })],
      deposits: [
        deposit({ amount: 818.12, receivableAllocations: [{ targetId: 'r1', amount: 818.12 }] }),
      ],
    })
    expect(onlyRow(deal.id).collectedHouseSplit).toBe(818.12)
  })

  it('sorts by the day the money landed, oldest first', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    setVoucher(deal.id, {
      receivables: [receivable()],
      deposits: [
        deposit({ id: 'dep-c', date: '2026-08-27' }),
        deposit({ id: 'dep-a', date: '2026-05-22' }),
        deposit({ id: 'dep-b', date: '2026-06-09' }),
      ],
    })
    expect(allDeposits().map((r) => r.date)).toEqual([
      '2026-05-22',
      '2026-06-09',
      '2026-08-27',
    ])
  })

  it("lists a split lease's spaces and not the shell that fed them", () => {
    resetStore()
    addContact('c-1', 'Portland', 'Prosper')
    const shell = makeLease('Mall Assignment')
    setVoucher(shell.id, {
      receivables: [receivable({ amount: 30000 })],
      deposits: [deposit({ amount: 30000 })],
    })

    const unit = addPropertyUnit(shell.propertyId, {
      label: 'Suite 100',
      sqft: 1000,
      unitType: 'retail',
    })!
    const space = addSpaceToDeal(shell.id, unit.id)!.deal

    // The shell keeps its own backOffice record in the store — this is a read
    // rule, not a mutation — so the assertion is that nothing SURFACES it.
    expect(getListing(shell.id)!.transaction.backOffice.deposits).toHaveLength(1)
    const rows = allDeposits()
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.dealId === space.id)).toBe(true)
  })

  it('finds a row by reference, by raw amount, and by either payer behind it', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    addContact('c-2', 'Portland', 'Prosper')
    const deal = makeSale('Both Sides')
    setVoucher(deal.id, {
      receivables: [
        receivable({ id: 'r1', payerContactId: 'c-1', amount: 300000 }),
        receivable({ id: 'r2', payerContactId: 'c-2', amount: 300000 }),
      ],
      deposits: [
        deposit({
          referenceNumber: 'ACH 6/9',
          receivableAllocations: [
            { targetId: 'r1', amount: 300000 },
            { targetId: 'r2', amount: 300000 },
          ],
        }),
      ],
    })

    const row = onlyRow(deal.id)
    expect(row.payerName).toBe('Multiple')
    // The cell says Multiple, but search still reaches it under either name.
    for (const term of ['ach 6/9', '600000', '600000.00', 'mandana', 'prosper']) {
      expect(row.searchText).toContain(term)
    }
  })
})

describe('depositTotals', () => {
  it('foots every column of the rows it is given', () => {
    const rows = [
      {
        amount: 30000,
        deductedPreSplit: 0,
        paidToBrokers: 7507.5,
        openPayables: 11242.5,
        collectedHouseSplit: 11250,
      },
      {
        amount: 818.12,
        deductedPreSplit: 0,
        paidToBrokers: 0,
        openPayables: 409.06,
        collectedHouseSplit: 409.06,
      },
    ] as DepositRow[]

    expect(depositTotals(rows)).toEqual({
      count: 2,
      amount: 30818.12,
      deductedPreSplit: 0,
      paidToBrokers: 7507.5,
      openPayables: 11651.56,
      collectedHouseSplit: 11659.06,
    })
  })

  it('foots an empty set to zero rather than to nothing', () => {
    expect(depositTotals([]).count).toBe(0)
    expect(depositTotals([]).amount).toBe(0)
  })
})

describe('depositBuckets', () => {
  const rows = [
    {
      date: '2026-05-22',
      amount: 600000,
      deductedPreSplit: 0,
      paidToBrokers: 415000,
      openPayables: 0,
      collectedHouseSplit: 185000,
    },
    {
      date: '2026-06-09',
      amount: 30000,
      deductedPreSplit: 0,
      paidToBrokers: 7507.5,
      openPayables: 11242.5,
      collectedHouseSplit: 11250,
    },
    {
      date: '2025-06-09',
      amount: 99999,
      deductedPreSplit: 0,
      paidToBrokers: 0,
      openPayables: 0,
      collectedHouseSplit: 99999,
    },
  ] as DepositRow[]

  it('files a row by the day the money landed, and drops another year', () => {
    const buckets = depositBuckets(rows, { year: 2026, grain: 'monthly' })
    expect(buckets).toHaveLength(12)
    expect(buckets[4].label).toBe("May '26")
    expect(buckets[4].total).toBe(600000)
    expect(buckets[4].paidToBrokers).toBe(415000)
    expect(buckets[5].total).toBe(30000)
    expect(buckets[5].openPayables).toBe(11242.5)
    // 2025 is a different year's bar and must not leak into this one.
    expect(buckets.reduce((n, b) => n + b.total, 0)).toBe(630000)
  })

  it('keeps a quiet month on the axis rather than letting it vanish', () => {
    const buckets = depositBuckets(rows, { year: 2026, grain: 'monthly' })
    expect(buckets[0]).toMatchObject({ label: "Jan '26", total: 0 })
  })

  it('rolls three months into a quarter', () => {
    const buckets = depositBuckets(rows, { year: 2026, grain: 'quarterly' })
    expect(buckets).toHaveLength(4)
    expect(buckets[1].label).toBe("Q2 '26")
    expect(buckets[1].total).toBe(630000)
  })
})

describe('depositYears', () => {
  it('offers every year money landed in, newest first', () => {
    const rows = [
      { date: '2024-01-01' },
      { date: '2026-05-22' },
      { date: '2024-11-30' },
    ] as DepositRow[]
    expect(depositYears(rows, NOW)).toEqual([2026, 2024])
  })

  it('always offers the current year, even on a book with nothing in it', () => {
    expect(depositYears([], NOW)).toEqual([2026])
  })
})
