import type { Listing, PropertyStatus } from './types'
import { getChildDeals } from './leaseSpaces'
import { getListing } from './store'
import { STAGE_LABEL } from './stageGates'

/** The full ladder, in display order. Stated explicitly rather than derived from
 *  an object's key order, because the order is load-bearing for the stage select. */
const FULL_LADDER: PropertyStatus[] = [
  'proposal', 'active', 'under-contract', 'closed', 'inactive',
]

/**
 * How a listing behaves, which is not the same as what it is. A lease deal is a
 * `shell` only once it has children — before that it is a normal whole-building
 * lease listing and must keep behaving like one.
 */
export type DealShape = 'sale' | 'flat-lease' | 'shell' | 'space'

export function dealShape(deal: Listing): DealShape {
  if (deal.dealType !== 'Lease') return 'sale'
  if (deal.parentDealId != null) return 'space'
  return getChildDeals(deal.id).length > 0 ? 'shell' : 'flat-lease'
}

/**
 * A shell never advances past Active: its spaces carry the transactions, so it
 * has no tenant, no commission, and nothing to close. Every other shape keeps
 * the full ladder — a space deal's difference is in labelling, not in reach.
 */
export function availableStages(shape: DealShape): PropertyStatus[] {
  if (shape === 'shell') return ['proposal', 'active', 'inactive']
  return [...FULL_LADDER]
}

/**
 * A suite is never "pitched" — the assignment was already won on the shell — but
 * it does need a pre-market state, so `proposal` reads as Draft there.
 */
export function dealStageLabel(status: PropertyStatus, shape: DealShape): string {
  if (shape === 'space' && status === 'proposal') return 'Draft'
  return STAGE_LABEL[status]
}

/** The shape + shell state a gate needs, resolved from the store in one place. */
export function gateContext(deal: Listing): { shape: DealShape; shellActive: boolean } {
  const shape = dealShape(deal)
  const shell = deal.parentDealId ? getListing(deal.parentDealId) : undefined
  return { shape, shellActive: shell?.status === 'active' }
}

/** Spaces may only be added while the deal can still become a shell. */
export function canAddSpaces(deal: Listing): boolean {
  return (
    deal.dealType === 'Lease' &&
    deal.parentDealId == null &&
    (deal.status === 'proposal' || deal.status === 'active')
  )
}

export type SpaceAvailability = 'Not advertised' | 'Available' | 'Under Contract' | 'Leased'

/** What the building's marketing advertises for a space, derived from its deal stage. */
export function spaceAvailability(childStatus: PropertyStatus): SpaceAvailability {
  switch (childStatus) {
    case 'active':
      return 'Available'
    case 'under-contract':
      return 'Under Contract'
    case 'closed':
      return 'Leased'
    case 'proposal':
    case 'inactive':
      return 'Not advertised'
  }
}
