import { describe, expect, it } from 'vitest'
import { isEmptyValue, resolveField, resolveFieldValue } from './dynamic'
import type { DocumentData } from './dynamic'
import type { MarketingField } from './types'
import type { DealMarketing, Property } from '#/data/types'

const property = {
  name: 'The Thompson Block',
  buildingSqFt: 176761,
  askingPrice: 2000000,
  capRate: 6.25,
  residentialUnits: null,
  driveInBays: 0,
  freeStanding: true,
} as unknown as Property

const marketing = {
  saleDescription: 'A premier commercial opportunity.',
  saleBullets: ['Corner lot', 'Fully leased'],
  auction: false,
  availableSqFt: 12000,
} as unknown as DealMarketing

const data: DocumentData = { property, marketing }

describe('resolveField', () => {
  it('resolves a property key', () => {
    expect(resolveField('name', 'text', data)).toBe('The Thompson Block')
  })

  it('routes a marketing.* key to the marketing record', () => {
    expect(resolveField('marketing.saleDescription', 'text', data)).toBe(
      'A premier commercial opportunity.',
    )
  })

  it('formats currency, percent, and booleans', () => {
    expect(resolveField('askingPrice', 'currency', data)).toBe('$2,000,000')
    expect(resolveField('capRate', 'percent', data)).toBe('6.25%')
    expect(resolveField('freeStanding', 'boolean', data)).toBe('Yes')
    expect(resolveField('marketing.auction', 'boolean', data)).toBe('No')
  })

  // A document opened before its data loads must not print "undefined".
  it('returns an em dash when the record behind the key is missing', () => {
    expect(resolveField('marketing.saleDescription', 'text', { property, marketing: undefined })).toBe('—')
    expect(resolveField('name', 'text', { property: undefined, marketing })).toBe('—')
    expect(resolveField('residentialUnits', 'text', data)).toBe('—')
  })
})

describe('resolveFieldValue', () => {
  // Row pruning tests the raw value, so it must not collapse null and "—".
  it('returns the raw value, not the formatted string', () => {
    expect(resolveFieldValue('buildingSqFt', data)).toBe(176761)
    expect(resolveFieldValue('residentialUnits', data)).toBeNull()
    expect(resolveFieldValue('marketing.saleBullets', data)).toEqual(['Corner lot', 'Fully leased'])
  })
})

// A type-level guard: widening DealMarketing later must not silently make the
// stage flags or the per-unit lease records bindable.
describe('MarketingField', () => {
  it('excludes publishFlags and spaceLeaseTerms', () => {
    type Excluded = Extract<MarketingField, 'publishFlags' | 'spaceLeaseTerms'>
    type Included = Extract<MarketingField, 'saleDescription' | 'saleBullets' | 'leaseTitle'>
    const noneExcluded: Excluded[] = []
    const allIncluded: Included[] = ['saleDescription', 'saleBullets', 'leaseTitle']
    expect(noneExcluded).toHaveLength(0)
    expect(allIncluded).toHaveLength(3)
  })
})

describe('isEmptyValue', () => {
  it('treats null, undefined, blank strings, and empty arrays as empty', () => {
    expect(isEmptyValue(null)).toBe(true)
    expect(isEmptyValue(undefined)).toBe(true)
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue('   ')).toBe(true)
    expect(isEmptyValue([])).toBe(true)
  })

  // A property with zero drive-in bays recorded that fact; it is not missing data.
  it('treats 0 and false as present', () => {
    expect(isEmptyValue(0)).toBe(false)
    expect(isEmptyValue(false)).toBe(false)
  })
})
