import { describe, expect, it } from 'vitest'
import type { Property, PropertyType, PropertyStatus } from '#/data/types'
import { filterProperties, matchingSpaces, spaceFacetsActive } from './propertyIndexFilters'

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

  it('filters by building-size band, half-open at the upper bound', () => {
    const props = [
      { ...base(), id: 'small', buildingSqFt: 9_999 },
      { ...base(), id: 'mid', buildingSqFt: 10_000 },
      { ...base(), id: 'large', buildingSqFt: 250_000 },
    ]
    const bandIds = (size: Parameters<typeof filterProperties>[1]['size']) =>
      filterProperties(props, { query: '', types: emptyTypes, statuses: emptyStatuses, size }).map((p) => p.id)

    expect(bandIds('lt10k')).toEqual(['small'])
    expect(bandIds('10k-50k')).toEqual(['mid'])
    expect(bandIds('gt100k')).toEqual(['large'])
    expect(bandIds('all')).toHaveLength(3)
    // Omitted is the same as 'all' — the toolbar's default.
    expect(bandIds(undefined)).toHaveLength(3)
  })
})

describe('filterProperties — space availability', () => {
  const props = [
    { ...base(), id: 'mixed' },
    { ...base(), id: 'leased' },
    { ...base(), id: 'none' },
  ]
  // What each building's spaces carry; `none` has no spaces at all.
  const row = (status: 'Available' | 'Leased' | 'Occupied'): import('#/data/propertySpaces').SpaceRow =>
    ({ unitId: status, label: status, suite: null, floor: null, sqft: 1000, unitType: 'office', status, dealId: null, shellId: null, stage: null, leaseRate: null, leaseRateUnits: 'SF/Yr', tenantName: null, leaseExpiration: null })
  const spaces: Record<string, import('#/data/propertySpaces').SpaceRow[]> = {
    mixed: [row('Available'), row('Leased'), row('Occupied')],
    leased: [row('Leased')],
    none: [],
  }
  const availabilityOf = (p: Property) => spaces[p.id]

  it('matches a building when ANY of its spaces has the status — no Mixed value needed', () => {
    const out = filterProperties(props, {
      query: '', types: emptyTypes, statuses: emptyStatuses,
      availability: new Set(['Available']), spacesOf: availabilityOf,
    })
    expect(out.map((p) => p.id)).toEqual(['mixed'])
  })

  it('never matches a building with no spaces', () => {
    const out = filterProperties(props, {
      query: '', types: emptyTypes, statuses: emptyStatuses,
      availability: new Set(['Leased']), spacesOf: availabilityOf,
    })
    expect(out.map((p) => p.id)).toEqual(['mixed', 'leased'])
  })

  it('is a no-op with an empty set', () => {
    const out = filterProperties(props, {
      query: '', types: emptyTypes, statuses: emptyStatuses,
      availability: new Set(), spacesOf: availabilityOf,
    })
    expect(out).toHaveLength(3)
  })
})

describe('filterProperties — size reads the spaces too, and the row learns which matched', () => {
  const space = (id: string, sqft: number, status: 'Available' | 'Vacant' | 'Leased'): import('#/data/propertySpaces').SpaceRow =>
    ({ unitId: id, label: id, suite: null, floor: 1, sqft, unitType: 'office', status, dealId: null, shellId: null, stage: null, leaseRate: null, leaseRateUnits: 'SF/Yr', tenantName: null, leaseExpiration: null })
  const tower = { ...base(), id: 'tower', buildingSqFt: 400_000 }
  const spaces: Record<string, ReturnType<typeof space>[]> = {
    tower: [space('Suite 100', 1_200, 'Available'), space('Suite 200', 30_000, 'Leased')],
  }
  const spacesOf = (p: Property) => spaces[p.id] ?? []

  it('a 400,000 SF tower is a hit for "under 10,000 SF" through its 1,200 SF suite', () => {
    const out = filterProperties([tower], { query: '', types: emptyTypes, statuses: emptyStatuses, size: 'lt10k', spacesOf })
    expect(out.map((p) => p.id)).toEqual(['tower'])
    expect(matchingSpaces(spaces.tower, { size: 'lt10k' }).map((s) => s.label)).toEqual(['Suite 100'])
  })

  it('combines size and availability on the same suite', () => {
    expect(matchingSpaces(spaces.tower, { size: 'lt10k', availability: new Set(['Leased']) })).toEqual([])
    expect(matchingSpaces(spaces.tower, { availability: new Set(['Leased']) }).map((s) => s.label)).toEqual(['Suite 200'])
  })

  it('unfolds nothing when no space facet is set', () => {
    expect(spaceFacetsActive({ size: 'all', availability: new Set() })).toBe(false)
    expect(matchingSpaces(spaces.tower, { size: 'all' })).toEqual([])
  })
})
