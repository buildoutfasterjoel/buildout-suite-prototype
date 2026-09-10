import { describe, expect, it } from 'vitest'
import { marketingReadiness, newDealMarketingGaps } from './marketingReadiness'
import type { Listing, Property } from './types'

/** Only the fields `marketingReadiness` reads — the rest of the record is irrelevant. */
function saleDeal(over: Record<string, unknown> = {}): Listing {
  return {
    dealType: 'Sale',
    financials: { askingPrice: 1_950_000 },
    marketing: {
      saleDescription: 'Corner lot with drive-thru',
      locationDescription: 'Hard corner in the Loop',
      leaseTitle: '',
      leaseDescription: '',
      spaceLeaseTerms: [],
    },
    ...over,
  } as unknown as Listing
}

function leaseDeal(over: Record<string, unknown> = {}): Listing {
  return {
    dealType: 'Lease',
    financials: { askingPrice: 0 },
    marketing: {
      saleDescription: '',
      locationDescription: '',
      leaseTitle: 'Suite 400 Available',
      leaseDescription: 'Built-out office with river views',
      spaceLeaseTerms: [{ leaseType: 'NNN' }],
    },
    ...over,
  } as unknown as Listing
}

const property = { buildingClass: 'B', buildingSqFt: 41_000 } as unknown as Property

describe('marketingReadiness', () => {
  it('a fully filled sale deal is ready', () => {
    expect(marketingReadiness(saleDeal(), property, 'sale')).toEqual({
      ready: true,
      missing: [],
    })
  })

  it('a fully filled lease deal is ready', () => {
    expect(marketingReadiness(leaseDeal(), property, 'flat-lease')).toEqual({
      ready: true,
      missing: [],
    })
  })

  it('reports every missing sale field, and never the lease ones', () => {
    const bare = saleDeal({
      financials: { askingPrice: 0 },
      marketing: {
        saleDescription: '   ',
        locationDescription: '',
        leaseTitle: '',
        leaseDescription: '',
        spaceLeaseTerms: [],
      },
    })
    const { ready, missing } = marketingReadiness(
      bare,
      { buildingClass: '', buildingSqFt: 0 } as unknown as Property,
      'sale',
    )
    expect(ready).toBe(false)
    expect(missing).toEqual([
      'askingPrice',
      'saleDescription',
      'locationDescription',
      'buildingClass',
      'buildingSqFt',
    ])
  })

  it('a brand-new lease deal has no space yet, so Lease Type is missing', () => {
    const fresh = leaseDeal({
      marketing: {
        saleDescription: '',
        locationDescription: '',
        leaseTitle: '',
        leaseDescription: '',
        spaceLeaseTerms: [],
      },
    })
    expect(marketingReadiness(fresh, property, 'flat-lease').missing).toEqual([
      'leaseType',
      'leaseTitle',
      'leaseDescription',
    ])
  })

  it('a shell is not asked for a lease type — its spaces each hold their own', () => {
    const shell = leaseDeal({
      marketing: {
        saleDescription: '',
        locationDescription: '',
        leaseTitle: 'Riverside Commons',
        leaseDescription: 'Three suites remaining',
        spaceLeaseTerms: [],
      },
    })
    expect(marketingReadiness(shell, property, 'shell')).toEqual({
      ready: true,
      missing: [],
    })
  })

  it('a space is always ready — its building owns every gated section', () => {
    const bare = { dealType: 'Lease', financials: { askingPrice: 0 }, marketing: {} }
    expect(
      marketingReadiness(bare as unknown as Listing, property, 'space'),
    ).toEqual({ ready: true, missing: [] })
  })
})

describe('newDealMarketingGaps', () => {
  it('a sale deal on a known property is short only its copy and price', () => {
    expect(newDealMarketingGaps('Sale', property)).toEqual([
      'askingPrice',
      'saleDescription',
      'locationDescription',
    ])
  })

  it('a raw address knows neither the class nor the size', () => {
    expect(newDealMarketingGaps('Sale', undefined)).toEqual([
      'askingPrice',
      'saleDescription',
      'locationDescription',
      'buildingClass',
      'buildingSqFt',
    ])
  })

  it('a lease deal is short every lease field, price and building facts aside', () => {
    expect(newDealMarketingGaps('Lease', property)).toEqual([
      'leaseType',
      'leaseTitle',
      'leaseDescription',
    ])
  })
})
