import { describe, expect, it } from 'vitest'
import type { Listing, Property, PropertyStatus, PropertyType } from '#/data/types'
import type { SpaceRow, SpaceStatus } from '#/data/propertySpaces'
import {
  EMPTY_FACETS,
  countActiveFacets,
  filterProperties,
  matchingSpaces,
  spaceFacetsActive,
  withoutDealSideFacets,
  type PropertyFacetState,
} from './propertyIndexFilters'

// Minimal fixture — only the fields the filter reads; cast keeps it small.
const base = (over: Partial<Property> = {}) =>
  ({
    id: 'p1', name: 'Test Tower', slug: 'test-tower', status: 'active' as PropertyStatus,
    propertyType: 'office' as PropertyType, propertySubtype: 'Multi-Tenant', buildingClass: 'A',
    street: '100 Main St', city: 'Dallas', state: 'TX', zip: '75201', county: 'Dallas', submarket: 'CBD', market: 'Dallas–Fort Worth',
    buildingSqFt: 10000, lotSqFt: 43560, residentialUnits: null, units: [], yearBuilt: 1998, apn: '12-34-567',
    lastPurchasePrice: 5_000_000, lastPurchaseDate: '2021-06-01', capRate: 0.065,
    ...over,
  }) as unknown as Property

const f = (over: Partial<PropertyFacetState> = {}): PropertyFacetState => ({ ...EMPTY_FACETS, ...over })
const ctx = { query: '' }

const space = (id: string, sqft: number, status: SpaceStatus): SpaceRow => ({
  unitId: id, label: id, suite: null, floor: 1, sqft, unitType: 'office', status,
  dealId: null, shellId: null, stage: null, leaseRate: null, leaseRateUnits: 'SF/Yr', tenantName: null, leaseExpiration: null,
})

describe('filterProperties — query and Property & Building', () => {
  it('returns all when nothing is set', () => {
    expect(filterProperties([base(), base({ id: 'p2', city: 'Austin' })], f(), ctx)).toHaveLength(2)
  })

  it('matches the query against name / address / city, case-insensitively', () => {
    const out = filterProperties([base(), base({ id: 'p2', name: 'Harbor Point', city: 'Austin' })], f(), { query: 'harbor' })
    expect(out.map((p) => p.id)).toEqual(['p2'])
  })

  it('filters by type (many) and class', () => {
    const props = [base(), base({ id: 'p2', propertyType: 'retail' as PropertyType }), base({ id: 'p3', buildingClass: 'C' })]
    expect(filterProperties(props, f({ types: ['retail'] }), ctx).map((p) => p.id)).toEqual(['p2'])
    expect(filterProperties(props, f({ types: ['retail', 'office'] }), ctx)).toHaveLength(3)
    expect(filterProperties(props, f({ classes: ['C'] }), ctx).map((p) => p.id)).toEqual(['p3'])
  })

  it('ranges are open-ended on either side', () => {
    const props = [base({ buildingSqFt: 5_000 }), base({ id: 'p2', buildingSqFt: 50_000 }), base({ id: 'p3', buildingSqFt: 500_000 })]
    expect(filterProperties(props, f({ buildingSize: { min: 10_000, max: null } }), ctx).map((p) => p.id)).toEqual(['p2', 'p3'])
    expect(filterProperties(props, f({ buildingSize: { min: null, max: 60_000 } }), ctx).map((p) => p.id)).toEqual(['p1', 'p2'])
    expect(filterProperties(props, f({ buildingSize: { min: 10_000, max: 60_000 } }), ctx).map((p) => p.id)).toEqual(['p2'])
  })

  it('lot size reads SF or acres by the unit chosen', () => {
    const p = base({ lotSqFt: 87_120 }) // 2 acres
    expect(filterProperties([p], f({ lotSize: { min: 1, max: 3 }, lotUnit: 'acres' }), ctx)).toHaveLength(1)
    expect(filterProperties([p], f({ lotSize: { min: 1, max: 3 }, lotUnit: 'sf' }), ctx)).toHaveLength(0)
  })

  it('units, year built, APN', () => {
    const props = [base({ residentialUnits: 24 }), base({ id: 'p2', residentialUnits: null, units: [{}, {}] as never, yearBuilt: 1975, apn: '99-00-111' })]
    expect(filterProperties(props, f({ units: { min: 10, max: null } }), ctx).map((p) => p.id)).toEqual(['p1'])
    expect(filterProperties(props, f({ units: { min: null, max: 5 } }), ctx).map((p) => p.id)).toEqual(['p2'])
    expect(filterProperties(props, f({ yearBuilt: { min: 1990, max: null } }), ctx).map((p) => p.id)).toEqual(['p1'])
    expect(filterProperties(props, f({ apn: '99-00' }), ctx).map((p) => p.id)).toEqual(['p2'])
  })
})

