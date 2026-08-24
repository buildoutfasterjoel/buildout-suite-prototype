import type { DealType, Listing, PropertyStatus, PropertyType } from './types'
import { getStore, getProperty } from './store'
import { dealShape } from './dealShape'

/** The three states a voucher moves through. Mirrors `DealFinancials['status']`. */
export type VoucherStatus = 'Draft' | 'Pending' | 'Approved'

/** Display order for the KPI band: earliest state first, so it reads as a pipeline. */
export const VOUCHER_STATUSES: VoucherStatus[] = ['Draft', 'Pending', 'Approved']

/**
 * How a status is written out where there is room for it — the KPI tiles and the
 * status filter. The table's badges use the bare `status` instead, which is why
 * only `Pending` differs: a column of badges cannot afford "Pending Approval".
 */
export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  Draft: 'Draft',
  Pending: 'Pending Approval',
  Approved: 'Approved',
}

/**
 * Where a deal's voucher page lives, as a typed route target.
 *
 * A discriminated union, not `{ to: string; params: Record<string, string> }`:
 * the space route needs two params and the others one, and only the union lets
 * a caller spread this straight into `<Link {...target} />` or `navigate()`
 * without TanStack rejecting the params as under-specified.
 */
export type VoucherTarget =
  | { to: '/listings/$listingId/financials'; params: { listingId: string } }
  | {
      to: '/listings/$listingId/spaces/$spaceId/financials'
      params: { listingId: string; spaceId: string }
    }
  | { to: '/listings/$listingId/vouchers'; params: { listingId: string } }

export interface VoucherRow {
  /** The deal this voucher settles — also the row's identity. */
  dealId: string
  /** The voucher's own name. Seeded from the deal name, but editable apart from it. */
  name: string
  /** The deal's name, for the column that links back to the record. */
  dealName: string
  identifier: string
  status: VoucherStatus
  closeDate: string | null
  /**
   * The day the deal was created, as `yyyy-mm-dd`.
   *
   * Normalised to a local calendar day here rather than kept as the raw
   * timestamp, so every date the filters compare is the same shape and sorts
   * chronologically as a plain string.
   */
  createdOn: string
  dealType: DealType
  /** The deal's stage — the Deal Stage facet, and what `active-ytd-closed` reads. */
  dealStage: PropertyStatus
  /** Null when the deal's property has been removed from the store. */
  propertyType: PropertyType | null
  /** Street address of the deal's property, for the toolbar's address search. */
  propertyAddress: string
  /** The deal's primary internal broker, or null when it has none. */
  brokerName: string | null
  relatedContactsLabel: string
  transactionValue: number
  grossCommission: number
  /** Receivables billed but not yet credited. 0 when the voucher has none. */
  receivablesOutstanding: number
  /** Where the row navigates — see {@link voucherHref}. */
  target: VoucherTarget
}

/**
 * The voucher page for a deal. Three destinations, because a voucher is not a
 * record of its own — it is a tab whose route depends on the deal's shape, and
 * this mirrors the swap `dealNav` already makes in the deal sidebar.
 *
 * A shell is the odd one: its spaces carry the transactions, so it earns no
 * commission itself and has no voucher. Its row points at the per-space Vouchers
 * index instead, which is the honest answer to "show me this deal's money".
 */
export function voucherHref(deal: Listing): VoucherTarget {
  const shape = dealShape(deal)
  if (shape === 'shell') {
    return { to: '/listings/$listingId/vouchers', params: { listingId: deal.id } }
  }
  if (shape === 'space' && deal.parentDealId) {
    return {
      to: '/listings/$listingId/spaces/$spaceId/financials',
      params: { listingId: deal.parentDealId, spaceId: deal.id },
    }
  }
  return { to: '/listings/$listingId/financials', params: { listingId: deal.id } }
}

/**
 * Every voucher in the book, flattened for the Back Office index.
 *
 * One row per deal, including shells and their spaces — every deal carries a
 * `transaction.backOffice` record from the moment it is created, so there is no
 * separate notion of "a voucher was created" to filter on.
 *
 * Sorted by voucher name. The store returns insertion order, which is arbitrary
 * to a broker and would also reshuffle the table on any unrelated deal edit.
 */
export function allVouchers(): VoucherRow[] {
  return [...getStore().listings.values()]
    .map((deal) => {
      const voucher = deal.transaction.backOffice
      const property = getProperty(deal.propertyId)
      const created = new Date(deal.createdAt)
      return {
        dealId: deal.id,
        name: voucher.name,
        dealName: deal.name,
        identifier: voucher.identifier,
        status: voucher.status,
        closeDate: voucher.closeDate,
        createdOn: [
          created.getFullYear(),
          String(created.getMonth() + 1).padStart(2, '0'),
          String(created.getDate()).padStart(2, '0'),
        ].join('-'),
        dealType: deal.dealType,
        dealStage: deal.status,
        propertyType: property?.propertyType ?? null,
        // Assembled the way the deal header shows it, so a broker searching the
        // address they see on the deal page finds the voucher here.
        propertyAddress: property
          ? [property.street, property.city, property.state, property.zip]
              .filter(Boolean)
              .join(', ')
          : '',
        brokerName: deal.internalBrokers[0]?.name ?? null,
        relatedContactsLabel: voucher.relatedContactsLabel,
        transactionValue: deal.transaction.salePrice,
        grossCommission: deal.transaction.commissionAmount,
        // Net of credits: what the brokerage is still owed, which is the figure
        // the Financials tab's receivables table also foots to.
        receivablesOutstanding: voucher.receivables.reduce(
          (sum, r) => sum + (r.amount - r.credited),
          0,
        ),
        target: voucherHref(deal),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }))
}

export interface VoucherTotal {
  count: number
  grossCommission: number
}

/**
 * Gross commission and voucher count per status — the three tiles above the
 * table. Takes the rows rather than reading the store so the band can be footed
 * against the filtered set the table is actually showing.
 *
 * Seeded with every status, so a tile with nothing behind it renders "$0 | 0
 * Vouchers" rather than disappearing and leaving a two-tile band.
 */
export function voucherTotals(
  rows: Pick<VoucherRow, 'status' | 'grossCommission'>[],
): Record<VoucherStatus, VoucherTotal> {
  const totals = {
    Draft: { count: 0, grossCommission: 0 },
    Pending: { count: 0, grossCommission: 0 },
    Approved: { count: 0, grossCommission: 0 },
  }
  for (const row of rows) {
    totals[row.status].count += 1
    totals[row.status].grossCommission += row.grossCommission
  }
  return totals
}
