import { describe, it, expect } from 'vitest'
import { useDataStore } from './dataStore'
import { updateListingUnderwriting, generateUnderwritingResult } from './store'

describe('generateUnderwritingResult', () => {
  it('computes and stores a result + generatedAt on the deal', () => {
    const listing = [...useDataStore.getState().listings.values()][0]
    updateListingUnderwriting(listing.id, {
      strategy: 'new-construction',
      tier: 'New Construction Strategy',
      selectedChecks: [0, 1, 2],
      status: 'generated',
    })

    const updated = generateUnderwritingResult(listing.id)

    expect(updated?.underwriting?.result).toBeDefined()
    expect(updated?.underwriting?.result?.metrics.length).toBeGreaterThan(0)
    expect(updated?.underwriting?.result?.sections.map((s) => s.key)).toHaveLength(3)
    expect(typeof updated?.underwriting?.generatedAt).toBe('string')
  })

  it('returns undefined for an unknown listing', () => {
    expect(generateUnderwritingResult('does-not-exist')).toBeUndefined()
  })
})
