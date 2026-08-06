import { describe, expect, it } from 'vitest'
import { getProperty, getStore } from './store'
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

  it('gives every suite its own lease terms row', () => {
    for (const spec of SHELL_SPECS) {
      const { shell, property } = shellFor(spec.dealId)
      const termUnitIds = (shell.marketing.spaceLeaseTerms ?? []).map((t) => t.unitId).sort()
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
