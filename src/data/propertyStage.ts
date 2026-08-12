import type { Listing, PropertyStatus } from './types'

/**
 * Open stages, furthest-along last. Terminal stages (`closed`, `inactive`) are
 * ranked separately below — a lost deal is not "further along" than a live one.
 */
const OPEN_LADDER: PropertyStatus[] = ['proposal', 'active', 'under-contract']

/**
 * A property's stage is derived from the deals on it, never stored independently.
 *
 * `null` — no deals at all — is the ordinary case, not an edge case: adding a
 * property to your database doesn't create a deal, so most properties never
 * carry a stage. It is deliberately distinct from `inactive`, which means a
 * deal existed and was lost.
 *
 * With several deals on one property, the live one wins: the furthest-along
 * open stage, falling back to `closed` over `inactive` when nothing is live.
 */
export function propertyStageFromDeals(deals: Listing[]): PropertyStatus | null {
  if (deals.length === 0) return null

  let bestOpen = -1
  for (const d of deals) {
    const rank = OPEN_LADDER.indexOf(d.status)
    if (rank > bestOpen) bestOpen = rank
  }
  if (bestOpen >= 0) return OPEN_LADDER[bestOpen]

  return deals.some((d) => d.status === 'closed') ? 'closed' : 'inactive'
}
