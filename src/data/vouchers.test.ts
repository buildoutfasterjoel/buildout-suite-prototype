import { describe, it, expect } from 'vitest'
import type { Contact } from './types'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { useDataStore } from './dataStore'
import {
  allVouchers,
  isVoucherPending,
  partyContactIds,
  partySectionTitle,
  payerFormOptions,
  payerRemovalBlock,
  receivablePayerLabel,
  voucherHref,
  voucherParty,
  voucherPayers,
  voucherTotals,
} from './vouchers'
import { submitVoucher } from './actions'

function makeSale(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Sale' })
}

function makeLease(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Lease' })
}

/** Empty the store so a test counts only the deals it made itself. */
function resetStore() {
  useDataStore.setState({
    properties: new Map(),
    listings: new Map(),
    comps: new Map(),
    contacts: new Map(),
  })
}

describe('voucherHref', () => {
  it('sends a sale deal to its own Voucher tab', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    expect(voucherHref(deal)).toEqual({
      to: '/listings/$listingId/financials',
      params: { listingId: deal.id },
    })
  })

  it('sends a lease deal with no spaces to its own Voucher tab', () => {
    resetStore()
    // A flat lease is not a shell until a space exists — it keeps a voucher.
    const deal = makeLease('Standalone Lease')
    expect(voucherHref(deal)).toEqual({
      to: '/listings/$listingId/financials',
      params: { listingId: deal.id },
    })
  })

  it('sends a space to its voucher under the shell', () => {
    resetStore()
    const parent = makeLease('Mall Assignment')
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 100', sqft: 1000, unitType: 'retail',
    })!
    const space = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(voucherHref(space)).toEqual({
      to: '/listings/$listingId/spaces/$spaceId/financials',
      params: { listingId: parent.id, spaceId: space.id },
    })
  })

  it('reports no voucher for a shell', () => {
    resetStore()
    const parent = makeLease('Mall Assignment')
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 100', sqft: 1000, unitType: 'retail',
    })!
    addSpaceToDeal(parent.id, unit.id)
    // Splitting a lease deal hands the transaction to each space. The building
    // keeps the assignment, not the money — so it has no voucher of its own.
    expect(voucherHref(getListing(parent.id)!)).toBeNull()
  })

  it('gives the voucher back if the last space is removed', () => {
    resetStore()
    const parent = makeLease('Mall Assignment')
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 100', sqft: 1000, unitType: 'retail',
    })!
    const space = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(voucherHref(getListing(parent.id)!)).toBeNull()

    // `dealShape` reads whether children exist, so this is derived rather than
    // stamped on at split time — which is what makes it reversible. The stored
    // `backOffice` record was never cleared, and the fixtures rely on that:
    // a child copies the shell's record when it is created.
    useDataStore.setState((st) => {
      const listings = new Map(st.listings)
      listings.delete(space.id)
      return { listings }
    })
    expect(voucherHref(getListing(parent.id)!)).toEqual({
      to: '/listings/$listingId/financials',
      params: { listingId: parent.id },
    })
  })
})

