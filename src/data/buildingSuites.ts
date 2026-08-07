import type { LeaseRateUnits, Listing, PropertyStatus, PropertyUnit } from './types'
import { getListing, getProperty } from './store'
import { getChildDeals } from './leaseSpaces'
import { dealStageLabel, type DealStageLabel } from './dealShape'
import { WHOLE_PROPERTY_LABEL } from './createListing'

/**
 * What a directory row reports. A suite with a deal reports that deal's own
 * stage, verbatim; `Occupied` and `Vacant` are the asset's own answer for a
 * suite nobody is working.
 */
export type SuiteStatus = DealStageLabel | 'Occupied' | 'Vacant'

export interface SuiteRow {
  unitId: string
  label: string
  sqft: number
  /** The child deal working this suite, or null when nobody has started one. */
  dealId: string | null
  stage: PropertyStatus | null
  status: SuiteStatus
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  /** Marketing-facing tenant name: the override when set, else the asset fact. */
  tenantName: string | null
  leaseExpiration: string | null
}

/**
 * Two facts could disagree about a suite — its deal's stage and the unit's
 * occupancy — so the rule is stated once here rather than at each render site:
 *
 * **A deal, when one exists, is the truth. Occupancy answers only for a suite
 * nobody is working.**
 *
 * This is why occupancy on a suite that has a deal is never read. The seed still
 * sets it truthfully so the asset record holds no lie, but the directory does not
 * consult it.
 *
 * The stage is reported as the deal's own label — deliberately *not* through
 * `spaceAvailability`, which answers the different question "what does the
 * building advertise for this space" and so collapses two distinct stages
 * (Inactive and Lost) into one "Not advertised". This is a directory of deals: a
 * broker reading a row needs the stage they would see on the space's own page,
 * and occupancy is the only state here that isn't a stage.
 */
export function suiteStatus(deal: Listing | null, unit: PropertyUnit): SuiteStatus {
  // 'space' is not a guess: every deal reaching here came from `getChildDeals`,
  // and a child of a lease shell is always shape `space`.
  if (deal) return dealStageLabel(deal.status, 'space')
  return unit.occupancy === 'occupied' ? 'Occupied' : 'Vacant'
}

/**
 * Every suite the building has, with its deal joined on when one exists.
 *
 * Distinct from `buildingAvailability`, which is sourced from child deals and
 * answers "what does this building advertise" — a question a suite with no deal
 * has no place in. This one answers "what suites exist", which is what a broker
 * deciding where to start a deal needs.
 */
export function buildingSuites(shellDealId: string): SuiteRow[] {
  const shell = getListing(shellDealId)
  if (!shell) return []
  const property = getProperty(shell.propertyId)
  if (!property) return []

  const dealByUnit = new Map<string, Listing>()
  for (const child of getChildDeals(shellDealId)) {
    if (child.unitId) dealByUnit.set(child.unitId, child)
  }

  return property.units
    // The whole-property stub is the flat-lease deal itself, not a suite of the
    // building: a lease deal with no children markets the whole property, and
    // adding a child space is what makes it a shell (`dealShape`). Excluded here
    // so a fresh deal's directory shows an honest empty state rather than one row
    // standing for the deal you are already looking at.
    .filter((unit) => unit.label !== WHOLE_PROPERTY_LABEL)
    .map((unit): SuiteRow => {
      const deal = dealByUnit.get(unit.id) ?? null
      // Terms live on the child once a deal exists. Before that the shell may
      // still hold a row for the unit — the tenant-name override, or a rate the
      // broker set before splitting. `addSpaceToDeal` migrates that row down.
      const terms = deal
        ? deal.marketing.spaceLeaseTerms?.[0]
        : shell.marketing.spaceLeaseTerms?.find((t) => t.unitId === unit.id)
      return {
        unitId: unit.id,
        label: unit.label,
        sqft: unit.sqft,
        dealId: deal?.id ?? null,
        stage: deal?.status ?? null,
        status: suiteStatus(deal, unit),
        leaseRate: terms?.leaseRate ?? null,
        leaseRateUnits: terms?.leaseRateUnits ?? 'SF/Yr',
        // `||` after trim, not `??`: a blank override is not an answer, so it
        // falls through to the asset fact rather than blanking the column.
        tenantName: terms?.tenantName?.trim() || unit.tenantName,
        leaseExpiration: unit.leaseExpiration,
      }
    })
    // The Vouchers index and this directory must not disagree about order, and
    // `property.units` is insertion-ordered. Numeric collation so Suite 100 does
    // not sort before Suite 20.
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
}

/**
 * Splits a directory into its three kinds of row.
 *
 * - **deals** — every suite carrying a space deal, at any stage.
 * - **available** — no deal and nobody in it: a suite a deal could start on.
 * - **occupied** — no deal, sitting tenant: nothing to do until the lease runs out.
 *
 * The cut is by what a row *does*, not by what a suite is worth: a deal row
 * links to its deal and carries a stage control, an available row carries Start
 * a deal, an occupied row carries the tenant-name editor. One section, one
 * behaviour — which is why a Closed deal groups with the deals rather than with
 * the occupied suites it resembles. Its row still behaves like a deal.
 *
 * Occupancy never pulls a suite out of `deals` — same rule as `suiteStatus`,
 * where a deal outranks the unit's own occupancy.
 *
 * A grouping, not a re-sort: `buildingSuites` keeps one order because the
 * Vouchers index shares it, and each group here preserves it. Which suites bunch
 * together is a fact about how the directory reads, not about the building.
 */
export function groupSuites(rows: SuiteRow[]): {
  deals: SuiteRow[]
  available: SuiteRow[]
  occupied: SuiteRow[]
} {
  return {
    deals: rows.filter((r) => r.dealId),
    available: rows.filter((r) => !r.dealId && r.status !== 'Occupied'),
    occupied: rows.filter((r) => !r.dealId && r.status === 'Occupied'),
  }
}
