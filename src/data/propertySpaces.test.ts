import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition, updateDealMarketing } from './actions'
import { getProperty, updateProperty } from './store'
import type { PropertyStatus } from './types'
import {
  formatAvailabilityBreakdown,
  formatAvailabilityHeadline,
  isDuplicateSpaceLabel,
  leaseShellForProperty,
  propertyAvailability,
  propertySpaces,
  SPACE_STATUS_PRECEDENCE,
  sortSpaceRows,
  spaceStatus,
  type SpaceRow,
} from './propertySpaces'

function makeShell(name = 'Tower Assignment') {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Lease' })
}

/** A property with no deal at all — the tracked-property case. */
function makeTrackedProperty() {
  // `createProposalListing` is the only unit-bearing property factory the tests
  // have; a Sale deal on it is then re-pointed away below when a no-deal
  // property is needed. Simpler: make the deal, and use its property.
  const sale = createProposalListing({ ...emptyDraft(), name: 'Tracked', dealType: 'Sale' })
  return getProperty(sale.propertyId)!
}

function addUnit(propertyId: string, label: string, extra: { floor?: number | null; sqft?: number } = {}) {
  return addPropertyUnit(propertyId, {
    label,
    sqft: extra.sqft ?? 1000,
    unitType: 'office',
    floor: extra.floor,
  })!
}

function occupy(propertyId: string, unitId: string, tenant = 'Acme Holdings') {
  const property = getProperty(propertyId)!
  updateProperty(propertyId, {
    units: property.units.map((u) =>
      u.id === unitId
        ? { ...u, occupancy: 'occupied' as const, tenantName: tenant, leaseExpiration: '2027-03-31' }
        : u,
    ),
  })
}

function startAt(shellId: string, unitId: string, stage: PropertyStatus) {
  const child = addSpaceToDeal(shellId, unitId)!.deal
  if (stage !== 'proposal') commitStageTransition({ dealId: child.id, targetStage: stage, actor: 'T' })
  return child
}

describe('spaceStatus', () => {
  it('lets a deal outrank the unit, in availability vocabulary', () => {
    const shell = makeShell()
    const unit = addUnit(shell.propertyId, 'Suite 100')
    occupy(shell.propertyId, unit.id)
    const child = startAt(shell.id, unit.id, 'active')
    expect(propertySpaces(shell.propertyId)[0].status).toBe('Available')

    for (const [stage, status] of [
      ['under-contract', 'Under Contract'],
      ['closed', 'Leased'],
      ['inactive', 'Not advertised'],
    ] as const) {
      commitStageTransition({ dealId: child.id, targetStage: stage, actor: 'T' })
      expect(propertySpaces(shell.propertyId)[0].status).toBe(status)
    }
  })

  it('reads occupancy only for a space with no deal', () => {
    const shell = makeShell()
    const vacant = addUnit(shell.propertyId, 'Suite 100')
    const taken = addUnit(shell.propertyId, 'Suite 200')
    occupy(shell.propertyId, taken.id, 'Calloway Freight')
    const rows = propertySpaces(shell.propertyId)
    expect(rows.find((r) => r.unitId === vacant.id)!.status).toBe('Vacant')
    const takenRow = rows.find((r) => r.unitId === taken.id)!
    expect(takenRow.status).toBe('Occupied')
    expect(takenRow.tenantName).toBe('Calloway Freight')
    expect(spaceStatus(null, getProperty(shell.propertyId)!.units.find((u) => u.id === taken.id)!)).toBe(
      'Occupied',
    )
  })
})