describe('allVouchers', () => {
  it('returns one row per deal, carrying the deal its voucher settles', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')

    const rows = allVouchers()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      dealId: deal.id,
      dealName: deal.name,
      identifier: deal.transaction.backOffice.identifier,
      // createListing seeds every new deal's voucher as a Draft.
      status: 'Draft',
      dealType: 'Sale',
      dealStage: 'proposal',
    })
  })

  it('lists each space but not the shell they hang off', () => {
    resetStore()
    const parent = makeLease('Mall Assignment')
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite 210', sqft: 2000, unitType: 'office' })!
    const spaceA = addSpaceToDeal(parent.id, a.id)!.deal
    const spaceB = addSpaceToDeal(parent.id, b.id)!.deal

    const ids = allVouchers().map((r) => r.dealId)
    expect(ids).toEqual(expect.arrayContaining([spaceA.id, spaceB.id]))
    // The building would otherwise sit in the list beside its own suites,
    // claiming a voucher it does not have.
    expect(ids).not.toContain(parent.id)
    expect(ids).toHaveLength(2)
  })

  it('still lists a lease deal that has no spaces yet', () => {
    resetStore()
    // A lease deal is only a shell once it has children; before that it is a
    // normal whole-building listing and keeps its voucher.
    const parent = makeLease('Standalone Lease')
    expect(allVouchers().map((r) => r.dealId)).toEqual([parent.id])
  })

  it('totals a deal’s receivables net of what has been credited', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const listing = getListing(deal.id)!
    listing.transaction.backOffice.receivables = [
      { id: 'r1', payerContactId: 'c1', billToCompany: false, dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 4000 },
      { id: 'r2', payerContactId: 'c2', billToCompany: false, dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
    ]

    expect(allVouchers()[0]!.receivablesOutstanding).toBe(11000)
  })

  it('reports no outstanding receivables when a voucher has none', () => {
    resetStore()
    makeSale('Riverside Tower')
    expect(allVouchers()[0]!.receivablesOutstanding).toBe(0)
  })

  it('sorts by voucher name so the list order is stable across renders', () => {
    resetStore()
    // The store returns insertion order, which is arbitrary to a broker.
    makeSale('Zenith Plaza')
    makeSale('Adler Building')
    makeSale('Monroe Center')

    expect(allVouchers().map((r) => r.name)).toEqual([
      'Adler Building', 'Monroe Center', 'Zenith Plaza',
    ])
  })

  it('carries the address and primary broker the toolbar filters on', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const listing = getListing(deal.id)!
    listing.internalBrokers = [
      { id: 'b1', name: 'Ada Nunez', role: 'Primary Broker', email: 'a@x.com',
        side: 'internal', commissionSplitPct: 100, grossCommission: 0 },
    ]

    const r = allVouchers()[0]!
    expect(r.brokerName).toBe('Ada Nunez')
    // The property createProposalListing made carries no street, so the joined
    // address is whatever of city/state/zip exists — never undefined text.
    expect(r.propertyAddress).not.toContain('undefined')
  })

  it('normalises the created date to a plain day for the date windows', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const created = new Date(getListing(deal.id)!.createdAt)
    const expected = [
      created.getFullYear(),
      String(created.getMonth() + 1).padStart(2, '0'),
      String(created.getDate()).padStart(2, '0'),
    ].join('-')

    expect(allVouchers()[0]!.createdOn).toBe(expected)
    expect(allVouchers()[0]!.createdOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('reports no broker when the deal has none', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    getListing(deal.id)!.internalBrokers = []
    expect(allVouchers()[0]!.brokerName).toBeNull()
  })

  it('gives a brand-new deal a Draft voucher, so the page always has a status', () => {
    // The voucher page reads this to choose between Submit and Edit; a deal
    // with no voucher record would leave that header with nothing to show.
    resetStore()
    const deal = makeSale('Riverside Tower')
    expect(getListing(deal.id)!.transaction.backOffice.status).toBe('Draft')
    expect(allVouchers()[0]!.status).toBe('Draft')
  })

  it('returns nothing when there are no deals', () => {
    resetStore()
    expect(allVouchers()).toEqual([])
  })
})

describe('isVoucherPending', () => {
  it('is false for a brand-new deal, whose voucher is a Draft', () => {
    resetStore()
    expect(isVoucherPending(makeSale('Riverside Tower'))).toBe(false)
  })

  it('is true once the voucher is submitted', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    submitVoucher(deal.id)
    expect(isVoucherPending(getListing(deal.id)!)).toBe(true)
  })

  it('is false for a shell, whatever its leftover voucher record says', () => {
    // The load-bearing case. A shell keeps the `backOffice` record it had from
    // before it was split — the money belongs to its spaces now — so a bare
    // status check would lock a building's form over a voucher that is not the
    // building's any more. The space's own voucher is unaffected either way.
    resetStore()
    const parent = makeLease('Mall Assignment')
    submitVoucher(parent.id)
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 100', sqft: 1000, unitType: 'retail',
    })!
    addSpaceToDeal(parent.id, unit.id)

    const shell = getListing(parent.id)!
    expect(shell.transaction.backOffice.status).toBe('Pending')
    expect(isVoucherPending(shell)).toBe(false)
  })
})

