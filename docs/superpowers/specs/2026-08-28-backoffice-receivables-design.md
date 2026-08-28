# Back Office Receivables index — design

A book-wide list of every receivable, with its collection status. It fills the
dead `/backoffice/receivables` link and sits beside the Vouchers index as its
sibling: same header band, same card, same table frame, same pagination — a
stacked bar chart where Vouchers has its three commission tiles.

Vouchers answers "what is the state of this deal's settlement". Receivables
answers the narrower money question underneath it: **what has been billed, what
has landed, and what is late**.

## Route and navigation

`src/routes/_shell/backoffice/receivables/index.tsx` → `/backoffice/receivables`.

`navSections.ts:63` gains a second Back Office item under Vouchers:

```ts
items: [
  { label: 'Vouchers', href: '/backoffice/vouchers' },
  { label: 'Receivables', href: '/backoffice/receivables' },
],
```

`NAV_SECTIONS` is read by both `GlobalNavbar` and the side-nav, so one edit
serves both. `src/features/components/AppNavbar.tsx` also lists a "My
Receivables" item, but nothing imports that file — it is dead, and this pass
leaves it alone rather than quietly reviving a second nav.

No card on `src/routes/index.tsx`. The Vouchers index has none either; Back
Office pages are reached from the nav, and a directory card for one of a pair
would be worse than none for both.

## Row model — `src/data/receivables.ts`

One row per receivable, flattened across the book.

```ts
export interface ReceivableRow {
  /** `${dealId}:${receivableId}` — unique across the book, which a bare receivable id is not. */
  key: string
  dealId: string
  receivableId: string
  /** The voucher's own name, and where the row links. */
  voucherName: string
  target: VoucherTarget
  /** The deal's internal brokers, for the avatar stack. */
  brokers: ReceivableBroker[]
  /** How many of the deal's invoices bill THIS receivable. */
  invoiceCount: number
  /** The payer as the row addresses them — the company when `billToCompany`. */
  payerName: string
  dueDate: string
  status: ReceivableStatus
  description: string
  amount: number
  /** Sum of the deposit allocations that landed on this receivable. */
  deposits: number
  /** Always 0 — see "Other Credits" below. */
  otherCredits: number
  /** `amount - deposits - otherCredits`, floored at 0. */
  openDue: number

  // Filter facets, carried from the deal so the predicate reads one flat object.
  dealStage: PropertyStatus
  dealType: DealType
  propertyType: PropertyType | null
  brokerNames: string[]
  /** Searchable: payer, voucher name, invoice names, description, amounts. */
  searchText: string
}
```

### Which deals contribute

`voucherHref(deal)` decides, exactly as `allVouchers()` does. A lease **shell**
returns null and contributes nothing: it keeps the `backOffice` record it had
before it was split, and listing its receivables would bill money its own suites
are already billing.

### Order

Due date, oldest first; the voucher name breaks a tie so the table cannot
reshuffle on an unrelated edit. Oldest-first puts the overdue work at the top,
which is where a collections screen wants it.

### `deposits`, not `credited`

`FinancialReceivable.credited` is the stored running total, and the Deposits
column must agree with the deposit rows a broker can see on the Financials tab.
So the column sums `depositsForReceivable(voucher.deposits, r.id)` rather than
reading `credited`. The two are held in agreement by `deposits.test.ts` and the
seed test; summing the allocations is the reading that stays honest if they ever
drift, because it is the one a broker can check by eye.

### Status is derived, three words

```ts
export type ReceivableStatus = 'Overdue' | 'Open' | 'Fully Paid'
```

In order:

1. `openDue <= 0` → **Fully Paid**.
2. `dueDate < today` → **Overdue**.
3. otherwise → **Open**.

Settled beats late: a line paid after its due date is Fully Paid, not Overdue,
because the badge answers "does anyone still owe this" and the answer is no.

There is deliberately no **Partially Paid**. A half-credited line that is not yet
due is Open and a half-credited line that is past due is Overdue — in both cases
what the collections screen needs to know is whether to chase it, and a fourth
badge splits that answer without changing it. The Deposits and Open/Due columns
already show the partial.

`today` is injected, never read from the clock inside the derivation, so the
boundary is testable and one render cannot straddle midnight.

### Brokers

```ts
export interface ReceivableBroker {
  name: string
  initials: string
  avatarUrl?: string
}
```

`DealBroker` carries no avatar, so the name is matched against `TEAMMATES` and
the photo borrowed when it hits. A broker with no match renders initials — which
is most of the seeded book, and matches the grey placeholder faces in the
reference design. Internal brokers only; an outside broker is a counterparty, not
someone whose collections queue this is.

### Other Credits

Nothing in the data model credits a receivable except a deposit, so this column
is `0` on every row and its chart series never draws. It is kept, inert, on
purpose — the reference design carries it, the real product has credit types the
prototype has not modelled, and a column that appears later in a different
position is a worse surprise than one that reads `$0.00` now. Same reasoning for
the disabled **All Offices** filter: there is no office on any record here.

Both are the two known-inert controls on this page. Nothing else may join them.

## Totals and the chart — same module

```ts
/** The TOTAL row. Foots the FILTERED rows, so it always agrees with the table. */
export function receivableTotals(rows: ReceivableRow[]): ReceivableTotals

/** Twelve (or four) buckets for the chart, by DUE DATE. */
export function receivableBuckets(
  rows: ReceivableRow[],
  opts: { year: number; grain: 'monthly' | 'quarterly' },
): ReceivableBucket[]
```

