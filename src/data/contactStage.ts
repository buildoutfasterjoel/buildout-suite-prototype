import type {
  Contact,
  ContactDealStage,
  DealSide,
  Listing,
  PropertyStatus,
  RelationshipStage,
} from './types'

/**
 * Contact ↔ deal stage unification.
 *
 * A contact's relationship stage and deal stage are *derived from the deals they
 * are actually a party to* — the listings are the single source of truth for the
 * contact↔deal graph (see `listDealsForContact`). These pure helpers encode the
 * pipeline's lifecycle rules so the People table, filters, and seed all agree.
 */

/**
 * Map a deal's unified listing stage to the contact-facing deal stage. `inactive`
 * (Lost) is off-ladder — it yields no active deal stage.
 */
export function dealStageFromStatus(status: PropertyStatus): ContactDealStage | null {
  switch (status) {
    case 'proposal':
      return 'pitching'
    case 'active':
      return 'active'
    case 'under-contract':
      return 'under_contract'
    case 'closed':
      return 'closed'
    case 'inactive':
      return null
  }
}

/** Ladder order, furthest-along last. */
const DEAL_STAGE_ORDER: ContactDealStage[] = [
  'pitching',
  'active',
  'under_contract',
  'closed',
]

/** How far along the ladder a deal stage sits (higher = further). */
export function dealStageRank(stage: ContactDealStage): number {
  return DEAL_STAGE_ORDER.indexOf(stage)
}

/**
 * The single furthest-along stage among a contact's deals, or null when they have
 * no active (non-lost) deals. Drives the "furthest stage + N more" People cell.
 */
export function furthestDealStage(
  stages: ContactDealStage[],
): ContactDealStage | null {
  let best: ContactDealStage | null = null
  for (const s of stages) {
    if (best === null || dealStageRank(s) > dealStageRank(best)) best = s
  }
  return best
}

/**
 * Derive a contact's relationship stage from the stages of the deals they're a
 * party to. Unlike the deal-stage cell (which shows the *furthest* deal), the
 * relationship reflects the strongest *live* engagement:
 *
 * - a live won deal (active or under contract) → `client`
 * - an open pitch, nothing won yet → `pitching`
 * - only closed deals, nothing live → `past_client`
 * - no deals at all → a pure relationship temperature (`cold` / `nurturing`),
 *   so the stored value is kept (coercing any stale deal-derived value to
 *   `nurturing`, since a contact with no deal can't be pitching/client).
 */
export function deriveRelationship(
  stored: RelationshipStage,
  stages: ContactDealStage[],
): RelationshipStage {
  if (stages.includes('active') || stages.includes('under_contract')) {
    return 'client'
  }
  if (stages.includes('pitching')) return 'pitching'
  if (stages.includes('closed')) return 'past_client'
  return stored === 'cold' || stored === 'nurturing' ? stored : 'nurturing'
}

/** A contact's deal-derived fields, recomputed from the deals they're a party to. */
export interface ContactDealFields {
  dealStage: ContactDealStage | null
  relationship: RelationshipStage
  side: DealSide | null
}

/**
 * Recompute a contact's deal-derived fields from the (non-lost) deals they're a
 * party to: the furthest-along `dealStage`, the `relationship` per the lifecycle
 * rules, and the `side` of their furthest deal.
 */
export function deriveContactDealFields(
  contact: Contact,
  deals: { stage: ContactDealStage; side: DealSide }[],
): ContactDealFields {
  const stages = deals.map((d) => d.stage)
  return {
    dealStage: furthestDealStage(stages),
    relationship: deriveRelationship(contact.relationship, stages),
    side:
      deals.length > 0
        ? deals.reduce((a, b) =>
            dealStageRank(b.stage) > dealStageRank(a.stage) ? b : a,
          ).side
        : null,
  }
}

/**
 * Reconcile every contact's deal-derived fields against the listings — the source
 * of truth for the contact↔deal graph. Returns a new Contact object for each one
 * whose fields changed (others are omitted), so callers can patch only what moved.
 * Shared by the seed and the live store so a mid-session deal-stage change flows
 * straight through to the People module.
 */
export function reconcileContactDealFields(
  contacts: Iterable<Contact>,
  listings: Iterable<Listing>,
): Contact[] {
  const dealsByContact = new Map<
    string,
    { stage: ContactDealStage; side: DealSide }[]
  >()
  for (const l of listings) {
    const stage = dealStageFromStatus(l.status)
    if (stage === null) continue // Lost deals are off-ladder
    const add = (id: string, side: DealSide) => {
      const arr = dealsByContact.get(id) ?? []
      arr.push({ stage, side })
      dealsByContact.set(id, arr)
    }
    for (const id of l.sellerContactIds) add(id, 'seller')
    for (const id of l.buyerContactIds) add(id, 'buyer')
  }

  const changed: Contact[] = []
  for (const c of contacts) {
    const next = deriveContactDealFields(c, dealsByContact.get(c.id) ?? [])
    if (
      c.dealStage !== next.dealStage ||
      c.relationship !== next.relationship ||
      c.side !== next.side
    ) {
      changed.push({ ...c, ...next })
    }
  }
  return changed
}
