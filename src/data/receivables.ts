/**
 * The Back Office receivables index — every billed line in the book, flattened.
 *
 * The Vouchers index answers "what state is this deal's settlement in".
 * This answers the narrower money question underneath it: what has been billed,
 * what has landed, and what is late.
 *
 * `now` is injected into everything that reads a date, never taken from the
 * clock in here, so the status boundaries are testable and a single render
 * cannot straddle midnight.
 */
import type {
  DealType,
  FinancialReceivable,
  Listing,
  PropertyStatus,
  PropertyType,
} from './types'
import { getStore, getProperty } from './store'
import { depositsForReceivable } from './deposits'
import { voucherHref, voucherParty, type VoucherTarget } from './vouchers'
import { CURRENT_USER, TEAMMATES } from './teammates'

/**
 * Where a receivable stands with collections. Derived on read — nothing stores
 * it — so a line cannot be marked paid while it still owes money.
 *
 * There is deliberately no `Partially Paid`. A half-credited line that is not
 * yet due is Open and a half-credited line past its date is Overdue; in both
 * cases the badge is answering "does anyone still need to chase this", and the
 * partial is already on the row twice over, in Deposits and in Open / Due.
 */
export type ReceivableStatus = 'Overdue' | 'Open' | 'Fully Paid'

/** Filter order, and the order the status facet lists them: worst first. */
export const RECEIVABLE_STATUSES: ReceivableStatus[] = [
  'Overdue',
  'Open',
  'Fully Paid',
]

/**
 * One colour per status, shared by the table's badges and the chart's stacked
 * series — so a bar and a badge can never disagree about which red is Overdue.
 *
 * `Fully Paid` is the chart's Deposits series: money that arrived is the same
 * fact whichever way the page shows it.
 */
export const RECEIVABLE_STATUS_COLORS: Record<ReceivableStatus, string> = {
  Overdue: '#d92d20',
  Open: '#2431a8',
  'Fully Paid': '#3fa76a',
}

/** Money that credited a receivable but came from no deposit. Always $0 — see below. */
export const OTHER_CREDITS_COLOR = '#e27400'

/** One broker's face in the Brokers column. */
export interface ReceivableBroker {
  name: string
  /** Two letters, shown when there is no photo to show. */
  initials: string
  /** Borrowed from the staff roster when the name matches — see {@link brokerFace}. */
  avatarUrl?: string
}

export interface ReceivableRow {
  /**
   * `${dealId}:${receivableId}` — the row's identity for React keys and for the
   * selection set. A bare receivable id would do today, but the id is only
   * unique within its own voucher by construction, and a selection keyed on it
   * would silently merge two rows the day that stopped being true.
   */
  key: string
  dealId: string
  receivableId: string
  /** The voucher's own name. Seeded from the deal name, editable apart from it. */
  voucherName: string
  /** Where the Voucher cell links — this deal's voucher tab. */
  target: VoucherTarget
  /** The deal's internal brokers, in deal order. */
  brokers: ReceivableBroker[]
  /** How many of the deal's invoices bill THIS receivable. */
  invoiceCount: number
  /** Who is billed, as the row addresses them. */
  payerName: string
  /** The contact behind `payerName`. The one-payer rule on Create Invoice reads this. */
  payerContactId: string
  dueDate: string
  status: ReceivableStatus
  /** The billing description. Empty on a line nobody has described. */
  description: string
  amount: number
  /** Sum of the deposit allocations that landed here — see below. */
  deposits: number
  /** Always 0. Kept as a column on purpose — see below. */
  otherCredits: number
  /** What is still owed. Never negative: an over-credited line owes nothing. */
  openDue: number

  // --- Facets, carried from the deal so the filter predicate reads one flat
  // object rather than walking back to the store for every test.
  dealStage: PropertyStatus
  dealType: DealType
  propertyType: PropertyType | null
  /** Internal broker names — what the Brokers facet matches against. */
  brokerNames: string[]
  /** Lower-cased haystack: payer, voucher, invoice names, description, amounts. */
  searchText: string
}

/** Money is counted in cents, so no float tail leaks into a total. */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * A broker's face, borrowed from the staff roster by name.
 *
 * `DealBroker` carries no avatar of its own. Rather than invent one, the name is
 * matched against the people the company already has photos for; everyone else
 * renders initials, which is most of the seeded book and matches the grey
 * placeholder faces in the reference design.
 */
