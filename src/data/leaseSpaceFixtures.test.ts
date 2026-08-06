import { describe, expect, it } from 'vitest'
import { getProperty, getStore } from './store'
import { getChildDeals } from './leaseSpaces'
import { buildingAvailability } from './buildingAvailability'
import { canAddSpaces, dealShape } from './dealShape'
import { SHELL_SPECS } from './leaseSpaceFixtures'

/**
 * Read through the live store, not a fresh `generateDataset()` call. The Zustand
 * store self-seeds at import (`dataStore.ts:145`), so this is the same data the
 * app sees — and it is what the derived selectors below read anyway.
 */
function shellFor(dealId: string) {
  const shell = [...getStore().listings.values()].find((l) => l.dealId === dealId)
  if (!shell) throw new Error(`no seeded deal ${dealId}`)
  const property = getProperty(shell.propertyId)
  if (!property) throw new Error(`no property for deal ${dealId}`)
  return { shell, property }
}

describe('shell preparation', () => {
  it('re-slices each shell property into one suite per child stage', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      expect(property.units).toHaveLength(spec.childStages.length)
    }
  })

  it('keeps the suites summing to the building', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      const total = property.units.reduce((sum, u) => sum + u.sqft, 0)
      expect(total).toBe(property.buildingSqFt)
    }
  })

  it('leaves every rent roll row pointing at a live unit', () => {
    for (const spec of SHELL_SPECS) {
      const { shell, property } = shellFor(spec.dealId)
      const unitIds = new Set(property.units.map((u) => u.id))
      for (const row of shell.financials.rentRoll) {
        expect(unitIds.has(row.unitId ?? '')).toBe(true)
      }
    }
  })

  // Every suite keeps exactly one terms row — but after the split that row lives
  // on the suite's own child deal, not on the shell. This is the building-wide
  // version of the per-child check below: no suite loses its terms in the move,
  // and none ends up with two homes.
  it('gives every suite exactly one lease terms row across the building', () => {
    for (const spec of SHELL_SPECS) {
      const { shell, property } = shellFor(spec.dealId)
      const termUnitIds = [shell, ...getChildDeals(shell.id)]
        .flatMap((l) => l.marketing.spaceLeaseTerms ?? [])
        .map((t) => t.unitId)
        .sort()
      expect(termUnitIds).toEqual(property.units.map((u) => u.id).sort())
    }
  })

  it('puts both shells on the landlord side so spaces can be added', () => {
    for (const spec of SHELL_SPECS) {
      const { shell } = shellFor(spec.dealId)
      expect(shell.dealType).toBe('Lease')
      expect(shell.dealSide).toBe('seller')
      expect(shell.buyerContactIds).toEqual([])
    }
  })

  it('never puts a shell on residential units', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      for (const unit of property.units) {
        expect(unit.unitType).not.toBe('residential')
      }
    }
  })
})

function childrenOf(dealId: string) {
  return getChildDeals(shellFor(dealId).shell.id)
}

describe('splitting shells into spaces', () => {
  it('creates one child per declared stage', () => {
    for (const spec of SHELL_SPECS) {
      expect(childrenOf(spec.dealId)).toHaveLength(spec.childStages.length)
    }
  })

  it('leaves the shell holding no space terms of its own', () => {
    for (const spec of SHELL_SPECS) {
      const { shell } = shellFor(spec.dealId)
      expect(shell.marketing.spaceLeaseTerms).toEqual([])
      expect(shell.unitId).toBeNull()
    }
  })

  it('gives each child exactly one terms row, for its own unit', () => {
    for (const spec of SHELL_SPECS) {
      for (const child of childrenOf(spec.dealId)) {
        const terms = child.marketing.spaceLeaseTerms ?? []
        expect(terms).toHaveLength(1)
        expect(terms[0].unitId).toBe(child.unitId)
      }
    }
  })

  it('points every child at a real unit on its parent property', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      const unitIds = new Set(property.units.map((u) => u.id))
      for (const child of childrenOf(spec.dealId)) {
        expect(unitIds.has(child.unitId ?? '')).toBe(true)
      }
    }
  })

  it('sizes each child to its own suite', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      for (const child of childrenOf(spec.dealId)) {
        const unit = property.units.find((u) => u.id === child.unitId)
        expect(child.marketing.availableSqFt).toBe(unit?.sqft)
      }
    }
  })

  it('assigns each child a unique deal id continuing the seed counter', () => {
    const ids = [...getStore().listings.values()].map((l) => l.dealId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('derived surfaces', () => {
  it('reads the shells as shells and the children as spaces', () => {
    for (const spec of SHELL_SPECS) {
      const { shell } = shellFor(spec.dealId)
      expect(dealShape(shell)).toBe('shell')
      expect(canAddSpaces(shell)).toBe(true)
      for (const child of childrenOf(spec.dealId)) {
        expect(dealShape(child)).toBe('space')
      }
    }
  })

  it('shows every availability state on the active building', () => {
    const { shell } = shellFor('107')
    const states = buildingAvailability(shell.id).map((r) => r.availability)
    expect(new Set(states)).toEqual(
      new Set(['Leased', 'Under Contract', 'Available', 'Not advertised']),
    )
  })

  it('advertises nothing on the just-split building', () => {
    const { shell } = shellFor('104')
    const rows = buildingAvailability(shell.id)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.advertised)).toBe(false)
  })
})
