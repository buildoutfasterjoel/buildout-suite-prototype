import { describe, expect, it } from 'vitest'
import type { Property, PropertyType, PropertyStatus } from '#/data/types'
import { filterProperties } from './propertyIndexFilters'

// Minimal fixture — only the fields filterProperties reads; cast keeps it small.
const base = () =>
  ({
    id: 'p1', name: 'Test Tower', slug: 'test-tower', status: 'active' as PropertyStatus,
    propertyType: 'office' as PropertyType, propertySubtype: 'Multi-Tenant',
    street: '100 Main St', city: 'Dallas', state: 'TX', zip: '75201', submarket: 'CBD',
    buildingSqFt: 10000,
  } as unknown as Property)

const emptyTypes = new Set<PropertyType>()
const emptyStatuses = new Set<PropertyStatus>()

describe('filterProperties', () => {
  it('returns all when query empty and no facets selected', () => {
    const props = [base(), { ...base(), id: 'p2', city: 'Austin' }]
    expect(filterProperties(props, { query: '', types: emptyTypes, statuses: emptyStatuses })).toHaveLength(2)
  })

  it('matches query against name/address/city (case-insensitive)', () => {
    const props = [base(), { ...base(), id: 'p2', name: 'Harbor Point', city: 'Austin' }]
    const out = filterProperties(props, { query: 'harbor', types: emptyTypes, statuses: emptyStatuses })
    expect(out.map((p) => p.id)).toEqual(['p2'])
  })

  it('filters by type and status facets', () => {
    const props = [
      base(),
      { ...base(), id: 'p2', propertyType: 'retail' as PropertyType },
      { ...base(), id: 'p3', status: 'closed' as PropertyStatus },
    ]
    expect(
      filterProperties(props, { query: '', types: new Set<PropertyType>(['retail']), statuses: emptyStatuses }).map((p) => p.id),
    ).toEqual(['p2'])
    expect(
      filterProperties(props, { query: '', types: emptyTypes, statuses: new Set<PropertyStatus>(['closed']) }).map((p) => p.id),
    ).toEqual(['p3'])
  })
})
