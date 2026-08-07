import type { Listing, PropertyStatus } from './types'
import { getChildDeals } from './leaseSpaces'
import { getListing } from './store'
import { STAGE_LABEL, type StageLabel } from './stageGates'

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
 * A shell is only ever two things: winning the assignment, or working it. Its
 * spaces carry the transactions, so it has no tenant, no commission, and nothing
 * to close — and no Lost either, because losing a building means its spaces went
 * with it, which is a per-space outcome. Every other shape keeps the full
 * ladder — a space deal's difference is in labelling, not in reach.
 */
export function availableStages(shape: DealShape): PropertyStatus[] {
  if (shape === 'shell') return ['proposal', 'active']
  return [...FULL_LADDER]
}

/**
 * A suite is never "pitched" — the assignment was already won on the shell — but
 * it does need a pre-market state, so `proposal` reads as Inactive there: a suite
 * that exists on the building without being advertised yet.
 */
export type DealStageLabel = StageLabel | 'Inactive'

export function dealStageLabel(status: PropertyStatus, shape: DealShape): DealStageLabel {
  if (shape === 'space' && status === 'proposal') return 'Inactive'
  return STAGE_LABEL[status]
}

/** The shape + shell state a gate needs, resolved from the store in one place. */
export function gateContext(deal: Listing): { shape: DealShape; shellActive: boolean } {
  const shape = dealShape(deal)
  const shell = deal.parentDealId ? getListing(deal.parentDealId) : undefined
  return { shape, shellActive: shell?.status === 'active' }
}

/**
 * Whether this deal owns a building's spaces — a top-level landlord-rep lease
 * deal, whether or not it has been split yet. The one rule `dealShape` cannot
 * express: `shell` and `flat-lease` are the same thing to navigation (both get
 * the Spaces tab), and which of the two a deal is depends only on whether a
 * child happens to exist. Distinct from `canAddSpaces`, which additionally
 * requires a stage that can still accept one — a Lost shell keeps its tab.
 */
export function isLeaseParent(deal: Listing | undefined | null): boolean {
  if (!deal) return false
  const shape = dealShape(deal)
  return shape === 'shell' || shape === 'flat-lease'
}

/** Spaces may only be added while the deal can still become a shell. */
export function canAddSpaces(deal: Listing): boolean {
  return (
    isLeaseParent(deal) &&
    deal.dealSide === 'seller' &&
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
