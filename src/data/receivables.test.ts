import { describe, it, expect } from 'vitest'
import type { Contact } from './types'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { useDataStore } from './dataStore'
import { addReceivable, applyDeposit } from './actions'
import {
  allReceivables,
  brokerFace,
  invoiceSelectionBlock,
  receivableBuckets,
  receivableStatus,
  receivableTotals,
  receivableYears,
  type ReceivableRow,
} from './receivables'
import { CURRENT_USER } from './teammates'

/** Fixed "today" so every status assertion is deterministic. */
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

/** The one receivable on `dealId`, as the index renders it. */
function onlyRow(dealId: string): ReceivableRow {
  const rows = allReceivables(NOW).filter((r) => r.dealId === dealId)
  expect(rows).toHaveLength(1)
  return rows[0]
}

describe('receivableStatus', () => {
  it('reads a settled line as Fully Paid whatever its date', () => {
    expect(receivableStatus(0, '2020-01-01', '2026-08-24')).toBe('Fully Paid')
    expect(receivableStatus(0, '2030-01-01', '2026-08-24')).toBe('Fully Paid')
  })

  it('reads an outstanding line past its date as Overdue', () => {
    expect(receivableStatus(500, '2026-08-23', '2026-08-24')).toBe('Overdue')
  })

  it('reads a line due today as Open, not Overdue', () => {
    expect(receivableStatus(500, '2026-08-24', '2026-08-24')).toBe('Open')
  })

  it('reads an outstanding line still ahead as Open', () => {
    expect(receivableStatus(500, '2026-09-01', '2026-08-24')).toBe('Open')
  })

  it('lets settled beat late — a line paid after its due date is not Overdue', () => {
    expect(receivableStatus(0, '2026-01-01', '2026-08-24')).toBe('Fully Paid')
  })

  it('reads an over-credited line as Fully Paid', () => {
    expect(receivableStatus(-100, '2026-01-01', '2026-08-24')).toBe('Fully Paid')
  })
})

describe('brokerFace', () => {
  it('borrows the photo and initials of a broker on the staff roster', () => {
    const face = brokerFace(CURRENT_USER.name)
    expect(face.initials).toBe(CURRENT_USER.initials)
    expect(face.avatarUrl).toBe(CURRENT_USER.avatarUrl)
  })

  it('falls back to initials for a name the roster does not carry', () => {
    const face = brokerFace('Colleen Little')
    expect(face.initials).toBe('CL')
    expect(face.avatarUrl).toBeUndefined()
  })

  it('takes only the first two words of a long name', () => {
    expect(brokerFace('Ana Maria de Souza').initials).toBe('AM')
  })

  it('renders a placeholder rather than an empty circle for a nameless broker', () => {
    expect(brokerFace('   ').initials).toBe('?')
  })
})

