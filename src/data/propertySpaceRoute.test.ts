import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition } from './actions'
import { getProperty } from './store'
import { resolvePropertySpaceRoute } from './propertySpaceRoute'

function makeShell(name: string) {
  return createProposalListing({ ...emptyDraft(), name, dealType: 'Lease' })
}

describe('resolvePropertySpaceRoute', () => {
  it('resolves a real space to its property, unit and row', () => {
    const shell = makeShell('A')
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 900, unitType: 'office' })!
    const child = addSpaceToDeal(shell.id, unit.id)!.deal
    commitStageTransition({ dealId: child.id, targetStage: 'active', actor: 'T' })

    const record = resolvePropertySpaceRoute(shell.propertyId, unit.id)!
    expect(record.property.id).toBe(shell.propertyId)
    expect(record.unit.label).toBe('Suite 100')
    expect(record.row.status).toBe('Available')
    expect(record.row.dealId).toBe(child.id)
  })

  it('is null for a dangling unit id', () => {
    const shell = makeShell('B')
    expect(resolvePropertySpaceRoute(shell.propertyId, 'no-such-unit')).toBeNull()
    expect(resolvePropertySpaceRoute('no-such-property', 'x')).toBeNull()
  })

  it("is null for another property's unit — the guard never leaves this property", () => {
    const a = makeShell('A')
    const b = makeShell('B')
    const unitOnB = addPropertyUnit(b.propertyId, { label: 'Suite 100', sqft: 900, unitType: 'office' })!
    expect(resolvePropertySpaceRoute(a.propertyId, unitOnB.id)).toBeNull()
    expect(resolvePropertySpaceRoute(b.propertyId, unitOnB.id)).not.toBeNull()
  })

  it('is null for the whole-property stub, which is not a space', () => {
    const shell = makeShell('C')
    const stub = getProperty(shell.propertyId)!.units[0]
    expect(stub.label).toBe('Whole Property')
    expect(resolvePropertySpaceRoute(shell.propertyId, stub.id)).toBeNull()
  })
})
