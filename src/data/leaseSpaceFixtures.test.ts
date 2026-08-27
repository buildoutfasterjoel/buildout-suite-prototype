import { describe, expect, it } from 'vitest'
import type { Contact, Listing, Property, PropertyUnit, SpaceLeaseTerms } from './types'
import { getProperty, getStore } from './store'
import { getChildDeals } from './leaseSpaces'
import { buildingAvailability } from './buildingAvailability'
import { canAddSpaces, dealShape } from './dealShape'
import { spaceVouchers } from './spaceVouchers'
import { buildRentSchedule } from '#/components/deals/rentSchedule'
import { SHELL_SPECS, applyLeaseSpaces } from './leaseSpaceFixtures'
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
    // Taken from the tenant, so a settled bill can never read as connected
    // above a tenant that is not. The fixture's tenant is in QuickBooks, so the
    // suite's receivable is too.
    expect(child.transaction.backOffice.receivables[0].quickbooksSynced).toBe(true)
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

describe('seeded media', () => {
  // Wired to this file's existing `shellFor`/`getChildDeals` setup rather than a
  // second dataset: `shells` and their properties come from the live store via
  // `shellFor`, and `childSpaces` is every child deal across both shells.
  const shellPairs = SHELL_SPECS.map((spec) => shellFor(spec.dealId))
  const shells = shellPairs.map((p) => p.shell)
  const propertyFor = (shell: (typeof shells)[number]) =>
    shellPairs.find((p) => p.shell === shell)!.property
  const childSpaces = shells.flatMap((shell) => getChildDeals(shell.id))

  it('gives each lease shell building-wide photos and visual media', () => {
    for (const shell of shells) {
      const photos = (shell.marketing.photos ?? []).filter((p) => p.unitId == null)
      expect(photos.length, shell.name).toBeGreaterThan(0)
      expect(photos.every((p) => p.kind === 'photo'), shell.name).toBe(true)

      const media = (shell.marketing.visualMedia ?? []).filter((v) => v.unitId == null)
      expect(media.length, shell.name).toBeGreaterThan(0)
    }
  })

  it('never seeds a building-wide floor plan, which has no section to render in', () => {
    for (const shell of shells) {
      const strayPlans = (shell.marketing.photos ?? []).filter(
        (p) => p.kind === 'floorPlan' && p.unitId == null,
      )
      expect(strayPlans, shell.name).toEqual([])
    }
  })

  it('pins the i % 3 bucket for every unit: photos+plan+link, photos-only, or nothing', () => {
    // Pinned per index rather than `.some(...)`/`.some(...)`, which is true
    // whether or not the bucketing landed on the right units — that vacuous
    // shape is exactly what let the pre-reslice-ordering bug through review.
    for (const shell of shells) {
      const property = propertyFor(shell)
      property.units.forEach((unit, i) => {
        const label = `${shell.name} / unit ${i} (${unit.id})`
        const photos = (shell.marketing.photos ?? []).filter(
          (p) => p.unitId === unit.id && p.kind === 'photo',
        )
        const floorPlans = (shell.marketing.photos ?? []).filter(
          (p) => p.unitId === unit.id && p.kind === 'floorPlan',
        )
        const matterportLinks = (shell.marketing.links ?? []).filter(
          (l) => l.unitId === unit.id && l.kind === 'matterport',
        )
        const bucket = i % 3
        if (bucket === 0) {
          expect(photos.length, label).toBeGreaterThan(0)
          expect(floorPlans.length, label).toBe(1)
          expect(matterportLinks.length, label).toBe(1)
        } else if (bucket === 1) {
          expect(photos.length, label).toBeGreaterThan(0)
          expect(floorPlans.length, label).toBe(0)
          expect(matterportLinks.length, label).toBe(0)
        } else {
          expect(photos.length, label).toBe(0)
          expect(floorPlans.length, label).toBe(0)
          expect(matterportLinks.length, label).toBe(0)
        }
      })
    }
  })

  it('gives at least one unit a floor plan', () => {
    const anyPlan = shells.some((s) =>
      (s.marketing.photos ?? []).some((p) => p.kind === 'floorPlan' && p.unitId != null),
    )
    expect(anyPlan).toBe(true)
  })

  it('scopes every seeded asset to a real unit of its own property', () => {
    // A dangling unitId would render nowhere and be invisible in the UI.
    for (const shell of shells) {
      const ids = new Set(propertyFor(shell).units.map((u) => u.id))
      const scoped = [
        ...(shell.marketing.photos ?? []),
        ...(shell.marketing.links ?? []),
        ...(shell.marketing.visualMedia ?? []),
      ].filter((a) => a.unitId != null)
      for (const a of scoped) {
        expect(ids.has(a.unitId!), `${shell.name} / ${a.unitId}`).toBe(true)
      }
    }
  })

  it('leaves every child space holding no media of its own', () => {
    // The one-home rule, verified against the seeded data rather than only the
    // factory — a fixture that populated a child directly would bypass Task 2.
    for (const child of childSpaces) {
      expect(child.marketing.photos ?? [], child.name).toEqual([])
      expect(child.marketing.links ?? [], child.name).toEqual([])
      expect(child.marketing.visualMedia ?? [], child.name).toEqual([])
    }
  })
})

