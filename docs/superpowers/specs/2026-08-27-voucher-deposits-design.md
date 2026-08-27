# Voucher Deposits — Design

Branch `joel/voucher-deposits`, 2026-08-27.

Payments landing against the receivables a voucher already billed. A broker or
back-office admin enters one cash receipt — a date, an amount, a reference
number — and it is spread across the receivables they selected, and across the
voucher's pre-split deductions.

Deposits only. **Payables are out of scope** and stay the promise the Payables
section already makes on the voucher page.

## What already exists

- `Apply Deposit` sits in both receivable menus, greyed as unbuilt
  (`DealFinancials.tsx:1322` on the row, `:1457` in the toolbar).
- `FinancialReceivable.credited` is a stored number, read-only in its cell.
  A deposit is the thing that moves it.
- `FinancialDeduction.covered` is the deduction's equivalent of `credited`,
  already editable by hand in the Pre-Split Deductions table.
- The Payables section says *"Payables will be automatically created when
  deposits are applied to this deal."* Nothing creates them, and this pass does
  not change that.

## The allocation rule

One rule covers both tables, taken from the reference design:

```
applied = depositAmount x (line amount / total receivable amount)
```

Verified against the reference figures — deposit $5,555.55 against $288,600 of
receivables gives the $10,000 marketing deduction $192.49, and the $144,300
outside-broker payable $2,777.78.

Two clarifications the reference design could not distinguish, because in it
nothing was credited yet and every receivable was selected:

- **Receivables are filled oldest first, not pro-rata.** The deposit fills each
  selected receivable up to its outstanding balance, in due-date order, until it
  runs out. Rows past the point it ran out show $0.00 and stay visible.
- **The deduction base is the whole voucher, not the selection.** A deduction is
  a claim on the entire commission. Basing its share on the selected rows would
  over-cover it when a voucher is paid in parts — two deposits, each against one
  of two receivables, would each hand the deduction a full-voucher share.

Both are capped: a receivable cannot take more than its outstanding balance, and
a deduction cannot be covered past its own amount.

## Scope is the selection

The entry point decides what the deposit touches.

| Opened from | Receivables in the preview |
|---|---|
| A row's own menu | That one row |
| The toolbar Actions menu | Every selected row, due-date order |

The row item takes the same live gate the toolbar item already has — greyed once
`credited >= amount`, because a settled line has nothing left to receive. That
replaces its unconditional grey.

## Data

`DealFinancials.deposits: VoucherDeposit[]`, new in `types.ts`:

```ts
interface DepositAllocation {
  /** A `FinancialReceivable.id` or a `FinancialDeduction.id`. */
  targetId: string
  amount: number
}

interface VoucherDeposit {
  id: string
  /** `yyyy-mm-dd` — the date the money landed, not when the row was typed. */
  date: string
  /** Cash received, before it is spread. */
  amount: number
  referenceNumber: string
  createdAt: string
  createdById: string
  receivableAllocations: DepositAllocation[]
  deductionAllocations: DepositAllocation[]
}
```

### `credited` stays stored

Applying a deposit adds to `FinancialReceivable.credited` and to
`FinancialDeduction.covered` rather than either being derived from the deposit
list.

Deriving was considered and rejected. `credited` is read by `invoices.ts` (which
*freezes* it onto an invoice line as `amountPaid`), by `vouchers.ts` totals, by
the AI tools' `outstanding`, by the receivables footer and by six tests.
Replacing it with a computed sum rewrites all of them and changes nothing on
screen. A Vitest test asserts the stored total and the deposit ledger agree, so
the redundancy cannot drift silently.

### Seed

Every receivable the seed credits gets a deposit behind it, so a paid row
expands to a real child table instead of an empty one. The seed's existing
variants — settled / part-paid / untouched — become one deposit, one deposit,
and none. Deductions stay `covered: null`; the seeded deposits allocate to
receivables only, so the Pre-Split Deductions table keeps its current reading.

`SEED_VERSION` moves 54 -> 55.

`leaseSpaceFixtures.ts` stays faker-free and gets no deposits — its receivables
are all `credited: 0`.

## Modules

### `src/data/deposits.ts` — pure, no store reads

Same discipline as `invoices.ts`. One entry point:

```ts
function previewDeposit(input: {
  amount: number
  /** The receivables the deposit may touch, in any order. */
  selected: FinancialReceivable[]
  /** Every receivable on the voucher — the deduction base. */
  allReceivables: FinancialReceivable[]
  deductions: FinancialDeduction[]
}): DepositPreview
```

Returns a line per selected receivable and a line per deduction, each carrying
its balance and its applied amount, plus `unapplied` — the cash the selection
could not absorb.

### `src/components/deals/ApplyDepositModal.tsx`

Blueprint `Modal`, built the way `NewReceivableModal` is: `Field` labels, the
shared `DueDatePicker` for the date, `InputGroup` + `$` addon for the amount.

- Deposit Date (defaults to today), Deposit Amount, Reference Number.
- A `We will:` note — "Apply voucher deductions" and "Create payables for
  brokers". The second is not yet true of the data, and is kept because the
  Payables section on the same page already states it.
- **Deposit Application Preview**: a Receivables table and a Deductions table,
  each `Date/Category | Balance | Applied Amount`. **No New Payables table** —
  omitted until payables are a record.
- Empty state, before an amount is entered: "Enter an amount and date to see how
  the deposit will be applied."
- **Override** off: Applied Amount is read-only text. On: each becomes a money
  input. Save writes what is on screen, so an overridden allocation is stored as
  entered and is not recomputed.

Under roughly six fields plus two preview tables — this is a modal, so it uses
plain stacked Blueprint `Field`s, not the record-form shell.

### `applyDeposit` in `src/data/actions.ts`

Takes the deal id and the allocation the modal is showing, so an override is
stored as the admin left it. Re-checks the caps at the write path the way
`createInvoiceFromReceivables` re-checks its one-payer rule, and returns null
rather than throwing.

## The child table

Deposits render as extra rows inside the receivables table, indented under the
receivable they paid, rather than as a nested table.

| gutter | Payer | Due Date | Billing Description | Amount | Credited |
|---|---|---|---|---|---|
| | `↳ Deposit` | Aug 27, 2026 | Ref 123 | | $5,555.55 |

The receivables table pins `table-layout: fixed` with per-column widths
(`RECEIVABLE_COL`), so a nested table would have its own column widths and the
figures would not line up under the columns they belong to. Rows in the parent's
own grid put each number where it is read.

Always visible, not collapsible: a voucher carries a handful of deposits, and a
disclosure that hides one row costs more than it saves.

## Testing

- Vitest on `deposits.ts`: oldest-first fill, the balance cap, the deduction
  share and its cap, the whole-voucher deduction base, and `unapplied`.
- Vitest on `applyDeposit`: `credited` and `covered` move, an override is stored
  verbatim, a Pending voucher refuses.
- Vitest on the seed: stored `credited` equals the sum of that receivable's
  deposit allocations.
- Playwright: both entry points open the modal, the preview fills as an amount
  is typed, Save closes it and the child rows render under the right receivable.

## Deliberately out of scope

- **Payables.** No type, no seed, no table. The Payables section keeps its
  placeholder and the modal keeps its promise line.
- **Deleting or editing a deposit.** The child rows carry no actions menu.
- **Voucher status rules.** Deposits follow the receivables section's existing
  `editable={!isPending}` gate. Tightening deposits to Approved-only belongs to
  the deferred read-only pass, which is Joel's own task.
