import { describe, it, expect } from 'vitest'
import { mediaForUnit, leadsForUnit } from './unitScopedMarketing'

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

describe('leadsForUnit', () => {
  // No `as never[]` cast here (unlike `links` above): `leadsForUnit` is generic
  // over the row shape, so leaving this array's own inferred type intact keeps
  // `.map((l) => l.id)` below type-checking against a real `id` field.
  const leads = [{ id: '1', unitId: null }, { id: '2', unitId: 'u1' }]

  it('returns every lead when no unit is given', () => {
    expect(leadsForUnit(leads, null)).toHaveLength(2)
  })

  it('returns only that unit inquiries when one is given', () => {
    expect(leadsForUnit(leads, 'u1').map((l) => l.id)).toEqual(['2'])
  })
})