describe('voucherPayers', () => {
  it('sums what each payer was billed, gross of credits', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1', 'c2']
    voucher.receivables = [
      { id: 'r1', payerContactId: 'c1', billToCompany: false, dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 4000 },
      { id: 'r2', payerContactId: 'c1', billToCompany: false, dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
      { id: 'r3', payerContactId: 'c2', billToCompany: false, dueDate: '2026-03-01', billingDescription: 'Fee', amount: 2500, credited: 0 },
    ]
    const rows = voucherPayers(voucher)
    // Gross, not net: "Billed" answers what they were asked for. The Credited
    // column in the Receivables table answers what has been paid.
    expect(rows.map((r) => r.billed)).toEqual([15000, 2500])
    expect(rows.map((r) => r.receivableCount)).toEqual([2, 1])
  })

  it('reads zero for a payer with nothing billed yet', () => {
    // A named payer with no receivable is a real state — you name who you are
    // going to bill before you bill them — so the row stays and reads $0.
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = []
    expect(voucherPayers(voucher)).toHaveLength(1)
    expect(voucherPayers(voucher)[0]!.billed).toBe(0)
    expect(voucherPayers(voucher)[0]!.receivableCount).toBe(0)
  })

  it('keeps the payers in the order they were added', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c2', 'c1']
    voucher.receivables = []
    expect(voucherPayers(voucher).map((r) => r.contactId)).toEqual(['c2', 'c1'])
  })
})

describe('receivablePayerLabel', () => {
  function seedContact(over: Partial<Contact> = {}) {
    const c = {
      id: 'c1', firstName: 'Mark', lastName: 'Payer',
      email: 'mark.payer@buildout.com', company: 'ABC, Corp.',
    } as Contact
    useDataStore.setState({ contacts: new Map([['c1', { ...c, ...over }]]) })
  }

  it('bills a person by name and email, so two same-named contacts read apart', () => {
    resetStore()
    seedContact()
    expect(receivablePayerLabel('c1', false)).toBe('Mark Payer (mark.payer@buildout.com)')
  })

  it('bills a company by its name alone', () => {
    resetStore()
    seedContact()
    expect(receivablePayerLabel('c1', true)).toBe('ABC, Corp.')
  })

  it('falls back to the person when the contact has no company', () => {
    // `billToCompany` can only be set through a picker that omits the company
    // form for such a contact, but a stored true must still render something.
    resetStore()
    seedContact({ company: '' })
    expect(receivablePayerLabel('c1', true)).toBe('Mark Payer (mark.payer@buildout.com)')
  })
})

describe('payerFormOptions', () => {
  function seedOne(over: Partial<Contact> = {}) {
    const c = {
      id: 'c1', firstName: 'Mark', lastName: 'Payer',
      email: 'mark.payer@buildout.com', company: 'ABC, Corp.',
    } as Contact
    useDataStore.setState({ contacts: new Map([['c1', { ...c, ...over }]]) })
  }

  it('offers the person and their company — and nobody else', () => {
    // The row's dropdown asks how ONE payer is addressed, not who is billed.
    // Anything longer than these two would let it change the payer outright.
    resetStore()
    seedOne()
    expect(payerFormOptions('c1')).toEqual([
      { value: 'person', label: 'Mark Payer (mark.payer@buildout.com)' },
      { value: 'company', label: 'ABC, Corp.' },
    ])
  })

  it('offers only the person when they have no company', () => {
    resetStore()
    seedOne({ company: '' })
    expect(payerFormOptions('c1')).toEqual([
      { value: 'person', label: 'Mark Payer (mark.payer@buildout.com)' },
    ])
  })
})

