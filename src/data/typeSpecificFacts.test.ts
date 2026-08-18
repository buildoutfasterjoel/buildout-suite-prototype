import { describe, expect, it } from 'vitest'
import { generateDataset } from './seed'

describe('type-specific property facts', () => {
  const { properties } = generateDataset()

  // The document editor's Property Summary prunes rows whose value is empty, so
  // an asset class with no facts recorded renders the same generic table as
  // every other one. These assertions are what keep that from silently
  // regressing to the generic case.
  it('gives industrial properties their warehouse facts', () => {
    const industrial = properties.filter((p) => p.propertyType === 'industrial')
    expect(industrial.length).toBeGreaterThan(0)
    for (const p of industrial) {
      expect(p.dockHighDoors).toBeTypeOf('number')
      expect(p.ceilingHeight).toBeTypeOf('number')
      expect(p.warehousePct).toBeTypeOf('number')
    }
  })

  it('gives office properties their tower facts', () => {
    const office = properties.filter((p) => p.propertyType === 'office')
    expect(office.length).toBeGreaterThan(0)
    for (const p of office) {
      expect(p.numberOfElevators).toBeTypeOf('number')
      expect(p.tenancy).toBeDefined()
    }
  })

  // Off-type fields must stay undefined, not null or 0 — the row rules prune on
  // emptiness, and a 0 would print as a real recorded value.
  it('leaves off-type facts undefined', () => {
    for (const p of properties.filter((p) => p.propertyType === 'office')) {
      expect(p.dockHighDoors).toBeUndefined()
      expect(p.soilType).toBeUndefined()
    }
  })
})