A bucket carries `label`, `total`, and the four stacked values — `deposits`,
`otherCredits`, `open`, `overdue`. `open` and `overdue` split the row's
`openDue` by its status, so the four series sum to the row's `amount` and the
stack height is the amount billed in that month. Every bucket in the year is
present even when empty, so the axis stays twelve wide and a quiet month reads
`$0` instead of vanishing.

Bucketed by **due date**, not by when money arrived: the chart is a collections
calendar — "what is owed to us in June" — which is the question the page's
subtitle asks.

The year control narrows the table and the chart together, so the bars always
foot to the rows underneath them. A chart describing a wider set than the table
below it would put two different answers to "how much is owed" on one screen.

## Filters — `src/data/receivableFilters.ts`

React-free, `now` injected, mirroring `voucherFilters.ts` so both are testable in
Vitest's node environment.

```ts
export interface ReceivableFilterState {
  search: string
  grain: 'monthly' | 'quarterly'
  /** The calendar year the chart covers and the rows are limited to. */
  year: number | 'all'
  statuses: Set<ReceivableStatus>
  brokers: Set<string>
  stages: Set<PropertyStatus>
  dealTypes: Set<DealType>
  propertyTypes: Set<PropertyType>
}
```

Resting state: empty search, `monthly`, the current year, no facets chosen.
`countActiveReceivableFilters` ignores `grain` and a `year` still at its default —
badging the page's own resting state on load is noise, the same call
`voucherFilters` makes about its date preset.

`year: 'all'` exists for the same reason `CloseDatePreset` carries `'any'`: a
receivable dated outside every offered year must still be reachable, or the index
has rows nobody can find. With `'all'` chosen the chart falls back to the current
calendar year so the axis stays twelve months wide.

Search covers payer, voucher name, invoice name, billing description, and both
amounts — the placeholder promises payer, voucher, invoice number and amount due,
and a search bar that silently ignores what its own placeholder offers is worse
than a narrower promise.

## The page

Structurally the Vouchers index, and the pieces that already work there are
copied rather than reinvented — the `h-100 d-flex flex-column overflow-hidden`
shell, `minHeight: 0` on every flex ancestor of the scroller, the `Table` as the
one scrolling region, and the centred `Pagination` at 25 rows a page.

**Header band.** Full-bleed, bordered below. Left: an icon, `Receivables` as the
`h1`, and `Track commissions due for collection` beneath it. Right: the
`Displaying N of M` count, then the **Create Invoice** button.

**Chart card.** Its own Card above the table, holding the recharts stacked
`BarChart` — one `Bar` per series, `stackId` shared, the month label and that
month's total as a two-line tick, and a legend below in the four series colours.
`ResponsiveContainer` at a fixed height; the chart does not compete with the
table for vertical room.

**Filter bar** — `src/components/backoffice/ReceivableFilterBar.tsx`, built from
the `FacetDropdown` the Vouchers bar already uses.

**Table.** A checkbox gutter, then Voucher · Brokers · Invoices · Payer · Due
Date · Status · Description · Amount · Deposits · Other Credits · Open / Due —
the last four right-aligned. Under the sticky header, a bold **TOTAL (n)** row
footing the filtered set.

Voucher is the only link in the row, going to that deal's voucher via `target`.
There is no whole-row click, for the reason the Vouchers table gives: a row that
both navigates and holds a link teaches two rules at once.

**Status badge** — a small `ReceivableStatusBadge`, red / blue / green, beside a
`RECEIVABLE_STATUS_COLORS` map the chart's series read too, so a badge and its
bar can never disagree about which colour Overdue is.

## Create Invoice

Checkbox selection is `Set<string>` of row keys, held on the page. The header
button enables only when the selection is non-empty **and** every selected row
shares one `dealId` and one `payerContactId`.

`createInvoiceFromReceivables` already refuses a selection spanning two payers,
and it takes a single `dealId` — so a mixed selection cannot produce an invoice
at all. Greying the button is stating that rule up front rather than letting a
click fail silently; the disabled button carries a tooltip saying which condition
is unmet ("Select rows from one deal" / "Select rows billed to one payer").

On success the selection clears, a toast names the invoice, and the affected
rows' Invoices count goes up on the next store read.

Selection survives paging but not a filter change — a filter change already
resets to page one, and holding a selection of rows the table no longer shows
would arm the button over invisible rows.

## Testing

`src/data/receivables.test.ts`

- shells contribute no rows; a split lease's suites contribute theirs
- the three status boundaries, including due-today and paid-after-due
- `deposits` sums allocations, not `credited`, and one deposit split across two
  receivables lands its own share on each
- `openDue` floors at 0 on an over-credited line
- totals foot the rows handed in
- buckets: twelve present when empty, quarterly grain, a row outside the year
  contributing to none, the four series summing to `amount`

`src/data/receivableFilters.test.ts`

- each facet in isolation and two in combination
- search across all five fields
- `year: 'all'` admits an out-of-range row
- `countActiveReceivableFilters` ignores grain and the default year

Then Playwright: the page loads with no console errors, the chart and table
render, a facet narrows both, and a same-payer selection creates an invoice.

## Not in this pass

- Reading the current user to narrow the page to "my" receivables. The nav label
  becomes plain **Receivables**, and the row rule is the whole book.
- Any credit type other than a deposit.
- An office on any record.
- Sorting by column. The table sorts by due date, oldest first, so the overdue
  work is at the top where a collections screen wants it.
