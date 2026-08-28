/**
 * The Back Office receivables list's filter model — what the toolbar holds and
 * how a row is tested against it.
 *
 * Kept free of React, the way `voucherFilters.ts` is, so the rules stay testable
 * in Vitest's node environment and `now` can be injected rather than read from
 * the clock.
 */
import type { DealType, PropertyStatus, PropertyType } from './types'
import type { ChartGrain, ReceivableRow, ReceivableStatus } from './receivables'

/**
 * The year the page is looking at.
 *
 * `'all'` exists for the reason `CloseDatePreset` carries `'any'`: a receivable
 * due outside every year the dropdown happens to offer must still be reachable,
 * or the index has rows nobody can find.
 */
export type ReceivableYear = number | 'all'

export interface ReceivableFilterState {
  search: string
  /** How finely the chart buckets the year. Does not filter any row. */
  grain: ChartGrain
  year: ReceivableYear
  statuses: Set<ReceivableStatus>
  /** Internal broker names, as they appear on the deals themselves. */
  brokers: Set<string>
  stages: Set<PropertyStatus>
  dealTypes: Set<DealType>
  propertyTypes: Set<PropertyType>
}

/**
 * The fields a row must expose to be filtered. A structural subset of
 * {@link ReceivableRow} rather than the whole thing, so the rule stays honest
 * about what it reads — and so a test can build a row without a route target.
 */
export type ReceivableFilterInput = Pick<
  ReceivableRow,
  | 'searchText'
  | 'dueDate'
  | 'status'
  | 'brokerNames'
  | 'dealStage'
  | 'dealType'
  | 'propertyType'
>

/**
 * The toolbar's resting state: nothing chosen, monthly buckets, this year.
 *
 * `now` is a parameter rather than a `new Date()` in here, so a test can say
 * what "this year" means and the page can pin one clock read for its lifetime.
 */
export function emptyReceivableFilters(now: Date): ReceivableFilterState {
  return {
    search: '',
    grain: 'monthly',
    year: now.getFullYear(),
    statuses: new Set(),
    brokers: new Set(),
    stages: new Set(),
    dealTypes: new Set(),
    propertyTypes: new Set(),
  }
}

/** True when `row` survives every filter in `state`. */
export function matchesReceivableFilters(
  row: ReceivableFilterInput,
  state: ReceivableFilterState,
): boolean {
  const q = state.search.trim().toLowerCase()
  // `searchText` is assembled lower-cased at row build, so the haystack is
  // walked once per row rather than re-lowered on every keystroke.
  if (q && !row.searchText.includes(q)) return false

  // The year narrows the table and the chart TOGETHER — the bars always foot to
  // the rows underneath them. A chart describing a wider set than its own table
  // would put two answers to "how much is owed" on one screen.
  if (state.year !== 'all' && row.dueDate.slice(0, 4) !== String(state.year)) {
    return false
  }

  // An empty facet is no restriction at all. A row whose value is null can never
  // be a member of a chosen set, so it drops out once that facet is in use.
  if (state.statuses.size && !state.statuses.has(row.status)) return false
  if (state.dealTypes.size && !state.dealTypes.has(row.dealType)) return false
  if (state.stages.size && !state.stages.has(row.dealStage)) return false
  if (
    state.propertyTypes.size &&
    (row.propertyType == null || !state.propertyTypes.has(row.propertyType))
  ) {
    return false
  }
  // A deal can carry several internal brokers, so this is "any of them", not
  // "the first of them" — filtering to a broker must find every deal they are
  // on, not only the ones they lead.
  if (
    state.brokers.size &&
    !row.brokerNames.some((name) => state.brokers.has(name))
  ) {
    return false
  }

  return true
}

/**
 * How many filters the user has actually chosen — for the count beside the
 * toolbar and the reset affordance on the empty state.
 *
 * A facet counts once however many options are ticked inside it. The grain
 * counts for nothing — it filters no row — and a year still at its default
 * counts for nothing either: that is the page's resting state, not a choice,
 * and badging it on load would be noise.
 */
export function countActiveReceivableFilters(
  state: ReceivableFilterState,
  now: Date,
): number {
  let n = 0
  if (state.search.trim()) n += 1
  if (state.statuses.size) n += 1
  if (state.brokers.size) n += 1
  if (state.stages.size) n += 1
  if (state.dealTypes.size) n += 1
  if (state.propertyTypes.size) n += 1
  if (state.year !== emptyReceivableFilters(now).year) n += 1
  return n
}
