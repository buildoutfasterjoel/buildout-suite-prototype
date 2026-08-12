import { describe, expect, it } from 'vitest'
import type { Listing, PropertyStatus } from './types'
import { propertyStageFromDeals } from './propertyStage'

const deal = (status: PropertyStatus) => ({ status }) as Listing

describe('propertyStageFromDeals', () => {
  it('is null when the property has no deals — the ordinary case', () => {
    expect(propertyStageFromDeals([])).toBeNull()
  })

  it('distinguishes "no deal" from a lost deal', () => {
    expect(propertyStageFromDeals([])).toBeNull()
    expect(propertyStageFromDeals([deal('inactive')])).toBe('inactive')
  })

  it('takes the furthest-along open stage', () => {
    expect(propertyStageFromDeals([deal('proposal'), deal('under-contract')])).toBe(
      'under-contract',
    )
    expect(propertyStageFromDeals([deal('active'), deal('proposal')])).toBe('active')
  })

  it('prefers a live deal over a terminal one', () => {
    expect(propertyStageFromDeals([deal('closed'), deal('proposal')])).toBe('proposal')
    expect(propertyStageFromDeals([deal('inactive'), deal('active')])).toBe('active')
  })

  it('falls back to closed over lost when nothing is live', () => {
    expect(propertyStageFromDeals([deal('inactive'), deal('closed')])).toBe('closed')
    expect(propertyStageFromDeals([deal('inactive'), deal('inactive')])).toBe('inactive')
  })
})
