import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition, createContact } from './actions'
import { spaceVouchers } from './spaceVouchers'

function makeParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('spaceVouchers', () => {
  it('returns one row per child, with tenant and commission once transacted', () => {
    const parent = makeParent()
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite 210', sqft: 2000, unitType: 'office' })!
    const childA = addSpaceToDeal(parent.id, a.id)!.deal
    addSpaceToDeal(parent.id, b.id)

    const { contact } = createContact({ firstName: 'Ada', lastName: 'Nunez', company: 'Acme Corp' })
    commitStageTransition({
      dealId: childA.id,
      targetStage: 'closed',
      actor: 'T',
      tenantContactId: contact.id,
      transaction: { commissionAmount: 42000 },
    })

    const rows = spaceVouchers(parent.id)
    expect(rows).toHaveLength(2)

    const rowA = rows.find((r) => r.dealId === childA.id)!
    expect(rowA.label).toBe('Suite 100')
    expect(rowA.tenantName).toBe('Ada Nunez')
    expect(rowA.commissionAmount).toBe(42000)
    expect(rowA.stage).toBe('closed')
  })

  it('reports no tenant and no commission for a space that has not transacted', () => {
    const parent = makeParent()
    const u = addPropertyUnit(parent.propertyId, { label: 'Suite 305', sqft: 900, unitType: 'retail' })!
    addSpaceToDeal(parent.id, u.id)

    const row = spaceVouchers(parent.id)[0]!
    expect(row.tenantName).toBeNull()
    expect(row.commissionAmount).toBeNull()
    expect(row.stage).toBe('proposal')
  })

  it('sorts by suite label so the index and the roster agree', () => {
    const parent = makeParent()
    // Added out of order on purpose: getChildDeals returns store-insertion order.
    const c = addPropertyUnit(parent.propertyId, { label: 'Suite 305', sqft: 300, unitType: 'retail' })!
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 100, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite 210', sqft: 200, unitType: 'retail' })!
    addSpaceToDeal(parent.id, c.id)
    addSpaceToDeal(parent.id, a.id)
    addSpaceToDeal(parent.id, b.id)

    expect(spaceVouchers(parent.id).map((r) => r.label)).toEqual([
      'Suite 100', 'Suite 210', 'Suite 305',
    ])
  })

  it('returns nothing for a deal with no children', () => {
    expect(spaceVouchers(makeParent().id)).toEqual([])
  })

  it('returns nothing for an unknown deal id', () => {
    expect(spaceVouchers('nope')).toEqual([])
  })
})
