/**
 * The Back Office deposits index — every cash receipt in the book, flattened.
 *
 * The counterpart of `receivables.ts`, and the mirror image of the question it
 * asks. That page is a collections calendar: what have we billed, and how much
 * of it is still out. This one follows the money the other way — a deposit has
 * already arrived, so the only question left is where it went. Four columns
 * answer it, and they always sum to the amount that landed:
 *
 *     Amount = Deducted Pre-Split + Paid To Brokers + Open Payables
 *            + Collected House Split
 *
 * Only the last of those is arithmetic this module owns. The other three come
 * from `payables.ts` and the deposit's own allocations, so this page and the
 * voucher's Payables section cannot drift into telling two stories about the
 * same cheque.
 *
 * Nothing here reads the clock. A deposit has already happened, so no figure on
 * this page changes with the passage of time — the only thing that needs to
 * know what "now" is is the year dropdown, and {@link depositYears} takes it as
 * a parameter. That is the one way this module differs from `receivables.ts`,
 * where every row carries a status that turns over at midnight.
 */
import type {
  DealType,
  Listing,
  PropertyStatus,
  PropertyType,
  VoucherDeposit,
} from './types'
import { getStore, getProperty } from './store'
import { findPayableBroker, payableBalance, payableNetPaid } from './payables'
import { voucherHref, voucherParty, type VoucherTarget } from './vouchers'
import {
  brokerFace,
  type ChartGrain,
  type ReceivableBroker,
} from './receivables'
import { MONEY_COLORS } from './moneyColors'

/**
 * The chart's four stacked series, and the colour each draws in.
 *
 * The keys are `DepositRow` fields, so a series cannot name a figure the table
 * does not also show in a column.
 *
 * The mapping onto {@link MONEY_COLORS} is by meaning, not by resemblance to
 * Receivables:
 *
 * - **Collected House Split** is `settled` — the brokerage's own money, in the
 *   bank, owed to nobody.
 * - **Paid To Brokers** is `outstanding` — it has left the building, but as far
 *   as this page is concerned it is the same blue as money in flight.
 * - **Open Payables** is `late` — a debt the brokerage has not settled, which is
 *   the one band on the page anybody has to act on.
 * - **Deducted Pre-Split** is `withheld`, the colour's whole purpose.
 */
export const DEPOSIT_SERIES_COLORS = {
  deductedPreSplit: MONEY_COLORS.withheld,
  paidToBrokers: MONEY_COLORS.outstanding,
  openPayables: MONEY_COLORS.late,
  collectedHouseSplit: MONEY_COLORS.settled,
} as const

/** Shown when one deposit paid receivables billed to more than one party. */
export const MULTIPLE_PAYERS = 'Multiple'

export interface DepositRow {
  /**
   * `${dealId}:${depositId}` — the row's identity for React keys. A bare
   * deposit id would do today, but ids are only unique within their own voucher
   * by construction, and a key on it would silently merge two rows the day that
   * stopped being true.
   */
  key: string
  dealId: string
  depositId: string
  /** The voucher's own name. Seeded from the deal name, editable apart from it. */
  voucherName: string
  /** Where the Voucher cell links — this deal's voucher tab. */
  target: VoucherTarget
  /** The deal's internal brokers, in deal order. */
  brokers: ReceivableBroker[]
  /** The payer's cheque or wire reference. Every deposit carries one. */
  referenceNumber: string
  /** Who paid, as the row addresses them — or `Multiple`. See {@link depositPayer}. */
  payerName: string
  /** The day the money landed, `yyyy-mm-dd`. */
  date: string
  /** Cash received. The figure the other four columns divide up. */
  amount: number

  /** Put against pre-split deductions before anyone was paid. */
  deductedPreSplit: number
  /** What the brokers actually took home out of this deposit. */
  paidToBrokers: number
  /** What the brokerage still owes its brokers out of it. */
  openPayables: number
  /** Everything left over — see {@link houseSplit}. */
  collectedHouseSplit: number

  // --- Facets, carried from the deal so the filter predicate reads one flat
  // object rather than walking back to the store for every test.
  dealStage: PropertyStatus
  dealType: DealType
  propertyType: PropertyType | null
  /** Internal broker names — what the Brokers facet matches against. */
  brokerNames: string[]
  /** Lower-cased haystack: payer, voucher, reference, amounts. */
  searchText: string
}

/** Money is counted in cents, so no float tail leaks into a total. */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Who paid, as one name.
 *
 * A deposit has no payer of its own — it is cash, and the only thing that says
 * where it came from is the receivables it landed on. So the payer is read back
 * through the allocations.
 *
 * One party pays almost every deposit, and that is the case the column is tuned
 * for. When two do, the cell reads `Multiple` rather than naming one of them:
 * printing the larger share would state one party's name over another party's
 * money, and listing both would push a read-down column wide enough to wrap.
 * Search still finds the row under either name — `searchText` carries all of
 * them, whatever the cell shows.
 *
 * A deposit that reached no receivable at all — cash filed against a voucher and
 * not yet spread — has nobody to name, so it reads as a dash.
 */