describe('payerRemovalBlock', () => {
  it('refuses to remove a payer that has receivables', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = [
      { id: 'r1', payerContactId: 'c1', billToCompany: false, dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 0 },
      { id: 'r2', payerContactId: 'c1', billToCompany: false, dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
    ]
    const reason = payerRemovalBlock(voucherPayers(voucher)[0]!)
    expect(reason).toContain('2 receivables')
  })

  it('says "receivable" in the singular for one', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = [
      { id: 'r1', payerContactId: 'c1', billToCompany: false, dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 0 },
    ]
    expect(payerRemovalBlock(voucherPayers(voucher)[0]!)).toContain('1 receivable.')
  })

  it('allows removing a payer with nothing billed', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = []
    expect(payerRemovalBlock(voucherPayers(voucher)[0]!)).toBeNull()
  })
})

describe('partyContactIds', () => {
  it('reads the buyers on a sale', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const listing = getListing(deal.id)!
    listing.buyerContactIds = ['b1']
    listing.tenantContactIds = ['t1']
    expect(partyContactIds(listing)).toEqual(['b1'])
    expect(partySectionTitle(listing.dealType)).toBe('Buyer')
  })

  it('reads the tenants on a lease', () => {
    resetStore()
    const deal = makeLease('Standalone Lease')
    const listing = getListing(deal.id)!
    listing.buyerContactIds = ['b1']
    listing.tenantContactIds = ['t1']
    expect(partyContactIds(listing)).toEqual(['t1'])
    expect(partySectionTitle(listing.dealType)).toBe('Tenant')
  })
})

describe('voucherTotals', () => {
  it('sums gross commission and counts vouchers per status', () => {
    const rows = [
      { status: 'Draft' as const, grossCommission: 100 },
      { status: 'Draft' as const, grossCommission: 250 },
      { status: 'Pending' as const, grossCommission: 500 },
      { status: 'Approved' as const, grossCommission: 1000 },
    ]

    expect(voucherTotals(rows)).toEqual({
      Draft: { count: 2, grossCommission: 350 },
      Pending: { count: 1, grossCommission: 500 },
      Approved: { count: 1, grossCommission: 1000 },
    })
  })

  it('reports every status even when none carry a voucher', () => {
    // The KPI band shows three tiles unconditionally; a missing key would
    // render "undefined Vouchers" rather than a zero.
    expect(voucherTotals([])).toEqual({
      Draft: { count: 0, grossCommission: 0 },
      Pending: { count: 0, grossCommission: 0 },
      Approved: { count: 0, grossCommission: 0 },
    })
  })
})

describe('voucherParty', () => {
  it('reads name, company, email and phone off the contact', () => {
    // `makeSale` with `emptyDraft()` links no contact — `sellerContactId` is
    // `''`, so `createProposalListing` never resolves a seller and the store
    // stays empty. Seeded directly instead, the way `signal.test.ts` does.
    resetStore()
    const contact = {
      id: 'c1',
      firstName: 'Dana',
      lastName: 'Osei',
      email: 'dana@osei.example.com',
      phone: '555-0100',
      company: 'Osei Retail',
      propertyIds: [],
      role: 'buyer',
    } as unknown as Contact
    useDataStore.setState({ contacts: new Map([[contact.id, contact]]) })

    const party = voucherParty(contact.id)
    expect(party.name).toBe(`${contact.firstName} ${contact.lastName}`.trim())
    expect(party.company).toBe(contact.company)
    expect(party.email).toBe(contact.email)
    expect(party.exists).toBe(true)
  })

  it('keeps the row when the contact is gone', () => {
    // A voucher is a record of what was billed. Deleting a contact must not
    // make a billed line vanish, so this returns a readable placeholder rather
    // than null and leaves the caller nothing to crash on.
    resetStore()
    const party = voucherParty('no-such-contact')
    expect(party.name).toBe('Unknown contact')
    expect(party.exists).toBe(false)
    expect(party.company).toBe('')
    expect(party.email).toBe('')
  })
})
