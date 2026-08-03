import { describe, it, expect } from 'vitest'
import { mediaForUnit, leadsForSpaceDeal } from './unitScopedMarketing'

const links = [
  { id: 'a', url: 'http://x/1', mediaType: 'photo', unitId: null },
  { id: 'b', url: 'http://x/2', mediaType: 'photo', unitId: 'u1' },
  { id: 'c', url: 'http://x/3', mediaType: 'photo', unitId: 'u2' },
] as never[]

describe('mediaForUnit', () => {
  it('returns the whole library when no unit is given', () => {
    expect(mediaForUnit(links, null)).toHaveLength(3)
  })

  it('returns a unit its own assets plus the building-wide ones', () => {
    expect(mediaForUnit(links, 'u1').map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('leadsForSpaceDeal', () => {
  // No `as never[]` cast here (unlike `links` above): `leadsForSpaceDeal` is
  // generic over the row shape, so leaving this array's own inferred type
  // intact keeps `.map((l) => l.id)` below type-checking against a real `id`
  // field. Contact '1' inquired on the building's own listing only; contact
  // '2' inquired on the space deal; contact '3' inquired on BOTH — proving a
  // single lead can legitimately show up under more than one space.
  const leads = [
    { id: '1', inquiredListingIds: ['whole-building-listing'] },
    { id: '2', inquiredListingIds: ['space-deal-1'] },
    { id: '3', inquiredListingIds: ['whole-building-listing', 'space-deal-1'] },
  ]

  it('returns every lead when no space deal is given', () => {
    expect(leadsForSpaceDeal(leads, null)).toHaveLength(3)
  })

  it('returns only that space deal\'s inquirers when one is given', () => {
    expect(leadsForSpaceDeal(leads, 'space-deal-1').map((l) => l.id)).toEqual([
      '2', '3',
    ])
  })
})