describe('filterProperties — spaces', () => {
  const tower = base({ id: 'tower', buildingSqFt: 400_000 })
  const spaces: Record<string, SpaceRow[]> = {
    tower: [space('Suite 100', 1_200, 'Available'), space('Suite 200', 30_000, 'Leased'), space('Suite 300', 2_000, 'Vacant')],
  }
  const spacesOf = (p: Property) => spaces[p.id] ?? []

  it('a 400,000 SF tower is a hit for "under 10,000 SF" through its suites, and those suites unfold', () => {
    const facet = f({ buildingSize: { min: null, max: 10_000 } })
    expect(filterProperties([tower], facet, { ...ctx, spacesOf }).map((p) => p.id)).toEqual(['tower'])
    expect(matchingSpaces(spaces.tower, facet).map((s) => s.label)).toEqual(['Suite 100', 'Suite 300'])
  })

  it('space availability matches when ANY space has the status — no Mixed value needed', () => {
    const facet = f({ spaceStatuses: ['Leased'] })
    expect(filterProperties([tower, base({ id: 'none' })], facet, { ...ctx, spacesOf }).map((p) => p.id)).toEqual(['tower'])
    expect(matchingSpaces(spaces.tower, facet).map((s) => s.label)).toEqual(['Suite 200'])
  })

  it('available SF reads only Available / Vacant spaces', () => {
    const facet = f({ availableSf: { min: 1_500, max: null } })
    // Suite 200 is 30,000 SF but Leased; Suite 300 (2,000, Vacant) is the hit.
    expect(matchingSpaces(spaces.tower, facet).map((s) => s.label)).toEqual(['Suite 300'])
    expect(filterProperties([tower], f({ availableSf: { min: 50_000, max: null } }), { ...ctx, spacesOf })).toHaveLength(0)
  })

  it('unfolds nothing when no space facet is set', () => {
    expect(spaceFacetsActive(f())).toBe(false)
    expect(matchingSpaces(spaces.tower, f({ types: ['office'] }))).toEqual([])
  })
})

describe('filterProperties — deals: Availability, View, Sale/Lease', () => {
  const deal = (over: Partial<Listing>): Listing =>
    ({ id: 'd', parentDealId: null, dealType: 'Sale', status: 'active', publishedAt: null, ...over }) as unknown as Listing
  const props = [
    base({ id: 'sale' }),
    base({ id: 'lease', status: 'proposal' as PropertyStatus }),
    base({ id: 'quiet', status: null as unknown as PropertyStatus }),
  ]
  const deals: Record<string, Listing[]> = {
    sale: [deal({ status: 'active', publishedAt: '2026-01-01' })],
    lease: [deal({ dealType: 'Lease', status: 'proposal' })],
    quiet: [],
  }
  const dealsOf = (p: Property) => deals[p.id] ?? []

  it('deal stage, with "none" as a real option', () => {
    expect(filterProperties(props, f({ statuses: ['active'] }), ctx).map((p) => p.id)).toEqual(['sale'])
    expect(filterProperties(props, f({ statuses: ['none'] }), ctx).map((p) => p.id)).toEqual(['quiet'])
    expect(filterProperties(props, f({ statuses: ['active', 'proposal'] }), ctx)).toHaveLength(2)
  })

  it('View: active deals vs active (published) listings', () => {
    expect(filterProperties(props, f({ activeDeals: true }), { ...ctx, dealsOf }).map((p) => p.id)).toEqual(['sale', 'lease'])
    expect(filterProperties(props, f({ activeListings: true }), { ...ctx, dealsOf }).map((p) => p.id)).toEqual(['sale'])
  })

  it('Sale/Lease: deal type and the sale-side ranges', () => {
    expect(filterProperties(props, f({ dealTypes: ['Lease'] }), { ...ctx, dealsOf }).map((p) => p.id)).toEqual(['lease'])
    const p = base({ lastPurchasePrice: 5_000_000, lastPurchaseDate: '2021-06-01', buildingSqFt: 10_000, residentialUnits: 50, capRate: 0.065 })
    expect(filterProperties([p], f({ salePrice: { min: 4_000_000, max: 6_000_000 } }), ctx)).toHaveLength(1)
    expect(filterProperties([p], f({ saleYear: { min: 2022, max: null } }), ctx)).toHaveLength(0)
    expect(filterProperties([p], f({ pricePerSf: { min: 400, max: 600 } }), ctx)).toHaveLength(1) // $500/SF
    expect(filterProperties([p], f({ pricePerUnit: { min: 90_000, max: 110_000 } }), ctx)).toHaveLength(1) // $100k/unit
    expect(filterProperties([p], f({ capRate: { min: 6, max: 7 } }), ctx)).toHaveLength(1) // 6.5%
    expect(filterProperties([p], f({ capRate: { min: 7, max: null } }), ctx)).toHaveLength(0)
  })
})

describe('facet bookkeeping', () => {
  it('counts active facets per group and strips deal-side facets for prospects', () => {
    const facet = f({ types: ['office'], buildingSize: { min: 1, max: null }, statuses: ['active'], activeDeals: true, capRate: { min: 5, max: null } })
    expect(countActiveFacets(facet)).toBe(5)
    expect(countActiveFacets(facet, 'property')).toBe(2)
    expect(countActiveFacets(facet, 'availability')).toBe(1)
    const prospect = withoutDealSideFacets(facet)
    expect(countActiveFacets(prospect)).toBe(2)
    expect(prospect.types).toEqual(['office'])
  })
})
