import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { resolveSpaceRoute } from './spaceRoute'

function makeShellWithSpace() {
  const shell = createProposalListing({ ...emptyDraft(), name: 'Tower', dealType: 'Lease' })
  const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 305', sqft: 3100, unitType: 'office' })!
  const space = addSpaceToDeal(shell.id, unit.id)!.deal
  return { shell, unit, space }
}

describe('resolveSpaceRoute', () => {
  it('resolves a space that belongs to the shell in the URL', () => {
    const { shell, unit, space } = makeShellWithSpace()
    const found = resolveSpaceRoute(shell.id, space.id)!

    expect(found.space.id).toBe(space.id)
    expect(found.unit!.id).toBe(unit.id)
    expect(found.label).toBe('Suite 305')
  })

  it("refuses a space that belongs to a different shell", () => {
    const a = makeShellWithSpace()
    const b = makeShellWithSpace()
    // b's suite must never render under a's frame: that paints one landlord's
    // money over another's page (ab7b6be).
    expect(resolveSpaceRoute(a.shell.id, b.space.id)).toBeNull()
  })

  it('refuses a listing that is not a space at all', () => {
    const { shell } = makeShellWithSpace()
    expect(resolveSpaceRoute(shell.id, shell.id)).toBeNull()
  })

  it('refuses an id that does not exist', () => {
    const { shell } = makeShellWithSpace()
    expect(resolveSpaceRoute(shell.id, 'no-such-space')).toBeNull()
  })

  it('falls back to the deal name when the unit is missing', () => {
    const { shell, space } = makeShellWithSpace()
    space.unitId = 'dangling-unit-id'
    const found = resolveSpaceRoute(shell.id, space.id)!

    expect(found.unit).toBeUndefined()
    expect(found.label).toBe(space.name)
  })
})
