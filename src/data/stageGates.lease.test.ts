import { describe, it, expect } from 'vitest'
import { resolveGate } from './stageGates'

describe('resolveGate — lease branch', () => {
  it('Active (publish) gates on lease rate + available SF, not asking price', () => {
    const g = resolveGate('proposal', 'active', 'Lease')
    expect(g.required).toEqual([
      'saleTitle', 'saleDescription', 'leaseRate', 'availableSqFt',
      'aiDocsReviewed', 'websiteReviewed', 'listedOnDate', 'listingExpirationDate',
    ])
    expect(g.required).not.toContain('askingPrice')
    expect(g.publishes).toBe(true)
  })

  it('Under Contract gates on tenant + lease term (not buyer/sale price)', () => {
    const g = resolveGate('active', 'under-contract', 'Lease')
    expect(g.required).toEqual(['tenantLinked', 'leaseTermMonths', 'commissionAmount'])
    expect(g.required).not.toContain('buyerLinked')
    expect(g.required).not.toContain('salePrice')
  })

  it('Closed gates on lease commencement date', () => {
    const g = resolveGate('under-contract', 'closed', 'Lease')
    expect(g.required).toEqual(['leaseCommencementDate'])
  })

  it('Sale gates are unchanged', () => {
    expect(resolveGate('proposal', 'active', 'Sale').required).toContain('askingPrice')
    expect(resolveGate('active', 'under-contract', 'Sale').required).toEqual(
      ['buyerLinked', 'salePrice', 'commissionAmount'],
    )
    expect(resolveGate('under-contract', 'closed', 'Sale').required).toEqual(['closeDate'])
  })
})
