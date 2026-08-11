import { describe, it, expect } from 'vitest'
import { mediaForUnit, leadsForSpaceDeal, ownedByUnit, buildingWide } from './unitScopedMarketing'

// No `as never[]` cast (unlike this file used to have): now that `mediaForUnit`
// is generic over `{ unitId }` rather than pinned to `VisualMediaLink[]`, this
// literal's inferred shape satisfies the constraint directly — a cast would
// only reintroduce the `never` type it was working around.
const links = [
  { id: 'a', url: 'http://x/1', mediaType: 'photo', unitId: null },
  { id: 'b', url: 'http://x/2', mediaType: 'photo', unitId: 'u1' },
  { id: 'c', url: 'http://x/3', mediaType: 'photo', unitId: 'u2' },
]

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

describe('ownedByUnit', () => {
  const list = [
    { unitId: null, tag: 'building' },
    { unitId: 'u1', tag: 'u1-a' },
    { unitId: 'u1', tag: 'u1-b' },
    { unitId: 'u2', tag: 'u2' },
  ]

  it("returns only the unit's own, never the building-wide ones", () => {
    // The whole point of this helper: the Media editor shows what a suite OWNS
    // separately from what it merely inherits, so it must not fall back.
    expect(ownedByUnit(list, 'u1').map((x) => x.tag)).toEqual(['u1-a', 'u1-b'])
  })

  it('returns nothing for a unit with no assets of its own', () => {
    expect(ownedByUnit(list, 'u3')).toEqual([])
  })
})

describe('buildingWide', () => {
  const list = [
    { unitId: null, tag: 'building-a' },
    { unitId: 'u1', tag: 'u1' },
    { unitId: null, tag: 'building-b' },
  ]

  it('returns only the assets that belong to no unit', () => {
    expect(buildingWide(list).map((x) => x.tag)).toEqual(['building-a', 'building-b'])
  })

  it('returns nothing when every asset is unit-scoped', () => {
    expect(buildingWide([{ unitId: 'u1' }, { unitId: 'u2' }])).toEqual([])
  })
})

describe('the three helpers together', () => {
  const list = [
    { unitId: null, tag: 'building' },
    { unitId: 'u1', tag: 'u1' },
    { unitId: 'u2', tag: 'u2' },
  ]

  it('ownedByUnit and buildingWide are disjoint, and their union is mediaForUnit', () => {
    // This is the invariant the editor relies on: it renders the two sets in two
    // separate blocks and must not drop or double-count anything between them.
    const own = ownedByUnit(list, 'u1')
    const wide = buildingWide(list)
    expect(own.some((a) => wide.includes(a))).toBe(false)
    expect([...own, ...wide].map((x) => x.tag).sort()).toEqual(
      mediaForUnit(list, 'u1').map((x) => x.tag).sort(),
    )
  })
})