export function depositPayer(deal: Listing, deposit: VoucherDeposit): string {
  const receivables = deal.transaction.backOffice.receivables
  const names = new Set<string>()
  for (const allocation of deposit.receivableAllocations) {
    const receivable = receivables.find((r) => r.id === allocation.targetId)
    if (!receivable) continue
    const party = voucherParty(receivable.payerContactId)
    // The same rule the Receivables column follows: a line billed to an entity
    // names the entity, and both forms name the same contact underneath.
    names.add(
      receivable.billToCompany && party.company ? party.company : party.name,
    )
  }
  if (names.size === 0) return '--'
  if (names.size > 1) return MULTIPLE_PAYERS
  return [...names][0]
}

/** Every payer behind this deposit, for the search haystack. Never `Multiple`. */
function payerNames(deal: Listing, deposit: VoucherDeposit): string[] {
  const receivables = deal.transaction.backOffice.receivables
  const names = new Set<string>()
  for (const allocation of deposit.receivableAllocations) {
    const receivable = receivables.find((r) => r.id === allocation.targetId)
    if (!receivable) continue
    const party = voucherParty(receivable.payerContactId)
    names.add(party.name)
    if (party.company) names.add(party.company)
  }
  return [...names]
}

/** What this deposit put against the voucher's pre-split deductions. */
export function deductedPreSplit(deposit: VoucherDeposit): number {
  return toCents(
    deposit.deductionAllocations.reduce((total, a) => total + a.amount, 0),
  )
}

/**
 * What the brokers actually received out of this deposit, and what is still
 * owed to them.
 *
 * Only the payables this deposit raised — `payables.depositId` — never every
 * payable on the voucher. A voucher paid in three instalments carries three
 * sets, and a row that summed all of them would report the same cheque on
 * three lines.
 *
 * **`paid` is the NET cheque, not the payable's gross.** `payableNetPaid`
 * applies the broker's own split and subtracts the hold-backs on each payment,
 * so this column is what left the building for a broker. The house's share of
 * that same payment is not paid to a broker by any reading, and it falls into
 * {@link houseSplit} where it belongs.
 *
 * **`open` is the GROSS balance.** It is the figure the next cheque is written
 * against — the same one the Payables table and the Create Payment modal show —
 * and netting it would put a number on the page that matches nothing a user can
 * click through to.
 *
 * The asymmetry is deliberate, and it is why the two are computed together
 * rather than in two exported helpers that could be paired up wrongly.
 */
export function brokerShares(
  deal: Listing,
  depositId: string,
): { paid: number; open: number } {
  const payables = (deal.transaction.backOffice.payables ?? []).filter(
    (p) => p.depositId === depositId,
  )
  let paid = 0
  let open = 0
  for (const payable of payables) {
    paid = toCents(paid + payableNetPaid(payable, findPayableBroker(deal, payable.brokerId)))
    open = toCents(open + payableBalance(payable))
  }
  return { paid, open }
}

/**
 * The brokerage's own money out of this deposit: everything the three columns
 * before it did not claim.
 *
 * A residual rather than a sum, because it is genuinely made of several
 * unrelated pieces — the commission never assigned to any broker, the house's
 * cut of every cheque already written, and the hold-backs taken off those
 * cheques. Adding those three up would be three chances to disagree with the
 * deposit's own amount; subtracting guarantees the row foots.
 *
 * Floored at zero. Broker gross commissions larger than the amount billed are a
 * data state the voucher form permits, and a negative here would read as the
 * brokerage owing money out of a deposit it received.
 */
export function houseSplit({
  amount,
  deducted,
  paid,
  open,
}: {
  amount: number
  deducted: number
  paid: number
  open: number
}): number {
  return Math.max(0, toCents(amount - deducted - paid - open))
}

/**
 * Every deposit in the book, one row each.
 *
 * A lease **shell** contributes nothing. `voucherHref` owns the "does this deal
 * have a voucher" question — a shell keeps the `backOffice` record it had before
 * it was split, and listing its deposits would report money its own suites are
 * already reporting.
 *
 * Sorted by the date the money landed, oldest first — the order a bank statement
 * is read in, and the order the reference design shows. The voucher name breaks
 * a tie, so two deposits on the same day cannot reshuffle on an unrelated edit.
 */
