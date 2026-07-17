import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { commitStageTransition } from './actions'
import { getListing } from './store'
import { resolveGate, seedGateForm, buildTransitionInput } from './stageGates'

describe('lease gate commit', () => {
  it('publishes a lease deal with rate + available SF onto its space terms', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Suite 100', dealType: 'Lease' })
    const config = resolveGate('proposal', 'active', 'Lease')
    const form = {
      ...seedGateForm(deal),
      saleTitle: 'Prime Suite 100',
      saleDescription: 'Corner retail',
      leaseRate: 32,
      leaseRateUnits: 'SF/Yr' as const,
      availableSqFt: 2400,
      listedOnDate: '2026-08-01',
      listingExpirationDate: '2027-08-01',
      aiDocsAllReviewed: true,
      websiteReviewed: true,
    }
    const input = buildTransitionInput(config, form, deal.id, 'Tester', 'Lease')
    commitStageTransition(input)

    const saved = getListing(deal.id)!
    expect(saved.status).toBe('active')
    expect(saved.publishedAt).not.toBeNull()
    expect(saved.marketing.leaseTitle).toBe('Prime Suite 100')
    expect(saved.marketing.availableSqFt).toBe(2400)
    expect(saved.marketing.spaceLeaseTerms[0]?.leaseRate).toBe(32)
    expect(saved.marketing.spaceLeaseTerms[0]?.leaseRateUnits).toBe('SF/Yr')
  })

  it('captures tenant + commencement date on the way to Closed', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Suite 200', dealType: 'Lease' })
    const closeCfg = resolveGate('under-contract', 'closed', 'Lease')
    const form = { ...seedGateForm(deal), leaseCommencementDate: '2026-10-01' }
    commitStageTransition(buildTransitionInput(closeCfg, form, deal.id, 'Tester', 'Lease'))
    expect(getListing(deal.id)!.transaction.leaseCommencementDate).toBe('2026-10-01')
  })
})
