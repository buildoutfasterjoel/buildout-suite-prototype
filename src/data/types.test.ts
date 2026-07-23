import { describe, it, expect } from 'vitest'
import type { Lot, Condo, UnitMixRow, VisualMediaLink } from './types'

describe('listing-form record types', () => {
  it('constructs each new record type', () => {
    const lot: Lot = {
      id: 'l1', status: 'active', closeDate: null, buyerReferralSource: null,
      lotNumber: '1', address: '', apn: '', subtype: null, salePrice: null,
      priceUnits: 'Total', size: null, sizeUnits: 'Acre', description: '', zoning: '',
    }
    const condo: Condo = {
      id: 'c1', status: 'active', closeDate: null, addressUnit: '4B', salePrice: null,
      priceUnits: 'Total', hidePrice: false, hidePriceLabel: null, size: null,
      sizeUnits: 'Sq Ft', description: '',
    }
    const row: UnitMixRow = {
      id: 'u1', unitType: '1BR/1BA', bedrooms: 1, bathrooms: 1, count: 10, size: 750,
      rackRate: null, rent: 1800, minRent: null, maxRent: null, marketRent: 1850,
      securityDeposit: 1800, description: '',
    }
    const media: VisualMediaLink = { id: 'm1', url: 'https://x', mediaType: 'Matterport Tour' }
    expect([lot.id, condo.id, row.id, media.id]).toEqual(['l1', 'c1', 'u1', 'm1'])
  })
})
