/**
 * The Back Office voucher list's filter model — what the toolbar holds and how a
 * row is tested against it.
 *
 * Kept free of React so the date-window rules stay testable in Vitest's node
 * environment, and so `now` can be injected rather than read from the clock.
 */
import type { DealType, PropertyStatus, PropertyType } from './types'
import type { VoucherRow, VoucherStatus } from './vouchers'

/**
 * The close-date windows the dropdown offers.
 *
 * Every one of these reads the *close* date, which is why a deal that has not
 * closed falls outside all of them — except `active-ytd-closed`, whose whole
 * purpose is to pull the open pipeline back in, and `any`.
 */
export type CloseDatePreset =
  | 'last-365'
  | 'active-ytd-closed'
  | 'ytd'
  | 'last-year'
  | 'custom'
  | 'any'

export const CLOSE_DATE_PRESETS: { value: CloseDatePreset; label: string }[] = [
  { value: 'last-365', label: 'Last 365 days' },
  { value: 'active-ytd-closed', label: 'Active + Year to date closed' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'custom', label: 'Custom range of close date' },
  // Not in the design's list. Without it the four vouchers on Lost deals are
  // unreachable: they carry no close date, so every window above excludes them
  // and `active-ytd-closed` rejects them for not being active. An index whose
  // rows cannot all be reached is worse than an extra option.
  { value: 'any', label: 'Any close date' },
]

export const CLOSE_DATE_LABELS: Record<CloseDatePreset, string> =
  Object.fromEntries(CLOSE_DATE_PRESETS.map((p) => [p.value, p.label])) as Record<
    CloseDatePreset,
    string
  >

/** Stages where the deal is still being worked — no close date yet, or not final. */
const OPEN_STAGES: ReadonlySet<PropertyStatus> = new Set<PropertyStatus>([
  'proposal',
  'active',
  'under-contract',
])

export interface VoucherFilterState {
  search: string
  statuses: Set<VoucherStatus>
  dealTypes: Set<DealType>
  stages: Set<PropertyStatus>
  propertyTypes: Set<PropertyType>
  /** Internal broker names, as they appear on the deals themselves. */
  brokers: Set<string>
  closeDate: CloseDatePreset
  /** `yyyy-mm-dd`, or null for an open-ended bound. Only read when `closeDate` is 'custom'. */
  customFrom: string | null
  customTo: string | null
}

/**
 * The fields a row must expose to be filtered. A structural subset of
 * {@link VoucherRow} rather than the whole thing, so the rule stays honest about
 * what it reads — and so a test can build a row without a route target.
 */
export type VoucherFilterInput = Pick<
  VoucherRow,
  | 'name'
  | 'dealName'
  | 'identifier'
  | 'relatedContactsLabel'
  | 'propertyAddress'
  | 'status'
  | 'dealType'
  | 'dealStage'
  | 'propertyType'
  | 'brokerName'
  | 'closeDate'
>

/** The toolbar's resting state: nothing chosen, and the default close-date window. */
export function emptyVoucherFilters(): VoucherFilterState {
  return {
    search: '',
    statuses: new Set(),
    dealTypes: new Set(),
    stages: new Set(),
    propertyTypes: new Set(),
    brokers: new Set(),
    closeDate: 'last-365',
    customFrom: null,
    customTo: null,
  }
}

/** `yyyy-mm-dd` in local time — the shape the store keeps close dates in. */
function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Whether a close date falls in the chosen window.
 *
 * Compared as `yyyy-mm-dd` strings, which sort chronologically — so no Date is
 * constructed from stored text, and no timezone can shift a boundary date into
 * the wrong day.
 */
function matchesCloseDate(
  row: VoucherFilterInput,
  state: VoucherFilterState,
  now: Date,
): boolean {
  const { closeDate: preset } = state
  if (preset === 'any') return true

  const close = row.closeDate
  const today = isoDay(now)
  const year = now.getFullYear()

  // The one window that is not purely about the close date: an open deal is in
  // the book by virtue of being open, whether or not it has a date yet.
  if (preset === 'active-ytd-closed') {
    if (OPEN_STAGES.has(row.dealStage)) return true
    return close != null && close >= `${year}-01-01` && close <= today
  }

  // Every remaining window asks when this deal closed, which a deal that has
  // not closed cannot answer.
  if (close == null) return false

  switch (preset) {
    case 'last-365': {
      const from = new Date(now)
      from.setDate(from.getDate() - 365)
      return close >= isoDay(from) && close <= today
    }
    case 'ytd':
      return close >= `${year}-01-01` && close <= today
    case 'last-year':
      return close >= `${year - 1}-01-01` && close <= `${year - 1}-12-31`
    case 'custom':
      // A half-entered range still filters — an unset bound is open, not empty,
      // so the list doesn't blank out between the two clicks.
      return (
        (state.customFrom == null || close >= state.customFrom) &&
        (state.customTo == null || close <= state.customTo)
      )
  }
}

/** True when `row` survives every filter in `state`. */
export function matchesVoucherFilters(
  row: VoucherFilterInput,
  state: VoucherFilterState,
  now: Date,
): boolean {
  const q = state.search.trim().toLowerCase()
  if (q) {
    const haystack = [
      row.name,
      row.dealName,
      row.identifier,
      row.relatedContactsLabel,
      row.propertyAddress,
    ]
    if (!haystack.some((field) => field.toLowerCase().includes(q))) return false
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
  if (
    state.brokers.size &&
    (row.brokerName == null || !state.brokers.has(row.brokerName))
  ) {
    return false
  }

  return matchesCloseDate(row, state, now)
}

/**
 * How many filters the user has actually chosen — for the "More filters" style
 * count beside the toolbar.
 *
 * A facet counts once however many options are ticked inside it, and the default
 * close-date preset counts for nothing: it is the page's resting state, not a
 * choice, and badging it on load would be noise.
 */
export function countActiveVoucherFilters(state: VoucherFilterState): number {
  let n = 0
  if (state.search.trim()) n += 1
  if (state.statuses.size) n += 1
  if (state.dealTypes.size) n += 1
  if (state.stages.size) n += 1
  if (state.propertyTypes.size) n += 1
  if (state.brokers.size) n += 1
  if (state.closeDate !== emptyVoucherFilters().closeDate) n += 1
  return n
}
