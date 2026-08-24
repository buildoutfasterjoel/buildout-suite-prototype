import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { useDataStore } from './dataStore'
import { allVouchers, voucherTotals, voucherHref } from './vouchers'

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

  it('sends a shell to its per-space Vouchers index', () => {
    resetStore()
    const parent = makeLease('Mall Assignment')
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 100', sqft: 1000, unitType: 'retail',
    })!
    addSpaceToDeal(parent.id, unit.id)
    // A shell earns nothing itself; its money is one voucher per space.
    expect(voucherHref(getListing(parent.id)!)).toEqual({
      to: '/listings/$listingId/vouchers',
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

  it('includes a shell and each of its spaces as separate rows', () => {
    resetStore()
    const parent = makeLease('Mall Assignment')
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite 210', sqft: 2000, unitType: 'office' })!
    const spaceA = addSpaceToDeal(parent.id, a.id)!.deal
    const spaceB = addSpaceToDeal(parent.id, b.id)!.deal

    const ids = allVouchers().map((r) => r.dealId)
    expect(ids).toHaveLength(3)
    expect(ids).toEqual(expect.arrayContaining([parent.id, spaceA.id, spaceB.id]))
  })

  it('totals a deal’s receivables net of what has been credited', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const listing = getListing(deal.id)!
    listing.transaction.backOffice.receivables = [
      { id: 'r1', payerName: 'A', payerEmail: 'a@x.com', dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 4000 },
      { id: 'r2', payerName: 'B', payerEmail: 'b@x.com', dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
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