describe('propertySpaces', () => {
  it('excludes the whole-property stub and returns nothing for an unknown property', () => {
    const shell = makeShell()
    expect(propertySpaces(shell.propertyId)).toEqual([])
    expect(propertySpaces('no-such-property')).toEqual([])
  })

  it("does not let a top-level deal's unitId claim a unit", () => {
    // A flat lease created with a unit picked carries `unitId`, as does every
    // seeded whole-building deal (marketing default). Neither is a child, so the
    // unit stays unworked on the asset roster.
    const base = makeShell()
    const unit = addUnit(base.propertyId, 'Suite 100')
    const flat = createProposalListing({
      ...emptyDraft(),
      dealType: 'Lease',
      propertyId: base.propertyId,
      attachAs: 'space',
      spaceLabel: unit.label,
      unitId: unit.id,
    })
    expect(flat.unitId).toBe(unit.id)
    expect(flat.parentDealId).toBeNull()

    const row = propertySpaces(base.propertyId).find((r) => r.unitId === unit.id)!
    expect(row.dealId).toBeNull()
    expect(row.status).toBe('Vacant')
  })

  it('joins the child deal, its shell and its terms onto the row', () => {
    const shell = makeShell()
    const unit = addUnit(shell.propertyId, 'Suite 100')
    const child = startAt(shell.id, unit.id, 'active')
    updateDealMarketing(child.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 48, leaseRateUnits: 'SF/Yr' }],
    })
    const row = propertySpaces(shell.propertyId)[0]
    expect(row.dealId).toBe(child.id)
    expect(row.shellId).toBe(shell.id)
    expect(row.stage).toBe('active')
    expect(row.leaseRate).toBe(48)
  })

  it("falls back to the shell's pre-split terms row for a space with no deal", () => {
    const shell = makeShell()
    const unit = addUnit(shell.propertyId, 'Suite 100')
    occupy(shell.propertyId, unit.id, 'Acme Corp')
    updateDealMarketing(shell.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 30, tenantName: 'Acme Holdings LLC' }],
    })
    const row = propertySpaces(shell.propertyId)[0]
    expect(row.leaseRate).toBe(30)
    expect(row.tenantName).toBe('Acme Holdings LLC')
  })

  it('orders by precedence, then floor with unknown floors last, then numeric label', () => {
    const shell = makeShell()
    const leasedTop = addUnit(shell.propertyId, 'Suite 300', { floor: 3 })
    const vacantNoFloor = addUnit(shell.propertyId, 'Suite 20', { floor: null })
    const vacantFloor1b = addUnit(shell.propertyId, 'Suite 100', { floor: 1 })
    const vacantFloor1a = addUnit(shell.propertyId, 'Suite 3', { floor: 1 })
    const available = addUnit(shell.propertyId, 'Suite 500', { floor: 5 })
    startAt(shell.id, leasedTop.id, 'closed')
    startAt(shell.id, available.id, 'active')

    expect(propertySpaces(shell.propertyId).map((r) => r.unitId)).toEqual([
      available.id, // Available
      vacantFloor1a.id, // Vacant, floor 1, "Suite 3"
      vacantFloor1b.id, // Vacant, floor 1, "Suite 100"
      vacantNoFloor.id, // Vacant, no floor → last of its band
      leasedTop.id, // Leased
    ])
  })

  it('sortSpaceRows is stable for equal keys and does not mutate its input', () => {
    const mk = (label: string): SpaceRow => ({
      unitId: label,
      label,
      suite: null,
      floor: 1,
      sqft: 1,
      unitType: 'office',
      status: 'Vacant',
      dealId: null,
      shellId: null,
      stage: null,
      leaseRate: null,
      leaseRateUnits: 'SF/Yr',
      tenantName: null,
      leaseExpiration: null,
    })
    const input = [mk('Suite 20'), mk('Suite 100')]
    const out = sortSpaceRows(input)
    expect(out.map((r) => r.label)).toEqual(['Suite 20', 'Suite 100'])
    expect(input.map((r) => r.label)).toEqual(['Suite 20', 'Suite 100'])
  })
})

