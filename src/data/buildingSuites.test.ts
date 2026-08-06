import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition, updateDealMarketing } from './actions'
import { getProperty, updateProperty } from './store'
import { buildingSuites, suiteStatus } from './buildingSuites'

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

    expect(buildingSuites(shell.id)[0].status).toBe('Available')
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

describe('suiteStatus', () => {
  const unit = (occupancy: 'vacant' | 'occupied') =>
    ({ occupancy, tenantName: null, leaseExpiration: null }) as never

  it('answers from the unit only when there is no deal', () => {
    expect(suiteStatus(null, unit('vacant'))).toBe('Vacant')
    expect(suiteStatus(null, unit('occupied'))).toBe('Occupied')
  })
})
