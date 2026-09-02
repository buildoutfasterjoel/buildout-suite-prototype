/**
 * The Back Office payables list's filter model — what the toolbar holds and how
 * a row is tested against it.
 *
 * Kept free of React, the way `receivableFilters.ts` and `depositFilters.ts`
 * are, so the rules stay testable in Vitest's node environment and `now` can be
 * injected rather than read from the clock.
 *
 * Narrower than either sibling on purpose. This page is a work queue — who do
 * we owe — so the only facets are the two that narrow a queue: when the debt
 * was raised, and whether it is still a debt. Deal Type, Property Type and Deal
 * Stage are facts about the deal, not about what the brokerage owes a person
 * for it, and a Brokers facet would duplicate the grouping the page already is.
 */
import type { PayableRow, PayableStatus } from './payableIndex'

/**
 * The year the Creation Date dropdown is looking at.
 *
 * `'all'` exists for the reason `DepositYear` carries it: a payable raised
 * outside every year the dropdown happens to offer must still be reachable, or
 * the index has rows nobody can find.
 */
export type PayableYear = number | 'all'

export interface PayableFilterState {
  search: string
  /** Which years of `PayableRow.date` survive. */
  year: PayableYear
  /** Empty means every status, the way every other facet in Back Office reads. */
  statuses: Set<PayableStatus>
}

/**
 * The toolbar's resting state: **Outstanding, all time.**
 *
 * The one filter in Back Office that starts switched on, and the reason is what
 * the page is for. Receivables and Deposits are ledgers you go and read;
 * this one is a queue you go and clear, so it opens showing the work rather
 * than showing the work mixed in with every cheque already written. The chip
 * says so, and Clear Filters takes it off.
 *
 * All time rather than this year, unlike the siblings: a debt does not stop
 * being owed because the calendar turned over, and a payable raised in December
 * is still somebody's money in January.
 *
 * `now` is a parameter it does not currently read, kept for the signature every
 * other `empty*Filters` in Back Office has — the page pins one clock read for
 * its lifetime and hands it to all of them.
 */
export function emptyPayableFilters(_now: Date): PayableFilterState {
  return {
    search: '',
    year: 'all',
    statuses: new Set<PayableStatus>(['Outstanding']),
  }
}

/**
 * The state with nothing applied at all — what Clear Filters writes.
 *
 * Distinct from {@link emptyPayableFilters}, which is not empty: it carries
 * Outstanding. Clearing back to the default would leave a chip on screen after
 * the user asked for every filter to go, so Clear means clear.
 */
export function clearedPayableFilters(): PayableFilterState {
  return { search: '', year: 'all', statuses: new Set<PayableStatus>() }
}

/**
 * The fields a row must expose to be filtered. A structural subset of
 * {@link PayableRow} rather than the whole thing, so the rule stays honest
 * about what it reads — and so a test can build a row without a route target.
 */
export type PayableFilterInput = Pick<
  PayableRow,
  'searchText' | 'date' | 'status'
>

/** True when `row` survives every filter in `state`. */
export function matchesPayableFilters(
  row: PayableFilterInput,
  state: PayableFilterState,
): boolean {
  const q = state.search.trim().toLowerCase()
  // `searchText` is assembled lower-cased at row build, so the haystack is
  // walked once per row rather than re-lowered on every keystroke.
  if (q && !row.searchText.includes(q)) return false

  if (state.year !== 'all' && row.date.slice(0, 4) !== String(state.year)) {
    return false
  }

  if (state.statuses.size > 0 && !state.statuses.has(row.status)) return false

  return true
}

/** One active filter, as the chip row renders it. */
export interface PayableFilterChip {
  key: string
  /** What the chip reads. The chips are short enough not to need a group prefix. */
  label: string
  /** The state with just this filter taken off. */
  clear: (state: PayableFilterState) => PayableFilterState
}

/**
 * The active filters, as chips.
 *
 * Search is deliberately not one. The term is already visible in the box it was
 * typed into, and a chip repeating it gives the user two places to clear the
 * same thing — the call `contactFilterChips` makes for the same reason.
 */
export function payableFilterChips(
  state: PayableFilterState,
): PayableFilterChip[] {
  const chips: PayableFilterChip[] = []

  for (const status of state.statuses) {
    chips.push({
      key: `status:${status}`,
      label: status,
      clear: (s) => {
        const statuses = new Set(s.statuses)
        statuses.delete(status)
        return { ...s, statuses }
      },
    })
  }

  if (state.year !== 'all') {
    chips.push({
      key: `year:${state.year}`,
      label: String(state.year),
      clear: (s) => ({ ...s, year: 'all' }),
    })
  }

  return chips
}

/** How many filters are on — what decides whether Clear Filters is offered. */
export function countActivePayableFilters(state: PayableFilterState): number {
  return (
    payableFilterChips(state).length + (state.search.trim() === '' ? 0 : 1)
  )
}
