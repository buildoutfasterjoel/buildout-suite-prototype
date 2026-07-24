import { describe, it, expect } from 'vitest'
import {
  emptyLot, emptyCondo, emptyUnitMixRow, emptyVisualMediaLink, emptySpaceLeaseTerms,
} from './createListing'

describe('empty-record builders', () => {
  it('emptyLot defaults', () => {
    const lot = emptyLot()
    expect(lot.status).toBe('active')
    expect(lot.priceUnits).toBe('Total')
    expect(lot.salePrice).toBeNull()
    expect(typeof lot.id).toBe('string')
  })
  it('emptyCondo defaults', () => {
    const c = emptyCondo()
    expect(c.hidePrice).toBe(false)
    expect(c.sizeUnits).toBe('Sq Ft')
  })
  it('emptyUnitMixRow defaults', () => {
    expect(emptyUnitMixRow().count).toBeNull()
  })
  it('emptyVisualMediaLink defaults', () => {
    expect(emptyVisualMediaLink().mediaType).toBe('Interactive Site Plan')
  })
  it('emptySpaceLeaseTerms defaults new fields', () => {
    const t = emptySpaceLeaseTerms('unit-1')
    expect(t.leaseRateMode).toBe('Flat')
    expect(t.majorTenant).toBe(false)
    expect(t.status).toBe('Active')
  })
})
