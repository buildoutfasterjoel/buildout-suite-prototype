import type { LeaseRateUnits, Listing, PropertyStatus, PropertyUnit, UnitType } from './types'
import { getListing, getProperty, getStore } from './store'
import { getChildDeals } from './leaseSpaces'
import { canAddSpaces, spaceAvailability, type SpaceAvailability } from './dealShape'
import { WHOLE_PROPERTY_LABEL } from './createListing'

/**
 * What a space reports on the *asset* side. A space with a child deal reports
 * what that deal advertises; `Occupied` and `Vacant` are the unit's own answer
 * for a space nobody is working.
 *
 * Deliberately not `SuiteStatus` (buildingSuites.ts), which is the *deal
 * directory's* type and reports the deal's own stage label (Inactive, Active,
 * Closed…). PR #130 moved the directory off `spaceAvailability` because a list
 * of deals must use the deals' words. This is a list of spaces on a property
 * record: its question is "can this space be let?", the property header beside
 * it already shows a deal *stage* badge, and a filterable set must be small —
 * so availability is the right vocabulary here and stage is the right one there.
 */
export type SpaceStatus = SpaceAvailability | 'Occupied' | 'Vacant'

/**
 * Headline order, by what a broker can do *next* from the property page:
 * Available (show it), Under Contract (close it), Vacant (start it), Leased
 * (collect), Occupied (wait for the expiration), Not advertised (the deal is
 * parked — nothing to do from here). Vacant outranks the two settled states
 * because it is the only no-deal state that is an opportunity: a building with
 * five leased suites and one vacant should headline the vacant one.
 */
export const SPACE_STATUS_PRECEDENCE: readonly SpaceStatus[] = [
  'Available',
  'Under Contract',
  'Vacant',
  'Leased',
  'Occupied',
  'Not advertised',
]

/** Same structure as `suiteStatus`: a deal, when one exists, is the truth. */
export function spaceStatus(deal: Listing | null, unit: PropertyUnit): SpaceStatus {
  if (deal) return spaceAvailability(deal.status)
  return unit.occupancy === 'occupied' ? 'Occupied' : 'Vacant'
}

export interface SpaceRow {
  unitId: string
  label: string
  suite: string | null
  floor: number | null
  sqft: number
  unitType: UnitType
  status: SpaceStatus
  /** The child deal working this space, or null. Never a top-level deal — see `childDealsByUnit`. */
  dealId: string | null
  /** The shell the deal hangs under; needed to build the deal's link. */
  shellId: string | null
  stage: PropertyStatus | null
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  /** Marketing-facing tenant name: the override when set, else the asset fact. */
  tenantName: string | null
  leaseExpiration: string | null
}

/**
 * Every child space deal on the property, keyed by the unit it works.
 *
 * Only *children* (`parentDealId != null`) can claim a unit. A top-level deal's
 * `unitId` is not a scope: the seed sets it to the first unit on every
 * whole-building deal as a marketing default (`seed.ts`, `marketingUnitId`), so
 * honouring it would report the building deal's stage on the first suite of
 * every deal property. Same rule as `buildingSuites` and `buildingAvailability`.
 */
function childDealsByUnit(propertyId: string): Map<string, Listing> {
  const byUnit = new Map<string, Listing>()
  for (const l of getStore().listings.values()) {
    if (l.propertyId !== propertyId || l.parentDealId == null || !l.unitId) continue
    byUnit.set(l.unitId, l)
  }
  return byUnit
}

/**
 * The landlord-rep lease deal a new space deal on this property would hang
 * under, or null when there is none that can take one.
 *
 * Prefers a deal that is already a shell (has children) — that is where the
 * building's other spaces live — and otherwise the newest eligible one. Two
 * eligible shells with children is not a shape the seed produces; if it ever
 * is, this picks the newest and the caller should offer a choice.
 */
export function leaseShellForProperty(propertyId: string): Listing | null {
  const candidates = [...getStore().listings.values()].filter(
    (l) =>
      l.propertyId === propertyId &&
      l.parentDealId == null &&
      l.dealType === 'Lease' &&
      l.dealSide === 'seller' &&
      canAddSpaces(l),
  )
  if (candidates.length === 0) return null
  const newestFirst = (a: Listing, b: Listing) => b.createdAt.localeCompare(a.createdAt)
  const withChildren = candidates
    .filter((l) => getChildDeals(l.id).length > 0)
    .sort(newestFirst)
  if (withChildren.length > 0) return withChildren[0]
  return candidates.sort(newestFirst)[0]
}

const rank = (s: SpaceStatus) => SPACE_STATUS_PRECEDENCE.indexOf(s)

/**
 * The one order every property-side surface renders: headline status first,
 * then floor (unknown floors last), then label with numeric collation so
 * Suite 100 does not sort before Suite 20. No surface re-sorts.
 */
export function sortSpaceRows(rows: SpaceRow[]): SpaceRow[] {
  return [...rows].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status)
    if (byStatus !== 0) return byStatus
    if (a.floor !== b.floor) {
      if (a.floor == null) return 1
      if (b.floor == null) return -1
      return a.floor - b.floor
    }
    return a.label.localeCompare(b.label, 'en', { numeric: true })
  })
}

/**
 * Every space the property has, with its child deal joined on when one exists.
 *
 * Property-keyed, unlike `buildingSuites` (shell-keyed, deal-stage vocabulary,
 * shares its order with the Vouchers index) and `buildingAvailability`
 * (shell-keyed, advertised rows only). This answers the asset question — "what
 * spaces exist on this building and can each be let?" — for a property whether
 * or not anyone has started a deal on it.
 */
