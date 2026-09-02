import { describe, it, expect } from 'vitest'
import type {
  DealBroker,
  Listing,
  VoucherPayable,
  VoucherPayment,
} from './types'
import { createProposalListing, emptyDraft } from './createListing'
import { useDataStore } from './dataStore'
import {
  allPayableGroups,
  countPayables,
  filterPayableGroups,
  payableRows,
  payableStatus,
  payableYears,
} from './payableIndex'

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

function makeDeal(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Sale' })
}

/**
 * Writes a voucher's brokers and payables straight onto the stored deal.
 *
 * The write path is not what is under test — `applyDeposit` and `recordPayment`
 * have their own suites — and driving a deal to Approved to get one payable
 * would make every case here depend on the stage gates. So the fixture is set
 * directly, and the assertions stay about what `payableIndex` READS. Same call
 * `depositIndex.test.ts` makes.
 */
function setVoucher(
  dealId: string,
  patch: {
    voucherName?: string
    payables?: VoucherPayable[]
    internalBrokers?: DealBroker[]
    outsideBrokers?: DealBroker[]
  },
) {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    const deal = listings.get(dealId)!
    const next: Listing = {
      ...deal,
      internalBrokers: patch.internalBrokers ?? deal.internalBrokers,
      outsideBrokers: patch.outsideBrokers ?? deal.outsideBrokers,
      transaction: {
        ...deal.transaction,
        backOffice: {
          ...deal.transaction.backOffice,
          name: patch.voucherName ?? deal.transaction.backOffice.name,
          payables: patch.payables ?? deal.transaction.backOffice.payables,
        },
      },
    }
    listings.set(dealId, next)
    return { listings }
  })
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
    id: 'pay1',
    date: '2026-06-01',
    grossAmount: 1000,
    deductions: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    createdById: 'you',
    ...over,
  }
}

function payable(over: Partial<VoucherPayable> = {}): VoucherPayable {
  return {
    id: 'pb1',
    brokerId: 'b1',
    depositId: 'dep1',
    date: '2026-05-22',
    grossAmount: 10000,
    payments: [],
    ...over,
  }
}

describe('payableStatus', () => {
  it('is Outstanding while any balance is left', () => {
    expect(payableStatus(payable({ payments: [payment()] }))).toBe('Outstanding')
  })

  it('is Fully Paid once the payments cover the gross', () => {
    const settled = payable({
      grossAmount: 1000,
      payments: [payment({ grossAmount: 1000 })],
    })
    expect(payableStatus(settled)).toBe('Fully Paid')
  })
})

describe('allPayableGroups', () => {
  it('gathers one broker’s payables across deals into a single group', () => {
    resetStore()
    const a = makeDeal('123 Main Street | Suite 101')
    const b = makeDeal('205 S. Peoria')

    // The same person on two deals carries two different `DealBroker.id`s —
    // the seed draws a fresh uuid per deal. The group must still be one.
    setVoucher(a.id, {
      internalBrokers: [broker({ id: 'a-broker' })],
      payables: [payable({ id: 'pb-a', brokerId: 'a-broker', grossAmount: 10100.97 })],
    })
    setVoucher(b.id, {
      internalBrokers: [broker({ id: 'b-broker' })],
      payables: [payable({ id: 'pb-b', brokerId: 'b-broker', grossAmount: 899.96 })],
    })

    const groups = allPayableGroups()
    expect(groups).toHaveLength(1)
    expect(groups[0].broker.name).toBe('Nikos Buse')
    expect(groups[0].rows).toHaveLength(2)
  })

  it('keeps two different brokers apart', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [
        broker({ id: 'b1', name: 'Nikos Buse', email: 'nikos@buildout.com' }),
        broker({ id: 'b2', name: 'Aaron King', email: 'aaron@buildout.com' }),
      ],
      payables: [
        payable({ id: 'pb1', brokerId: 'b1' }),
        payable({ id: 'pb2', brokerId: 'b2' }),
      ],
    })

    expect(allPayableGroups().map((g) => g.broker.name)).toEqual([
      'Aaron King',
      'Nikos Buse',
    ])
  })

  it('foots Total due on balances, not amounts', () => {
    resetStore()
    const deal = makeDeal('1135 Kline St')
    setVoucher(deal.id, {
      internalBrokers: [broker()],
      payables: [
        // 15,000 raised, 10 of it paid — the broker is owed 14,990.
        payable({
          id: 'pb1',
          grossAmount: 15000,
          payments: [payment({ grossAmount: 10 })],
        }),
        payable({ id: 'pb2', grossAmount: 899.96 }),
      ],
    })

    const [group] = allPayableGroups()
    expect(group.totalDue).toBe(15889.96)
  })

  it('sorts outside brokers before the house’s own', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      // Named so alphabetical order alone would put the internal broker first.
      internalBrokers: [
        broker({ id: 'b1', name: 'Aaron King', email: 'aaron@buildout.com' }),
      ],
      outsideBrokers: [
        broker({
          id: 'b2',
          name: 'Zeta Broker Co.',
          email: 'zeta@outside.com',
          side: 'outside',
          personalSplitPct: undefined,
          commissionPlan: undefined,
        }),
      ],
      payables: [
        payable({ id: 'pb1', brokerId: 'b1' }),
        payable({ id: 'pb2', brokerId: 'b2' }),
      ],
    })

    const groups = allPayableGroups()
    expect(groups.map((g) => g.broker.name)).toEqual([
      'Zeta Broker Co.',
      'Aaron King',
    ])
    expect(groups[0].outside).toBe(true)
    expect(groups[1].outside).toBe(false)
  })

  it('orders a group’s rows newest first', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [broker()],
      payables: [
        payable({ id: 'old', date: '2025-08-20' }),
        payable({ id: 'new', date: '2026-08-27' }),
        payable({ id: 'mid', date: '2026-06-09' }),
      ],
    })

    expect(allPayableGroups()[0].rows.map((r) => r.payableId)).toEqual([
      'new',
      'mid',
      'old',
    ])
  })

  it('skips a payable whose broker is not on the deal', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [broker({ id: 'b1' })],
      payables: [payable({ id: 'pb1', brokerId: 'ghost' })],
    })

    expect(allPayableGroups()).toEqual([])
  })

  it('ignores a voucher with no payables', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, { internalBrokers: [broker()], payables: [] })

    expect(allPayableGroups()).toEqual([])
  })

  it('carries the voucher name and its route target onto every row', () => {
    resetStore()
    const deal = makeDeal('205 S. Peoria')
    setVoucher(deal.id, {
      voucherName: '205 S. Peoria',
      internalBrokers: [broker()],
      payables: [payable()],
    })

    const [row] = allPayableGroups()[0].rows
    expect(row.voucherName).toBe('205 S. Peoria')
    expect(row.target).toEqual({
      to: '/listings/$listingId/financials',
      params: { listingId: deal.id },
    })
  })

  it('puts the broker, the voucher and both figures into the haystack', () => {
    resetStore()
    const deal = makeDeal('205 S. Peoria')
    setVoucher(deal.id, {
      voucherName: '205 S. Peoria',
      internalBrokers: [broker()],
      payables: [payable({ grossAmount: 899.96 })],
    })

    const [row] = allPayableGroups()[0].rows
    expect(row.searchText).toContain('nikos buse')
    expect(row.searchText).toContain('205 s. peoria')
    expect(row.searchText).toContain('899.96')
  })
})

