import { describe, expect, it } from 'vitest'
import { getProperty, getStore } from './store'
import { getChildDeals } from './leaseSpaces'
import { buildingAvailability } from './buildingAvailability'
import { canAddSpaces, dealShape } from './dealShape'
import { spaceVouchers } from './spaceVouchers'
import { buildRentSchedule } from '#/components/deals/rentSchedule'
import { SHELL_SPECS } from './leaseSpaceFixtures'
import { buildingSuites } from './buildingSuites'

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
  it('re-slices each shell property into one suite per proportion, plus the remainder', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      expect(property.units).toHaveLength(spec.suiteProportions.length + 1)
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

  // Every deal-bearing suite keeps exactly one terms row — but after the split
  // that row lives on the suite's own child deal, not on the shell. This is the
  // building-wide version of the per-child check below: no suite loses its terms
  // in the move, and none ends up with two homes. Suites past `childStages` have
  // no deal, so they carry no terms row at all — that is `occupiedSuites`/vacant
  // territory, checked separately in "suites without deals".
  it('gives every deal-bearing suite exactly one lease terms row across the building', () => {
    for (const spec of SHELL_SPECS) {
      const { shell, property } = shellFor(spec.dealId)
      const termUnitIds = [shell, ...getChildDeals(shell.id)]
        .flatMap((l) => l.marketing.spaceLeaseTerms ?? [])
        .map((t) => t.unitId)
        .sort()
      const dealBearingUnitIds = property.units
        .slice(0, spec.childStages.length)
        .map((u) => u.id)
        .sort()
      expect(termUnitIds).toEqual(dealBearingUnitIds)
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

  // Suite/Address is a required field on the roster, and the generator never
  // wrote one — so a terms row carried over unrestated shows up blank and flagged.
  it('restates every terms row against its suite', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      for (const child of childrenOf(spec.dealId)) {
        const unit = property.units.find((u) => u.id === child.unitId)
        const terms = child.marketing.spaceLeaseTerms?.[0]
        expect(terms?.suite).toBe(unit?.suite ?? undefined)
        expect(terms?.spaceName).toBe(unit?.label)
        expect(terms?.maxContiguousSqFt).toBe(unit?.sqft)
      }
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

describe('stage-scaled detail', () => {
  const spec = SHELL_SPECS[0]

  function childAtStage(stage: string) {
    const child = childrenOf(spec.dealId).find((c) => c.status === stage)
    if (!child) throw new Error(`no ${stage} child on ${spec.dealId}`)
    return child
  }

  it('gives the leased suite a tenant, commission and commencement date', () => {
    const child = childAtStage('closed')
    expect(child.tenantContactIds).toHaveLength(1)
    expect(child.transaction.commissionAmount).toBeGreaterThan(0)
    expect(child.transaction.leaseCommencementDate).not.toBeNull()
    expect(child.transaction.closeDate).not.toBeNull()
    expect(child.transaction.backOffice.receivables).toHaveLength(1)
    // Both halves of "who leased it": the contact link the vouchers index reads,
    // and the roster's own Tenant Name copy.
    expect(child.marketing.spaceLeaseTerms?.[0].tenantName).toBeTruthy()
  })

  it('gives the under-contract suite a tenant and an executed date, but no commission yet', () => {
    const child = childAtStage('under-contract')
    expect(child.tenantContactIds).toHaveLength(1)
    expect(child.transaction.contractExecutedDate).not.toBeNull()
    expect(child.transaction.commissionAmount).toBe(0)
  })

  it('leaves the not-advertised suite bare', () => {
    const child = childAtStage('proposal')
    expect(child.tenantContactIds).toEqual([])
    expect(child.transaction.commissionAmount).toBe(0)
    expect(child.transaction.listedOnDate).toBeNull()
    expect(child.tasks).toEqual([])
  })

  it('weights each suite by its stage for the commission forecast', () => {
    for (const child of childrenOf(spec.dealId)) {
      if (child.status === 'closed') expect(child.transaction.closeProbability).toBe(100)
    }
  })

  it('computes the leased commission the way the rent schedule does', () => {
    const child = childAtStage('closed')
    const schedule = buildRentSchedule(child)
    expect(schedule).not.toBeNull()
    expect(Math.round(child.transaction.commissionAmount)).toBe(
      Math.round(schedule!.total.commissionAmount),
    )
  })

  it('reports the leased suite in the shell vouchers index', () => {
    const { shell } = shellFor(spec.dealId)
    const rows = spaceVouchers(shell.id)
    expect(rows).toHaveLength(spec.childStages.length)
    const leased = rows.find((r) => r.stage === 'closed')
    expect(leased?.tenantName).toBeTruthy()
    expect(leased?.commissionAmount).toBeGreaterThan(0)
    const bare = rows.find((r) => r.stage === 'proposal')
    expect(bare?.tenantName).toBeNull()
    expect(bare?.commissionAmount).toBeNull()
  })
})

describe('suites without deals', () => {
  it('gives every shell at least one occupied suite that has no deal', () => {
    for (const spec of SHELL_SPECS) {
      const shell = [...getStore().listings.values()].find((l) => l.dealId === spec.dealId)!
      const rows = buildingSuites(shell.id)
      const occupied = rows.filter((r) => r.status === 'Occupied')

      expect(occupied.length).toBeGreaterThanOrEqual(1)
      for (const row of occupied) {
        expect(row.dealId).toBeNull()
        expect(row.tenantName).not.toBeNull()
        expect(row.leaseExpiration).not.toBeNull()
      }
    }
  })

  it('gives Meridian a vacant suite with no deal, so Start-a-deal is reachable from a fresh seed', () => {
    const shell = [...getStore().listings.values()].find((l) => l.dealId === '107')!
    const vacant = buildingSuites(shell.id).filter((r) => r.status === 'Vacant' && r.dealId === null)

    expect(vacant.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps every spec self-consistent: units cover the deals, the occupied and the rest', () => {
    for (const spec of SHELL_SPECS) {
      const unitCount = spec.suiteProportions.length + 1
      expect(unitCount).toBeGreaterThanOrEqual(
        spec.childStages.length + spec.occupiedSuites.length,
      )
    }
  })

  it('still creates exactly one child per stage in childStages, and no more', () => {
    for (const spec of SHELL_SPECS) {
      const shell = [...getStore().listings.values()].find((l) => l.dealId === spec.dealId)!
      expect(getChildDeals(shell.id)).toHaveLength(spec.childStages.length)
    }
  })

  it('never lets a unit claim it is vacant while its deal says Leased', () => {
    for (const spec of SHELL_SPECS) {
      const shell = [...getStore().listings.values()].find((l) => l.dealId === spec.dealId)!
      const property = getStore().properties.get(shell.propertyId)!
      for (const child of getChildDeals(shell.id)) {
        if (child.status !== 'closed') continue
        const unit = property.units.find((u) => u.id === child.unitId)!
        expect(unit.occupancy).toBe('occupied')
        expect(unit.tenantName).not.toBeNull()
      }
    }
  })
})