export function brokerFace(name: string): ReceivableBroker {
  const roster = [CURRENT_USER, ...TEAMMATES]
  const match = roster.find(
    (t) => t.name.toLowerCase() === name.trim().toLowerCase(),
  )
  if (match) {
    return { name, initials: match.initials, avatarUrl: match.avatarUrl }
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
  return { name, initials: initials || '?' }
}

/**
 * Where one receivable stands, as of `today`.
 *
 * Settled beats late: a line paid after its due date reads Fully Paid, not
 * Overdue, because the badge answers "does anyone still owe this" and the
 * answer is no.
 *
 * `today` is `yyyy-mm-dd`, compared as a plain string — the shape due dates are
 * stored in sorts chronologically, so nothing here parses a Date and no timezone
 * can shift a boundary date into the wrong day.
 */
export function receivableStatus(
  openDue: number,
  dueDate: string,
  today: string,
): ReceivableStatus {
  if (openDue <= 0) return 'Fully Paid'
  return dueDate < today ? 'Overdue' : 'Open'
}

/** `yyyy-mm-dd` in local time — the shape due dates are stored in. */
export function isoDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * What has actually landed on one receivable.
 *
 * The deposit allocations, summed — NOT `receivable.credited`, which is the
 * stored running total. The two are held in agreement by `deposits.test.ts` and
 * the seed test, and this column has to match the deposit rows a broker can see
 * under the same line on the Financials tab. Summing the allocations is the
 * reading that stays honest if the two ever drift, because it is the one a
 * broker can check by eye.
 */
function depositsLanded(deal: Listing, receivableId: string): number {
  const rows = depositsForReceivable(
    deal.transaction.backOffice.deposits,
    receivableId,
  )
  return toCents(rows.reduce((sum, d) => sum + d.amount, 0))
}

/** How many of the deal's invoices carry a line billing this receivable. */
function invoicesBilling(deal: Listing, receivableId: string): number {
  return (deal.invoices ?? []).filter((invoice) =>
    invoice.lineItems.some((line) => line.receivableId === receivableId),
  ).length
}

/**
 * How this receivable addresses its payer.
 *
 * Not `receivablePayerLabel`, which appends "(email)" so a picker can tell two
 * same-named contacts apart. A table column has no room for that, and the
 * Payer cell is read down, where a repeated email is noise.
 */
function payerName(r: FinancialReceivable): string {
  const party = voucherParty(r.payerContactId)
  if (r.billToCompany && party.company) return party.company
  return party.name
}

/**
 * Every receivable in the book, one row each.
 *
 * A lease **shell** contributes nothing. `voucherHref` owns the "does this deal
 * have a voucher" question — a shell keeps the `backOffice` record it had before
 * it was split, and listing its receivables would bill money its own suites are
 * already billing.
 *
 * Sorted by due date, oldest first, so the overdue work is at the top where a
 * collections screen wants it. The voucher name breaks a tie, so the table
 * cannot reshuffle itself on an unrelated deal edit.
 */
export function allReceivables(now: Date): ReceivableRow[] {
  const today = isoDay(now)

  return [...getStore().listings.values()]
    .flatMap((deal) => {
      const target = voucherHref(deal)
      if (!target) return []
      const voucher = deal.transaction.backOffice
      const property = getProperty(deal.propertyId)
      const brokers = deal.internalBrokers.map((b) => brokerFace(b.name))
      const invoiceNames = (deal.invoices ?? []).map((i) => i.name)

      return voucher.receivables.map((r): ReceivableRow => {
        const deposits = depositsLanded(deal, r.id)
        const otherCredits = 0
        const openDue = Math.max(0, toCents(r.amount - deposits - otherCredits))
        const payer = payerName(r)

        return {
          key: `${deal.id}:${r.id}`,
          dealId: deal.id,
          receivableId: r.id,
          voucherName: voucher.name,
          target,
          brokers,
          invoiceCount: invoicesBilling(deal, r.id),
          payerName: payer,
          payerContactId: r.payerContactId,
          dueDate: r.dueDate,
          status: receivableStatus(openDue, r.dueDate, today),
          description: r.billingDescription,
          amount: r.amount,
          deposits,
          otherCredits,
          openDue,
          dealStage: deal.status,
          dealType: deal.dealType,
          propertyType: property?.propertyType ?? null,
          brokerNames: deal.internalBrokers.map((b) => b.name),
          // Amounts go in unformatted as well as the way the cell shows them,
          // so "25000" and "25,000.00" both find the same row. The placeholder
          // promises amount due, and a search bar that ignores what its own
          // placeholder offers is worse than a narrower promise.
          searchText: [
            payer,
            voucher.name,
            deal.name,
            r.billingDescription,
            ...invoiceNames,
            String(r.amount),
            r.amount.toFixed(2),
            String(openDue),
            openDue.toFixed(2),
          ]
            .join(' ')
            .toLowerCase(),
        }
      })
    })
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.voucherName.localeCompare(b.voucherName, 'en', { numeric: true }),
    )
}

export interface ReceivableTotals {
  count: number
  amount: number
  deposits: number
  otherCredits: number
  openDue: number
}

