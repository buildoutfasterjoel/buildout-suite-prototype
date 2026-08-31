/**
 * The Back Office deposits list's filter model — what the toolbar holds and how
 * a row is tested against it.
 *
 * Kept free of React, the way `receivableFilters.ts` and `voucherFilters.ts`
 * are, so the rules stay testable in Vitest's node environment and `now` can be
 * injected rather than read from the clock.
 *
 * Two facets Receivables carries are deliberately absent. **Status** has nothing
 * to describe: a deposit has arrived, and there is no state it can be in. **Deal
 * Stage** is missing because the reference design does not carry it — the facets
 * here are the ones that narrow a book of cash receipts, and a deal's stage is a
 * fact about the deal, not about the money.
 */
import type { DealType, PropertyType } from './types'
import type { ChartGrain } from './receivables'
import type { DepositRow } from './depositIndex'

/**
 * The year the page is looking at.
 *
 * `'all'` exists for the reason `ReceivableYear` carries it: a deposit that
 * landed outside every year the dropdown happens to offer must still be
 * reachable, or the index has rows nobody can find.
 */
export type DepositYear = number | 'all'

export interface DepositFilterState {
  search: string
  /** How finely the chart buckets the year. Does not filter any row. */
  grain: ChartGrain
  year: DepositYear
  /** Internal broker names, as they appear on the deals themselves. */
  brokers: Set<string>
  dealTypes: Set<DealType>
  propertyTypes: Set<PropertyType>
}

/**
 * The fields a row must expose to be filtered. A structural subset of
 * {@link DepositRow} rather than the whole thing, so the rule stays honest
 * about what it reads — and so a test can build a row without a route target.
 */
export type DepositFilterInput = Pick<
  DepositRow,
  'searchText' | 'date' | 'brokerNames' | 'dealType' | 'propertyType'
>

/**
 * The toolbar's resting state: nothing chosen, monthly buckets, this year.
 *
 * `now` is a parameter rather than a `new Date()` in here, so a test can say
 * what "this year" means and the page can pin one clock read for its lifetime.
 */
export function emptyDepositFilters(now: Date): DepositFilterState {
  return {
    search: '',
    grain: 'monthly',
    year: now.getFullYear(),
    brokers: new Set(),
    dealTypes: new Set(),
    propertyTypes: new Set(),
  }
}

/** True when `row` survives every filter in `state`. */
export function matchesDepositFilters(
  row: DepositFilterInput,
  state: DepositFilterState,
): boolean {
  const q = state.search.trim().toLowerCase()
  // `searchText` is assembled lower-cased at row build, so the haystack is
  // walked once per row rather than re-lowered on every keystroke.
  if (q && !row.searchText.includes(q)) return false

  // The year narrows the table and the chart TOGETHER — the bars always foot to
  // the rows underneath them. A chart describing a wider set than its own table
  // would put two answers to "how much came in" on one screen.
  if (state.year !== 'all' && row.date.slice(0, 4) !== String(state.year)) {
    return false
  }

  // An empty facet is no restriction at all. A row whose value is null can never
  // be a member of a chosen set, so it drops out once that facet is in use.
  if (state.dealTypes.size && !state.dealTypes.has(row.dealType)) return false
  if (
    state.propertyTypes.size &&
    (row.propertyType == null || !state.propertyTypes.has(row.propertyType))
  ) {
    return false
  }
  // A deal can carry several internal brokers, so this is "any of them", not
  // "the first of them" — filtering to a broker must find every deposit on a
  // deal they are on, not only the ones they lead.
  if (
    state.brokers.size &&
    !row.brokerNames.some((name) => state.brokers.has(name))
  ) {
    return false
  }

  return true
}

/**
 * How many filters the user has actually chosen — for the reset affordance on
 * the empty state.
 *
 * A facet counts once however many options are ticked inside it. The grain
 * counts for nothing — it filters no row — and a year still at its default
 * counts for nothing either: that is the page's resting state, not a choice.
 */
export function countActiveDepositFilters(
  state: DepositFilterState,
  now: Date,
): number {
  let n = 0
  if (state.search.trim()) n += 1
  if (state.brokers.size) n += 1
  if (state.dealTypes.size) n += 1
  if (state.propertyTypes.size) n += 1
  if (state.year !== emptyDepositFilters(now).year) n += 1
  return n
}
