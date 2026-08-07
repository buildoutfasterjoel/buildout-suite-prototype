import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition, updateDealMarketing } from './actions'
import { getProperty, updateProperty } from './store'
import { buildingSuites, groupSuites, suiteStatus, type SuiteRow } from './buildingSuites'

function makeShell() {
  return createProposalListing({ ...emptyDraft(), name: 'Tower Assignment', dealType: 'Lease' })
}

/** Mark a unit occupied on the property record — the asset fact, no deal involved. */
function occupy(propertyId: string, unitId: string, tenant: string, expires: string) {
  const property = getProperty(propertyId)!
  updateProperty(propertyId, {
    units: property.units.map((u) =>
      u.id === unitId
        ? { ...u, occupancy: 'occupied' as const, tenantName: tenant, leaseExpiration: expires }
        : u,
    ),
  })
}

describe('buildingSuites', () => {
  it('returns a row for every unit, whether or not it has a deal', () => {
    const shell = makeShell()
    const withDeal = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const noDeal = addPropertyUnit(shell.propertyId, { label: 'Suite 200', sqft: 2000, unitType: 'office' })!
    addSpaceToDeal(shell.id, withDeal.id)

    const rows = buildingSuites(shell.id)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.unitId === withDeal.id)!.dealId).not.toBeNull()
    expect(rows.find((r) => r.unitId === noDeal.id)!.dealId).toBeNull()
  })

  it('reports a suite with no deal as Vacant or Occupied from the unit', () => {
    const shell = makeShell()
    const vacant = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const taken = addPropertyUnit(shell.propertyId, { label: 'Suite 200', sqft: 2000, unitType: 'office' })!
    occupy(shell.propertyId, taken.id, 'Acme Holdings', '2027-03-31')

    const rows = buildingSuites(shell.id)
    const vacantRow = rows.find((r) => r.unitId === vacant.id)!
    const takenRow = rows.find((r) => r.unitId === taken.id)!

    expect(vacantRow.status).toBe('Vacant')
    expect(vacantRow.tenantName).toBeNull()
    expect(takenRow.status).toBe('Occupied')
    expect(takenRow.tenantName).toBe('Acme Holdings')
    expect(takenRow.leaseExpiration).toBe('2027-03-31')
  })

  it("lets a deal's stage outrank the unit's occupancy", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    // Occupied on the asset record AND worked as a deal — the deal wins.
    occupy(shell.propertyId, unit.id, 'Old Tenant', '2026-12-31')
    const child = addSpaceToDeal(shell.id, unit.id)!.deal
    commitStageTransition({ dealId: child.id, targetStage: 'active', actor: 'T' })

    expect(buildingSuites(shell.id)[0].status).toBe('Active')
  })

  it("reports the deal's own stage, not what the building advertises", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const child = addSpaceToDeal(shell.id, unit.id)!.deal

    // A fresh space deal sits at `proposal`, which the directory must report as
    // the space ladder's own label — not the marketing translation the building's
    // availability table uses.
    expect(buildingSuites(shell.id)[0].status).toBe('Inactive')

    for (const [stage, label] of [
      ['active', 'Active'],
      ['under-contract', 'Under Contract'],
      ['closed', 'Closed'],
    ] as const) {
      commitStageTransition({ dealId: child.id, targetStage: stage, actor: 'T' })
      expect(buildingSuites(shell.id)[0].status).toBe(label)
    }
  })

  it("carries the deal's rate onto the row", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const child = addSpaceToDeal(shell.id, unit.id)!.deal
    updateDealMarketing(child.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 34, leaseRateUnits: 'SF/Yr' }],
    })

    const row = buildingSuites(shell.id)[0]
    expect(row.leaseRate).toBe(34)
    expect(row.leaseRateUnits).toBe('SF/Yr')
  })

  it("prefers the shell's tenant-name override over the unit's own for a suite with no deal", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    occupy(shell.propertyId, unit.id, 'Acme Corp', '2027-03-31')
    updateDealMarketing(shell.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), tenantName: 'Acme Holdings LLC' }],
    })

    expect(buildingSuites(shell.id)[0].tenantName).toBe('Acme Holdings LLC')
  })

  it('falls back to the unit when the override is blank rather than showing nothing', () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    occupy(shell.propertyId, unit.id, 'Acme Corp', '2027-03-31')
    updateDealMarketing(shell.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), tenantName: '   ' }],
    })

    expect(buildingSuites(shell.id)[0].tenantName).toBe('Acme Corp')
  })

  it('orders suites by label with numeric collation, so Suite 100 precedes Suite 20', () => {
    const shell = makeShell()
    addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 100, unitType: 'office' })
    addPropertyUnit(shell.propertyId, { label: 'Suite 20', sqft: 100, unitType: 'office' })
    addPropertyUnit(shell.propertyId, { label: 'Suite 3', sqft: 100, unitType: 'office' })

    expect(buildingSuites(shell.id).map((r) => r.label)).toEqual(['Suite 3', 'Suite 20', 'Suite 100'])
  })

  it('returns nothing for a listing that does not exist', () => {
    expect(buildingSuites('no-such-deal')).toEqual([])
  })

  it('excludes the whole-property stub, which stands for the deal rather than a suite', () => {
    // `createProposalListing` seeds exactly this one unit, so a deal that has had
    // no suites added to it has an empty directory — not a row for itself.
    const shell = makeShell()
    expect(buildingSuites(shell.id)).toEqual([])
  })
})