describe('filterPayableGroups', () => {
  function twoGroups() {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [
        broker({ id: 'b1', name: 'Nikos Buse', email: 'nikos@buildout.com' }),
        broker({ id: 'b2', name: 'Aaron King', email: 'aaron@buildout.com' }),
      ],
      payables: [
        payable({ id: 'pb1', brokerId: 'b1', grossAmount: 100, date: '2026-01-02' }),
        payable({ id: 'pb2', brokerId: 'b1', grossAmount: 200, date: '2025-01-02' }),
        payable({ id: 'pb3', brokerId: 'b2', grossAmount: 400, date: '2025-01-02' }),
      ],
    })
    return allPayableGroups()
  }

  it('re-foots each total against the rows that survived', () => {
    const kept = filterPayableGroups(twoGroups(), (r) => r.date.startsWith('2026'))
    expect(kept).toHaveLength(1)
    expect(kept[0].broker.name).toBe('Nikos Buse')
    expect(kept[0].totalDue).toBe(100)
  })

  it('drops a group with nothing left in it', () => {
    expect(filterPayableGroups(twoGroups(), () => false)).toEqual([])
  })

  it('leaves the input untouched', () => {
    const groups = twoGroups()
    filterPayableGroups(groups, () => false)
    expect(countPayables(groups)).toBe(3)
  })
})

describe('countPayables and payableRows', () => {
  it('count the rows, never the broker headings', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [
        broker({ id: 'b1', name: 'Nikos Buse', email: 'nikos@buildout.com' }),
        broker({ id: 'b2', name: 'Aaron King', email: 'aaron@buildout.com' }),
      ],
      payables: [
        payable({ id: 'pb1', brokerId: 'b1' }),
        payable({ id: 'pb2', brokerId: 'b1' }),
        payable({ id: 'pb3', brokerId: 'b2' }),
      ],
    })

    const groups = allPayableGroups()
    expect(countPayables(groups)).toBe(3)
    expect(payableRows(groups)).toHaveLength(3)
  })
})

describe('payableYears', () => {
  it('lists every year a payable was raised in, newest first', () => {
    resetStore()
    const deal = makeDeal('123 Main Street | Suite 101')
    setVoucher(deal.id, {
      internalBrokers: [broker()],
      payables: [
        payable({ id: 'pb1', date: '2024-03-01' }),
        payable({ id: 'pb2', date: '2027-03-01' }),
      ],
    })

    // 2026 is NOW's year, forced in so the dropdown is never empty.
    expect(payableYears(allPayableGroups(), NOW)).toEqual([2027, 2026, 2024])
  })

  it('offers the current year on an empty book', () => {
    resetStore()
    expect(payableYears([], NOW)).toEqual([2026])
  })
})