/**
 * The table's TOTAL row.
 *
 * Takes the rows rather than reading the store, so it can foot the FILTERED set
 * the table is actually showing — a total describing the whole book above a
 * filtered table would misreport.
 */
export function receivableTotals(rows: ReceivableRow[]): ReceivableTotals {
  return rows.reduce<ReceivableTotals>(
    (total, row) => ({
      count: total.count + 1,
      amount: toCents(total.amount + row.amount),
      deposits: toCents(total.deposits + row.deposits),
      otherCredits: toCents(total.otherCredits + row.otherCredits),
      openDue: toCents(total.openDue + row.openDue),
    }),
    { count: 0, amount: 0, deposits: 0, otherCredits: 0, openDue: 0 },
  )
}

/** How finely the chart buckets a year. */
export type ChartGrain = 'monthly' | 'quarterly'

export const CHART_GRAINS: { value: ChartGrain; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
]

export interface ReceivableBucket {
  /** `Jan '26` or `Q1 '26` — the axis tick. */
  label: string
  /** Everything billed in this bucket, the four series summed. */
  total: number
  deposits: number
  otherCredits: number
  /** Outstanding on lines not yet due. */
  open: number
  /** Outstanding on lines past their date. */
  overdue: number
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
 * The chart's bars, bucketed by **due date**.
 *
 * By due date and not by when money arrived: the chart is a collections
 * calendar — "what is owed to us in June" — which is the question the page's
 * subtitle asks.
 *
 * The four series split each row's money rather than double-counting it: what
 * landed goes to `deposits`, and what is still outstanding goes to `open` or
 * `overdue` by the row's own status. So a bar's height is the amount billed
 * that month, and the stack reads as how much of it has been collected.
 *
 * Every bucket in the year is present even when nothing lands in it, so the
 * axis stays a full twelve (or four) wide and a quiet month reads `$0` rather
 * than vanishing and shifting its neighbours.
 */
export function receivableBuckets(
  rows: ReceivableRow[],
  { year, grain }: { year: number; grain: ChartGrain },
): ReceivableBucket[] {
  const size = grain === 'monthly' ? 12 : 4
  const yy = String(year).slice(-2)
  const buckets: ReceivableBucket[] = Array.from({ length: size }, (_, i) => ({
    label:
      grain === 'monthly' ? `${MONTH_NAMES[i]} '${yy}` : `Q${i + 1} '${yy}`,
    total: 0,
    deposits: 0,
    otherCredits: 0,
    open: 0,
    overdue: 0,
  }))

  for (const row of rows) {
    // Sliced, not parsed: `yyyy-mm-dd` carries its own year and month, and
    // `new Date('2026-06-08')` is parsed as UTC, which lands on June 7th for
    // anyone west of Greenwich.
    if (row.dueDate.slice(0, 4) !== String(year)) continue
    const month = Number(row.dueDate.slice(5, 7)) - 1
    const bucket = buckets[grain === 'monthly' ? month : Math.floor(month / 3)]
    if (!bucket) continue

    bucket.deposits = toCents(bucket.deposits + row.deposits)
    bucket.otherCredits = toCents(bucket.otherCredits + row.otherCredits)
    if (row.status === 'Overdue') {
      bucket.overdue = toCents(bucket.overdue + row.openDue)
    } else {
      bucket.open = toCents(bucket.open + row.openDue)
    }
    bucket.total = toCents(bucket.total + row.amount)
  }

  return buckets
}

/**
 * The years the year dropdown offers: every year a receivable is due in, newest
 * first, with the current year always present.
 *
 * Derived from the rows rather than a fixed range, for the reason the Vouchers
 * toolbar builds its broker list from the book — an option nothing matches is a
 * dead end. The current year is forced in so the default is always selectable
 * on a book with nothing due this year.
 */
export function receivableYears(rows: ReceivableRow[], now: Date): number[] {
  const years = new Set(rows.map((r) => Number(r.dueDate.slice(0, 4))))
  years.add(now.getFullYear())
  return [...years].sort((a, b) => b - a)
}

/**
 * Why this selection cannot be invoiced, or null when it can be.
 *
 * `createInvoiceFromReceivables` takes ONE deal id and refuses a selection
 * spanning two payers, so a mixed selection cannot produce an invoice at all.
 * Stating the rule up front is what lets the button grey rather than letting a
 * click fail silently — and it returns the sentence the tooltip shows, because
 * a dead button with no explanation is the worst of both.
 */
export function invoiceSelectionBlock(rows: ReceivableRow[]): string | null {
  if (rows.length === 0) return 'Select a receivable to invoice.'
  if (new Set(rows.map((r) => r.dealId)).size > 1) {
    return 'An invoice covers one deal. Select rows from a single voucher.'
  }
  if (new Set(rows.map((r) => r.payerContactId)).size > 1) {
    return 'An invoice bills one party. Select rows with the same payer.'
  }
  return null
}