export function allDeposits(): DepositRow[] {
  return [...getStore().listings.values()]
    .flatMap((deal) => {
      const target = voucherHref(deal)
      if (!target) return []
      const voucher = deal.transaction.backOffice
      const property = getProperty(deal.propertyId)
      const brokers = deal.internalBrokers.map((b) => brokerFace(b.name))

      return (voucher.deposits ?? []).map((deposit): DepositRow => {
        const deducted = deductedPreSplit(deposit)
        const { paid, open } = brokerShares(deal, deposit.id)
        const payer = depositPayer(deal, deposit)

        return {
          key: `${deal.id}:${deposit.id}`,
          dealId: deal.id,
          depositId: deposit.id,
          voucherName: voucher.name,
          target,
          brokers,
          referenceNumber: deposit.referenceNumber,
          payerName: payer,
          date: deposit.date,
          amount: deposit.amount,
          deductedPreSplit: deducted,
          paidToBrokers: paid,
          openPayables: open,
          collectedHouseSplit: houseSplit({
            amount: deposit.amount,
            deducted,
            paid,
            open,
          }),
          dealStage: deal.status,
          dealType: deal.dealType,
          propertyType: property?.propertyType ?? null,
          brokerNames: deal.internalBrokers.map((b) => b.name),
          // Amounts go in unformatted as well as the way the cell shows them,
          // so "30000" and "30,000.00" both find the same row. Every payer goes
          // in, not the one the cell prints, so a `Multiple` row is still
          // reachable by either name.
          searchText: [
            ...payerNames(deal, deposit),
            voucher.name,
            deal.name,
            deposit.referenceNumber,
            String(deposit.amount),
            deposit.amount.toFixed(2),
          ]
            .join(' ')
            .toLowerCase(),
        }
      })
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.voucherName.localeCompare(b.voucherName, 'en', { numeric: true }),
    )
}

export interface DepositTotals {
  count: number
  amount: number
  deductedPreSplit: number
  paidToBrokers: number
  openPayables: number
  collectedHouseSplit: number
}

/**
 * The table's TOTAL row.
 *
 * Takes the rows rather than reading the store, so it can foot the FILTERED set
 * the table is actually showing — a total describing the whole book above a
 * filtered table would misreport.
 */
export function depositTotals(rows: DepositRow[]): DepositTotals {
  return rows.reduce<DepositTotals>(
    (total, row) => ({
      count: total.count + 1,
      amount: toCents(total.amount + row.amount),
      deductedPreSplit: toCents(total.deductedPreSplit + row.deductedPreSplit),
      paidToBrokers: toCents(total.paidToBrokers + row.paidToBrokers),
      openPayables: toCents(total.openPayables + row.openPayables),
      collectedHouseSplit: toCents(
        total.collectedHouseSplit + row.collectedHouseSplit,
      ),
    }),
    {
      count: 0,
      amount: 0,
      deductedPreSplit: 0,
      paidToBrokers: 0,
      openPayables: 0,
      collectedHouseSplit: 0,
    },
  )
}

export interface DepositBucket {
  /** `Jan '26` or `Q1 '26` — the axis tick. */
  label: string
  /** Everything that landed in this bucket, the four series summed. */
  total: number
  deductedPreSplit: number
  paidToBrokers: number
  openPayables: number
  collectedHouseSplit: number
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * The chart's bars, bucketed by the date the money landed.
 *
 * Receivables buckets by due date, because a collections page is asking what
 * June owes. This page has no such question — the money is already here, so the
 * only date it can be filed under is the day it arrived.
 *
 * The four series split each row rather than double-counting it, so a bar's
 * height is the cash that landed that month and the stack reads as where it
 * went.
 *
 * Every bucket in the year is present even when nothing lands in it, so the
 * axis stays a full twelve (or four) wide and a quiet month reads `$0` rather
 * than vanishing and shifting its neighbours.
 */
export function depositBuckets(
  rows: DepositRow[],
  { year, grain }: { year: number; grain: ChartGrain },
): DepositBucket[] {
  const size = grain === 'monthly' ? 12 : 4
  const yy = String(year).slice(-2)
  const buckets: DepositBucket[] = Array.from({ length: size }, (_, i) => ({
    label: grain === 'monthly' ? `${MONTH_NAMES[i]} '${yy}` : `Q${i + 1} '${yy}`,
    total: 0,
    deductedPreSplit: 0,
    paidToBrokers: 0,
    openPayables: 0,
    collectedHouseSplit: 0,
  }))

  for (const row of rows) {
    // Sliced, not parsed: `yyyy-mm-dd` carries its own year and month, and
    // `new Date('2026-06-08')` is parsed as UTC, which lands on June 7th for
    // anyone west of Greenwich.
    if (row.date.slice(0, 4) !== String(year)) continue
    const month = Number(row.date.slice(5, 7)) - 1
    const bucket = buckets[grain === 'monthly' ? month : Math.floor(month / 3)]
    if (!bucket) continue

    bucket.deductedPreSplit = toCents(
      bucket.deductedPreSplit + row.deductedPreSplit,
    )
    bucket.paidToBrokers = toCents(bucket.paidToBrokers + row.paidToBrokers)
    bucket.openPayables = toCents(bucket.openPayables + row.openPayables)
    bucket.collectedHouseSplit = toCents(
      bucket.collectedHouseSplit + row.collectedHouseSplit,
    )
    bucket.total = toCents(bucket.total + row.amount)
  }

  return buckets
}

/**
 * The years the year dropdown offers: every year a deposit landed in, newest
 * first, with the current year always present.
 *
 * Derived from the rows rather than a fixed range, for the reason the Vouchers
 * toolbar builds its broker list from the book — an option nothing matches is a
 * dead end. The current year is forced in so the default is always selectable
 * on a book with nothing deposited this year.
 */
export function depositYears(rows: DepositRow[], now: Date): number[] {
  const years = new Set(rows.map((r) => Number(r.date.slice(0, 4))))
  years.add(now.getFullYear())
  return [...years].sort((a, b) => b - a)
}