describe('allReceivables', () => {
  it('returns one row per receivable, carrying the deal it settles', () => {
    resetStore()
    addContact('c-1', 'Jason', 'Altneu')
    const deal = makeSale('9311 North Stevens Avenue')
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-08',
      billingDescription: 'First payment',
      amount: 25000,
    })
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-09',
      billingDescription: 'Second payment',
      amount: 25000,
    })

    const rows = allReceivables(NOW).filter((r) => r.dealId === deal.id)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.description)).toEqual([
      'First payment',
      'Second payment',
    ])
    expect(rows[0].payerName).toBe('Jason Altneu')
    expect(rows[0].dealType).toBe('Sale')
  })

  it('bills the company when the row says to, and the person when it does not', () => {
    resetStore()
    addContact('c-1', 'George', 'Mountis', 'ACME Company')
    const deal = makeSale('Beachwood Apartments')
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: true,
      dueDate: '2026-10-03',
      billingDescription: '',
      amount: 90000,
    })
    expect(onlyRow(deal.id).payerName).toBe('ACME Company')

    const other = makeSale('113 S Mary Ave')
    addReceivable(other.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-10-03',
      billingDescription: '',
      amount: 90000,
    })
    expect(onlyRow(other.id).payerName).toBe('George Mountis')
  })

  it('sorts by due date, oldest first, so the overdue work leads', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    for (const dueDate of ['2026-12-01', '2026-01-15', '2026-06-30']) {
      addReceivable(deal.id, {
        payerContactId: 'c-1',
        billToCompany: false,
        dueDate,
        billingDescription: dueDate,
        amount: 1000,
      })
    }
    expect(allReceivables(NOW).map((r) => r.dueDate)).toEqual([
      '2026-01-15',
      '2026-06-30',
      '2026-12-01',
    ])
  })

  it('lists a split lease\'s spaces and not the shell that fed them', () => {
    resetStore()
    addContact('c-1', 'Portland', 'Prosper')
    const shell = makeLease('Mall Assignment')
    addReceivable(shell.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-09',
      billingDescription: 'Shell line',
      amount: 30000,
    })

    const unit = addPropertyUnit(shell.propertyId, {
      label: 'Suite 100',
      sqft: 1000,
      unitType: 'retail',
    })!
    const space = addSpaceToDeal(shell.id, unit.id)!.deal
    addReceivable(space.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-09',
      billingDescription: 'Suite line',
      amount: 12000,
    })

    // The shell keeps its own backOffice record in the store — this is a read
    // rule, not a mutation — so the assertion is that nothing SURFACES it.
    expect(getListing(shell.id)!.transaction.backOffice.receivables).toHaveLength(1)
    const rows = allReceivables(NOW)
    expect(rows.every((r) => r.dealId === space.id)).toBe(true)
    // Splitting copies the shell's voucher onto each child, so 'Shell line' is
    // still listed — but under the suite that now owns it, once, rather than
    // under the building as well.
    expect(rows.map((r) => r.description).sort()).toEqual([
      'Shell line',
      'Suite line',
    ])
  })

  it('sums the deposit allocations rather than reading the stored credited', () => {
    resetStore()
    addContact('c-1', 'Acme', 'Payer')
    const deal = makeSale('113 S Mary Ave Apartments')
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-01',
      billingDescription: '',
      amount: 600000,
    })
    const receivable = getListing(deal.id)!.transaction.backOffice.receivables[0]

    applyDeposit(deal.id, {
      date: '2026-06-01',
      amount: 400000,
      referenceNumber: '1001',
      receivableAllocations: [{ targetId: receivable.id, amount: 400000 }],
      deductionAllocations: [],
    })
    applyDeposit(deal.id, {
      date: '2026-06-15',
      amount: 200000,
      referenceNumber: '1002',
      receivableAllocations: [{ targetId: receivable.id, amount: 200000 }],
      deductionAllocations: [],
    })

    const row = onlyRow(deal.id)
    expect(row.deposits).toBe(600000)
    expect(row.openDue).toBe(0)
    expect(row.status).toBe('Fully Paid')
  })

  it('gives each receivable only its own share of a split deposit', () => {
    resetStore()
    addContact('c-1', 'Split', 'Payer')
    const deal = makeSale('Two Line Deal')
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-01',
      billingDescription: 'First',
      amount: 10000,
    })
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      // Ahead of NOW, so what the deposit leaves behind reads Open rather than
      // Overdue — this test is about the allocation, not the date.
      dueDate: '2026-09-01',
      billingDescription: 'Second',
      amount: 10000,
    })
    const [first, second] =
      getListing(deal.id)!.transaction.backOffice.receivables

    applyDeposit(deal.id, {
      date: '2026-06-05',
      amount: 12000,
      referenceNumber: '1003',
      receivableAllocations: [
        { targetId: first.id, amount: 10000 },
        { targetId: second.id, amount: 2000 },
      ],
      deductionAllocations: [],
    })

    const rows = allReceivables(NOW).filter((r) => r.dealId === deal.id)
    expect(rows.map((r) => r.deposits)).toEqual([10000, 2000])
    expect(rows.map((r) => r.openDue)).toEqual([0, 8000])
    expect(rows.map((r) => r.status)).toEqual(['Fully Paid', 'Open'])
  })

  it('floors open / due at zero on an over-credited line', () => {
    resetStore()
    addContact('c-1', 'Over', 'Payer')
    const deal = makeSale('Overpaid Deal')
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-01',
      billingDescription: '',
      amount: 1000,
    })
    const receivable = getListing(deal.id)!.transaction.backOffice.receivables[0]
    applyDeposit(deal.id, {
      date: '2026-06-01',
      amount: 5000,
      referenceNumber: '1004',
      receivableAllocations: [{ targetId: receivable.id, amount: 5000 }],
      deductionAllocations: [],
    })

    const row = onlyRow(deal.id)
    expect(row.openDue).toBe(0)
    expect(row.status).toBe('Fully Paid')
  })

  it('finds a row by its payer, its voucher, its description or its amount', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    addReceivable(deal.id, {
      payerContactId: 'c-1',
      billToCompany: false,
      dueDate: '2026-06-30',
      billingDescription: 'Due at end of month',
      amount: 818.12,
    })
    const { searchText } = onlyRow(deal.id)
    for (const q of ['mandana', 'kline', 'end of month', '818.12']) {
      expect(searchText).toContain(q)
    }
  })
})

describe('receivableTotals', () => {
  function row(over: Partial<ReceivableRow>): ReceivableRow {
    return {
      amount: 0,
      deposits: 0,
      otherCredits: 0,
      openDue: 0,
      ...over,
    } as ReceivableRow
  }

  it('foots the rows it is handed, not the whole book', () => {
    const totals = receivableTotals([
      row({ amount: 25000, openDue: 25000 }),
      row({ amount: 600000, deposits: 600000 }),
      row({ amount: 818.12, deposits: 818.12 }),
    ])
    expect(totals).toEqual({
      count: 3,
      amount: 625818.12,
      deposits: 600818.12,
      otherCredits: 0,
      openDue: 25000,
    })
  })

  it('reads zero on an empty set rather than blanking the row', () => {
    expect(receivableTotals([])).toEqual({
      count: 0,
      amount: 0,
      deposits: 0,
      otherCredits: 0,
      openDue: 0,
    })
  })
})