describe('propertyAvailability', () => {
  it('is null for a property with no spaces', () => {
    const shell = makeShell()
    expect(propertyAvailability(shell.propertyId)).toBeNull()
  })

  it('reads a single space as its bare status', () => {
    const shell = makeShell()
    const unit = addUnit(shell.propertyId, 'Suite 100')
    occupy(shell.propertyId, unit.id)
    const a = propertyAvailability(shell.propertyId)!
    expect(a.spaceCount).toBe(1)
    expect(a.uniform).toBe(true)
    expect(formatAvailabilityHeadline(a)).toBe('Occupied')
  })

  it('reads a uniform property as status plus count', () => {
    const shell = makeShell()
    for (const label of ['Suite 100', 'Suite 200', 'Suite 300']) {
      startAt(shell.id, addUnit(shell.propertyId, label).id, 'closed')
    }
    const a = propertyAvailability(shell.propertyId)!
    expect(a.headline).toBe('Leased')
    expect(a.uniform).toBe(true)
    expect(formatAvailabilityHeadline(a)).toBe('Leased · 3 spaces')
    expect(formatAvailabilityBreakdown(a)).toBe('3 Leased')
  })

  it('headlines a mixed property by precedence with a count, and never says Mixed', () => {
    const shell = makeShell()
    startAt(shell.id, addUnit(shell.propertyId, 'Suite 100', { sqft: 1000 }).id, 'closed')
    startAt(shell.id, addUnit(shell.propertyId, 'Suite 200', { sqft: 2000 }).id, 'active')
    startAt(shell.id, addUnit(shell.propertyId, 'Suite 300', { sqft: 3000 }).id, 'under-contract')
    addUnit(shell.propertyId, 'Suite 400', { sqft: 4000 }) // vacant
    occupy(shell.propertyId, addUnit(shell.propertyId, 'Suite 500', { sqft: 5000 }).id)
    startAt(shell.id, addUnit(shell.propertyId, 'Suite 600', { sqft: 6000 }).id, 'proposal') // Not advertised

    const a = propertyAvailability(shell.propertyId)!
    expect(a.spaceCount).toBe(6)
    expect(a.uniform).toBe(false)
    expect(a.headline).toBe('Available')
    expect(formatAvailabilityHeadline(a)).toBe('Available · 1 of 6 spaces')
    expect(formatAvailabilityBreakdown(a)).toBe(
      '1 Available · 1 Under Contract · 1 Vacant · 1 Leased · 1 Occupied · 1 Not advertised',
    )
    expect([...a.statuses].sort()).toEqual(
      ['Available', 'Under Contract', 'Vacant', 'Leased', 'Occupied', 'Not advertised'].sort(),
    )
    expect(a.totalSqft).toBe(21000)
    expect(a.availableSqft).toBe(6000) // Available 2000 + Vacant 4000
    expect(JSON.stringify(a)).not.toContain('Mixed')
  })

  it('lets Vacant headline over Leased and Occupied', () => {
    const shell = makeShell()
    for (const label of ['Suite 100', 'Suite 200']) {
      startAt(shell.id, addUnit(shell.propertyId, label).id, 'closed')
    }
    occupy(shell.propertyId, addUnit(shell.propertyId, 'Suite 300').id)
    addUnit(shell.propertyId, 'Suite 400')
    expect(formatAvailabilityHeadline(propertyAvailability(shell.propertyId)!)).toBe(
      'Vacant · 1 of 4 spaces',
    )
  })

  it('ranks Not advertised last, so a just-split building headlines its occupied suite', () => {
    // The shell-104 shape: three Inactive children and one sitting tenant.
    const shell = makeShell()
    for (const label of ['Suite 100', 'Suite 200', 'Suite 300']) {
      startAt(shell.id, addUnit(shell.propertyId, label).id, 'proposal')
    }
    occupy(shell.propertyId, addUnit(shell.propertyId, 'Suite 400').id)
    expect(formatAvailabilityHeadline(propertyAvailability(shell.propertyId)!)).toBe(
      'Occupied · 1 of 4 spaces',
    )
    expect(SPACE_STATUS_PRECEDENCE.at(-1)).toBe('Not advertised')
  })
})

describe('isDuplicateSpaceLabel', () => {
  it('matches trimmed, case-insensitively, and against the whole-property stub', () => {
    const shell = makeShell()
    const unit = addUnit(shell.propertyId, 'Suite 200')
    const property = getProperty(shell.propertyId)!
    expect(isDuplicateSpaceLabel(property, '  suite 200 ')).toBe(true)
    expect(isDuplicateSpaceLabel(property, 'Suite 201')).toBe(false)
    expect(isDuplicateSpaceLabel(property, 'whole property')).toBe(true)
    expect(isDuplicateSpaceLabel(property, '')).toBe(false)
    // Editing a unit does not collide with itself.
    expect(isDuplicateSpaceLabel(property, 'Suite 200', unit.id)).toBe(false)
  })
})

describe('leaseShellForProperty', () => {
  it('is null for a property with only a Sale deal', () => {
    const property = makeTrackedProperty()
    expect(leaseShellForProperty(property.id)).toBeNull()
  })

  it('prefers the lease deal that already has children', () => {
    const older = makeShell('Older')
    const newer = createProposalListing({
      ...emptyDraft(),
      name: 'Newer',
      dealType: 'Lease',
      propertyId: older.propertyId,
    })
    // Neither has children yet, so either is eligible (the newest-first
    // tie-break is not asserted: both were created in the same millisecond).
    expect([older.id, newer.id]).toContain(leaseShellForProperty(older.propertyId)!.id)
    startAt(older.id, addUnit(older.propertyId, 'Suite 100').id, 'active')
    expect(leaseShellForProperty(older.propertyId)!.id).toBe(older.id)
  })

  it('skips a shell that can no longer take a space', () => {
    const shell = makeShell()
    commitStageTransition({ dealId: shell.id, targetStage: 'inactive', actor: 'T' })
    expect(leaseShellForProperty(shell.propertyId)).toBeNull()
  })
})
