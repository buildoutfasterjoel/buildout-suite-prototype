import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'

describe('createProposalListing — lease-workflow fields', () => {
  it('defaults new relational + lease fields', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Test Deal', dealType: 'Lease' })
    expect(deal.parentDealId).toBeNull()
    expect(deal.tenantContactIds).toEqual([])
    expect(deal.transaction.leaseCommencementDate).toBeNull()
  })
})