describe('receivableBuckets', () => {
  function row(over: Partial<ReceivableRow>): ReceivableRow {
    return {
      dueDate: '2026-06-09',
      status: 'Open',
      amount: 0,
      deposits: 0,
      otherCredits: 0,
      openDue: 0,
      ...over,
    } as ReceivableRow
  }

  it('returns all twelve months, empty ones included', () => {
    const buckets = receivableBuckets([], { year: 2026, grain: 'monthly' })
    expect(buckets).toHaveLength(12)
    expect(buckets[0].label).toBe("Jan '26")
    expect(buckets[11].label).toBe("Dec '26")
    expect(buckets.every((b) => b.total === 0)).toBe(true)
  })

  it('returns four quarters on the quarterly grain', () => {
    const buckets = receivableBuckets(
      [row({ dueDate: '2026-05-02', amount: 100, openDue: 100 })],
      { year: 2026, grain: 'quarterly' },
    )
    expect(buckets.map((b) => b.label)).toEqual([
      "Q1 '26",
      "Q2 '26",
      "Q3 '26",
      "Q4 '26",
    ])
    expect(buckets[1].open).toBe(100)
  })

  it('splits a row between what landed and what is still owed', () => {
    const [, , , , , jun] = receivableBuckets(
      [row({ dueDate: '2026-06-09', amount: 1000, deposits: 400, openDue: 600 })],
      { year: 2026, grain: 'monthly' },
    )
    expect(jun.deposits).toBe(400)
    expect(jun.open).toBe(600)
    expect(jun.overdue).toBe(0)
    // The four series sum to the amount billed — the bar is not double-counting.
    expect(jun.deposits + jun.otherCredits + jun.open + jun.overdue).toBe(jun.total)
    expect(jun.total).toBe(1000)
  })

  it('files what is owed on a late line under overdue, not open', () => {
    const [jun] = receivableBuckets(
      [
        row({
          dueDate: '2026-01-09',
          status: 'Overdue',
          amount: 1000,
          openDue: 1000,
        }),
      ],
      { year: 2026, grain: 'monthly' },
    )
    expect(jun.overdue).toBe(1000)
    expect(jun.open).toBe(0)
  })

  it('ignores a row due in another year', () => {
    const buckets = receivableBuckets(
      [row({ dueDate: '2025-06-09', amount: 1000, openDue: 1000 })],
      { year: 2026, grain: 'monthly' },
    )
    expect(buckets.every((b) => b.total === 0)).toBe(true)
  })

  it('reads the month off the string, so a UTC parse cannot shift the day', () => {
    // `new Date('2026-06-01')` is midnight UTC — May 31st west of Greenwich.
    const buckets = receivableBuckets(
      [row({ dueDate: '2026-06-01', amount: 1000, openDue: 1000 })],
      { year: 2026, grain: 'monthly' },
    )
    expect(buckets[5].total).toBe(1000)
    expect(buckets[4].total).toBe(0)
  })
})

describe('receivableYears', () => {
  function row(dueDate: string): ReceivableRow {
    return { dueDate } as ReceivableRow
  }

  it('offers every year a receivable is due in, newest first', () => {
    expect(
      receivableYears([row('2025-01-01'), row('2027-05-05'), row('2026-01-01')], NOW),
    ).toEqual([2027, 2026, 2025])
  })

  it('always offers the current year, so the default is selectable', () => {
    expect(receivableYears([row('2019-01-01')], NOW)).toEqual([2026, 2019])
  })

  it('lists a year once however many rows fall in it', () => {
    expect(receivableYears([row('2026-01-01'), row('2026-09-09')], NOW)).toEqual([
      2026,
    ])
  })
})

describe('invoiceSelectionBlock', () => {
  function row(dealId: string, payerContactId: string): ReceivableRow {
    return { dealId, payerContactId } as ReceivableRow
  }

  it('blocks an empty selection', () => {
    expect(invoiceSelectionBlock([])).toMatch(/select a receivable/i)
  })

  it('blocks a selection spanning two deals', () => {
    expect(
      invoiceSelectionBlock([row('deal-1', 'c-1'), row('deal-2', 'c-1')]),
    ).toMatch(/one deal/i)
  })

  it('blocks a selection spanning two payers', () => {
    expect(
      invoiceSelectionBlock([row('deal-1', 'c-1'), row('deal-1', 'c-2')]),
    ).toMatch(/one party/i)
  })

  it('allows one deal and one payer, however many rows', () => {
    expect(
      invoiceSelectionBlock([
        row('deal-1', 'c-1'),
        row('deal-1', 'c-1'),
        row('deal-1', 'c-1'),
      ]),
    ).toBeNull()
  })
})