describe('groupSuites', () => {
  const row = (over: Partial<SuiteRow>): SuiteRow =>
    ({ unitId: over.label ?? 'u', label: 'Suite 1', sqft: 0, dealId: null,
       stage: null, status: 'Vacant', leaseRate: null, leaseRateUnits: 'SF/Yr',
       tenantName: null, leaseExpiration: null, ...over }) as SuiteRow

  it('sorts each suite into deals, available and occupied, keeping label order', () => {
    const { deals, available, occupied } = groupSuites([
      row({ label: 'Suite 100', status: 'Vacant' }),
      row({ label: 'Suite 200', dealId: 'd1', stage: 'active', status: 'Active' }),
      row({ label: 'Suite 300', status: 'Occupied', tenantName: 'Acme' }),
      row({ label: 'Suite 400', dealId: 'd2', stage: 'proposal', status: 'Inactive' }),
      row({ label: 'Suite 500', status: 'Vacant' }),
    ])

    expect(deals.map((r) => r.label)).toEqual(['Suite 200', 'Suite 400'])
    expect(available.map((r) => r.label)).toEqual(['Suite 100', 'Suite 500'])
    expect(occupied.map((r) => r.label)).toEqual(['Suite 300'])
  })

  it('keeps a closed deal with the deals — its row still behaves like one', () => {
    // A closed space is leased, so it resembles the occupied suites. It groups
    // with the deals anyway: the row links to its deal and carries a stage
    // control, which is what these sections are cut by.
    const { deals, occupied } = groupSuites([
      row({ label: 'Suite 100', dealId: 'd1', stage: 'closed', status: 'Closed' }),
    ])

    expect(deals.map((r) => r.label)).toEqual(['Suite 100'])
    expect(occupied).toEqual([])
  })

  it('keeps a worked suite with the deals even when the unit is still occupied', () => {
    // The same rule `suiteStatus` states: a deal outranks the asset's occupancy.
    // Such a row reports its stage, never 'Occupied', so it must not sink.
    const { deals, available, occupied } = groupSuites([
      row({ label: 'Suite 100', dealId: 'd1', stage: 'active', status: 'Active' }),
    ])

    expect(deals.map((r) => r.label)).toEqual(['Suite 100'])
    expect(available).toEqual([])
    expect(occupied).toEqual([])
  })

  it('returns three empty groups for an empty directory', () => {
    expect(groupSuites([])).toEqual({ deals: [], available: [], occupied: [] })
  })
})

describe('suiteStatus', () => {
  const unit = (occupancy: 'vacant' | 'occupied') =>
    ({ occupancy, tenantName: null, leaseExpiration: null }) as never

  it('answers from the unit only when there is no deal', () => {
    expect(suiteStatus(null, unit('vacant'))).toBe('Vacant')
    expect(suiteStatus(null, unit('occupied'))).toBe('Occupied')
  })
})