export function propertySpaces(propertyId: string): SpaceRow[] {
  const property = getProperty(propertyId)
  if (!property) return []
  const dealByUnit = childDealsByUnit(propertyId)
  // A pre-split shell may hold a terms row for a unit nobody has started on —
  // a tenant-name override, or a rate set before splitting. Same fallback as
  // `buildingSuites`; `addSpaceToDeal` migrates that row down when the deal starts.
  const shell = leaseShellForProperty(propertyId)

  const rows = property.units
    // The whole-property stub is a flat-lease deal in disguise, not a space.
    .filter((unit) => unit.label !== WHOLE_PROPERTY_LABEL)
    .map((unit): SpaceRow => {
      const deal = dealByUnit.get(unit.id) ?? null
      const terms = deal
        ? deal.marketing.spaceLeaseTerms?.[0]
        : shell?.marketing.spaceLeaseTerms?.find((t) => t.unitId === unit.id)
      return {
        unitId: unit.id,
        label: unit.label,
        suite: unit.suite,
        floor: unit.floor,
        sqft: unit.sqft,
        unitType: unit.unitType,
        status: spaceStatus(deal, unit),
        dealId: deal?.id ?? null,
        shellId: deal?.parentDealId ?? null,
        stage: deal?.status ?? null,
        leaseRate: terms?.leaseRate ?? null,
        leaseRateUnits: terms?.leaseRateUnits ?? 'SF/Yr',
        // `||` after trim, not `??`: a blank override is not an answer.
        tenantName: terms?.tenantName?.trim() || unit.tenantName,
        leaseExpiration: unit.leaseExpiration,
      }
    })
  return sortSpaceRows(rows)
}

export interface PropertyAvailability {
  spaceCount: number
  counts: Record<SpaceStatus, number>
  /** The statuses present — what an index filter matches against. A building with 3 of 6 available is in the Available set. */
  statuses: ReadonlySet<SpaceStatus>
  /** The highest-precedence status present. */
  headline: SpaceStatus
  headlineCount: number
  /** Every space shares the headline status. */
  uniform: boolean
  totalSqft: number
  /** Available + Vacant square footage. */
  availableSqft: number
}

/**
 * The property's availability, rolled up from its spaces by precedence.
 * Null when the property has no spaces — the caller then shows `property.status`
 * and nothing else, which is today's header verbatim.
 *
 * There is deliberately no `Mixed` value: a future index filter for available
 * properties must still match a building with 3 of 6 available, which a single
 * `Mixed` label would exclude. Mixedness is `uniform === false`, rendered as a
 * segmented bar, never as a status.
 */
export function propertyAvailability(propertyId: string): PropertyAvailability | null {
  const rows = propertySpaces(propertyId)
  if (rows.length === 0) return null

  const counts: Record<SpaceStatus, number> = {
    Available: 0,
    'Under Contract': 0,
    Vacant: 0,
    Leased: 0,
    Occupied: 0,
    'Not advertised': 0,
  }
  let totalSqft = 0
  let availableSqft = 0
  for (const r of rows) {
    counts[r.status] += 1
    totalSqft += r.sqft
    if (r.status === 'Available' || r.status === 'Vacant') availableSqft += r.sqft
  }
  const statuses = new Set(rows.map((r) => r.status))
  // Rows are already in precedence order, so the first row carries the headline.
  const headline = rows[0].status
  const headlineCount = counts[headline]

  return {
    spaceCount: rows.length,
    counts,
    statuses,
    headline,
    headlineCount,
    uniform: headlineCount === rows.length,
    totalSqft,
    availableSqft,
  }
}

/**
 * `Available` · `Leased · 6 spaces` · `Available · 3 of 6 spaces`.
 * One space reads as its bare status, so the singular never renders.
 */
export function formatAvailabilityHeadline(a: PropertyAvailability): string {
  if (a.spaceCount === 1) return a.headline
  if (a.uniform) return `${a.headline} · ${a.spaceCount} spaces`
  return `${a.headline} · ${a.headlineCount} of ${a.spaceCount} spaces`
}

/** The full breakdown, in precedence order, non-zero statuses only: `3 Available · 1 Under Contract · 2 Leased`. */
export function formatAvailabilityBreakdown(a: PropertyAvailability): string {
  return SPACE_STATUS_PRECEDENCE.filter((s) => a.counts[s] > 0)
    .map((s) => `${a.counts[s]} ${s}`)
    .join(' · ')
}

/**
 * Whether `label` already names a space on the property. Trimmed and
 * case-insensitive, and checked against *every* unit including the
 * whole-property stub — so nobody can name a suite "Whole Property" and
 * have the roster filter it out. `excludeUnitId` is the unit being edited.
 */
export function isDuplicateSpaceLabel(
  property: { units: PropertyUnit[] },
  label: string,
  excludeUnitId?: string,
): boolean {
  const wanted = label.trim().toLocaleLowerCase()
  if (!wanted) return false
  return property.units.some(
    (u) => u.id !== excludeUnitId && u.label.trim().toLocaleLowerCase() === wanted,
  )
}

/** Convenience for surfaces that hold a deal id and want its unit's row. */
export function spaceRowForDeal(dealId: string): SpaceRow | null {
  const deal = getListing(dealId)
  if (!deal?.unitId) return null
  return propertySpaces(deal.propertyId).find((r) => r.unitId === deal.unitId) ?? null
}