// `applyLeaseSpaces` takes its `listings`/`properties` as plain arguments
// rather than reading the live store, which is what makes a direct,
// deterministic reproduction possible here: SHELL_SPECS' seeded shells (dealId
// '107'/'104') never happen to reach this codepath with a non-empty
// `payerContactIds` on their own voucher — neither is closed at the top level
// today — so the `voucher payers seed` invariant in seed.test.ts holds against
// the real dataset regardless of whether `buildChild` resets the payer list.
// This constructs a shell whose voucher already carries a payer, the way one
// would if its own deal had closed, and checks the one thing that copy must
// never survive into a child.
describe("a shell voucher already carrying payers", () => {
  it('does not hand its payers to a proposal-stage child', () => {
    // A 'proposal' child never reaches `applyStageDetail`'s backOffice-clearing
    // branch — that only fires past Under Contract — so it depends entirely on
    // `buildChild` itself resetting the copied voucher. Matches SHELL_SPECS'
    // '104' entry, whose children are all 'proposal'.
    const unitTemplate = {
      id: 'unit-104-tmpl',
      label: 'Suite 100',
      unitType: 'office',
      sqft: 1000,
      saleHistory: [],
    } as unknown as PropertyUnit
    const property = {
      id: 'prop-104',
      buildingSqFt: 4000,
      units: [unitTemplate],
    } as unknown as Property
    const termsTemplate = { unitId: unitTemplate.id } as unknown as SpaceLeaseTerms
    const shell = {
      id: 'shell-104',
      dealId: '104',
      propertyId: property.id,
      name: 'Test Building',
      slug: 'test-building',
      dealType: 'Lease',
      dealSide: 'seller',
      buyerContactIds: [],
      sellerContactIds: [],
      financials: { rentRoll: [] },
      marketing: { spaceLeaseTerms: [termsTemplate] },
      transaction: {
        // Stands in for a voucher that was billed and closed at some point —
        // the shape `buildChild` must not hand down whole.
        backOffice: { payerContactIds: ['building-payer'], receivables: [{ id: 'r1' }] },
      },
    } as unknown as Listing
    const listings: Listing[] = [shell]

    applyLeaseSpaces(listings, [property], [] as Contact[], { n: 1 })

    const children = listings.filter((l) => l.parentDealId === shell.id)
    expect(children.length).toBeGreaterThan(0)
    for (const child of children) {
      expect(child.transaction.backOffice.receivables).toEqual([])
      expect(child.transaction.backOffice.payerContactIds).toEqual([])
    }
  })
})
