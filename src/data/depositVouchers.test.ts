import { describe, it, expect } from 'vitest'
import type { Contact } from './types'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { useDataStore } from './dataStore'
import { addReceivable, applyDeposit, submitVoucher } from './actions'
import { depositVouchers } from './depositVouchers'

function resetStore() {
  useDataStore.setState({
    properties: new Map(),
    listings: new Map(),
    comps: new Map(),
    contacts: new Map(),
  })
}

/** A payer in the store, so a receivable can name one. */
function addContact(id: string, firstName: string, lastName: string) {
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(id, {
      id,
      firstName,
      lastName,
      company: '',
      email: `${firstName}.${lastName}@example.com`.toLowerCase(),
      phone: '',
    } as unknown as Contact)
    return { contacts }
  })
}

function makeSale(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Sale' })
}

function bill(dealId: string, amount: number, dueDate = '2026-06-08') {
  addReceivable(dealId, {
    payerContactId: 'c-1',
    billToCompany: false,
    dueDate,
    billingDescription: 'Full Payment',
    amount,
  })
}

describe('depositVouchers', () => {
  it('offers a voucher with an outstanding receivable, and what it still owes', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    bill(deal.id, 30000)
    bill(deal.id, 12000, '2026-07-08')

    const options = depositVouchers().filter((o) => o.dealId === deal.id)
    expect(options).toHaveLength(1)
    expect(options[0].outstanding).toBe(42000)
    expect(options[0].receivables).toHaveLength(2)
    expect(options[0].approved).toBe(false)
  })

  it('drops a voucher once its receivables are fully paid', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    bill(deal.id, 30000)
    const receivable = getListing(deal.id)!.transaction.backOffice.receivables[0]

    expect(depositVouchers().some((o) => o.dealId === deal.id)).toBe(true)

    applyDeposit(deal.id, {
      date: '2026-06-10',
      amount: 30000,
      referenceNumber: '1234',
      receivableAllocations: [{ targetId: receivable.id, amount: 30000 }],
      deductionAllocations: [],
    })

    // Nothing left for a deposit to land on, so the pick would be a dead end.
    expect(depositVouchers().some((o) => o.dealId === deal.id)).toBe(false)
  })

  it('drops a voucher sitting with an approver, which cannot take a deposit', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    const deal = makeSale('1135 Kline St')
    bill(deal.id, 30000)
    expect(depositVouchers().some((o) => o.dealId === deal.id)).toBe(true)

    submitVoucher(deal.id)
    expect(getListing(deal.id)!.transaction.backOffice.status).toBe('Pending')
    // `applyDeposit` refuses a Pending voucher outright, so offering it would
    // be a pick whose Save silently does nothing.
    expect(depositVouchers().some((o) => o.dealId === deal.id)).toBe(false)
  })

  it('drops a voucher with nothing billed at all', () => {
    resetStore()
    const deal = makeSale('Nothing Billed')
    expect(depositVouchers().some((o) => o.dealId === deal.id)).toBe(false)
  })

  it("offers a split lease's spaces and not the shell that fed them", () => {
    resetStore()
    addContact('c-1', 'Portland', 'Prosper')
    const shell = createProposalListing({
      ...emptyDraft(),
      name: 'Mall Assignment',
      dealType: 'Lease',
    })
    bill(shell.id, 30000)

    const unit = addPropertyUnit(shell.propertyId, {
      label: 'Suite 100',
      sqft: 1000,
      unitType: 'retail',
    })!
    const space = addSpaceToDeal(shell.id, unit.id)!.deal

    const dealIds = depositVouchers().map((o) => o.dealId)
    expect(dealIds).toContain(space.id)
    expect(dealIds).not.toContain(shell.id)
  })

  it('sorts by voucher name, so a name does not move as balances change', () => {
    resetStore()
    addContact('c-1', 'Mandana', 'Massih')
    for (const [name, amount] of [
      ['Zephyr Tower', 1000],
      ['Alder Court', 900000],
      ['Meridian Park', 5000],
    ] as const) {
      bill(makeSale(name).id, amount)
    }
    expect(depositVouchers().map((o) => o.label)).toEqual([
      'Alder Court',
      'Meridian Park',
      'Zephyr Tower',
    ])
  })
})
