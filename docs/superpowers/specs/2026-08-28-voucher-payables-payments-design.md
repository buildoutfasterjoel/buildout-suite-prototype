# Voucher Payables & Payments — design

Money going *out* of the brokerage on a settled voucher: what each broker is
owed, and the cheques written against it.

This fills a hole three places in the codebase already promise:

- `DealFinancials.tsx` — the `Payables` section renders "Payables will be
  automatically created when deposits are applied to this deal."
- `ApplyDepositModal.tsx` — the "We will:" alert lists "Create payables for
  brokers".
- `reportCatalog.ts` — a `Payables Report` card, "Track open payables, money
  that's due to be paid out to brokers."

`deposits.ts` and `types.ts` both carry a note saying the arithmetic was left
unwritten on purpose, because writing it ahead of the record's shape would be
guessing. This spec decides the shape.

## The rules, in one place

1. **A payable belongs to a broker** — internal or outside. Nobody else is paid
   from this table.
2. **A payable is created by a deposit.** It is never filed by hand. Its amount
   is that broker's share of the money that actually arrived.
3. **Payables exist only on an Approved voucher.** A deposit applied to a Draft
   or Pending voucher stores nothing. Approving the voucher back-fills payables
   for every deposit already on it.
4. **A payment is one cheque against one payable.** Partial payments are
   allowed; a payable can carry several.
5. **Gross is what the deal owes the broker. Net is what the broker takes
   home** — gross times their own split, less whatever came off that payment.

## 1. The records

Three new types in `types.ts`, plus one optional field on `DealFinancials`.

```ts
export interface DealFinancials {
  // …existing fields
  /**
   * What the brokerage owes its brokers, created when a deposit lands on an
   * Approved voucher. Optional the same way `deposits` is, so a voucher
   * written before payables existed still parses.
   */
  payables?: VoucherPayable[]
}

/** One deduction taken off a single payment — a hold-back, a fee, an advance. */
export interface PaymentDeduction {
  id: string
  description: string
  amount: number
}

/** One cheque written against a payable. */
export interface VoucherPayment {
  id: string
  /** `yyyy-mm-dd` — the day it was paid. */
  date: string
  /** The gross this payment settles. Never more than the payable's balance. */
  grossAmount: number
  /** Taken off after the broker's split. Empty on most payments. */
  deductions: PaymentDeduction[]
  createdAt: string
  /** A `TEAMMATES` id — resolve it with `findTeammate`. */
  createdById: string
}

/** Money the brokerage owes one broker, raised by one deposit. */
export interface VoucherPayable {
  id: string
  /** A `DealBroker.id` — found on `internalBrokers` or `outsideBrokers`. */
  brokerId: string
  /** The `VoucherDeposit.id` that raised it. */
  depositId: string
  /** `yyyy-mm-dd` — the date of that deposit, not the day the row was written. */
  date: string
  /** This broker's share of what that deposit brought in. */
  grossAmount: number
  /** Cheques written against it, oldest first. */
  payments: VoucherPayment[]
}
```

### Why a `brokerId` and not a copy of the name

The same rule `FinancialReceivable.payerContactId` and
`VoucherApproval.reviewerId` already follow: store the reference, resolve the
display fields at render. Correcting a broker's name corrects it on every
payable that pays them.

The usual objection — a deleted broker orphans the payable — cannot happen
here. Both broker tables are Draft-only editable, and payables only exist on an
Approved voucher, so no broker can be removed out from under one.

### Why payments nest inside the payable

A deposit is flat on the voucher with a `receivableAllocations` array because
one cash receipt is spread across many receivables. A payment has nothing to
spread: it is one cheque to one broker against one payable, which is why the
Create Payment modal shows a single Balance and a single "Estimated Total Due
to …" line. An allocation array here would be a one-element array on every row.

### Why one payable per deposit, not one per broker

Two deposits on a voucher raise two payables for the same broker, which is what
the reference design shows — six rows, two groups of three, each group's
figures scaled to its own deposit. This matters because a payable is a claim on
money that *arrived*: rolling both into one running total would lose which
deposit funded which part of it, and deleting a deposit could no longer put
back exactly what it added.

## 2. The money — `src/data/payables.ts`

A new module, pure the same way `deposits.ts` is: no store reads, no clock, no
ids generated in it. The seed calls into it while `generateDataset` is still
building the store, so a single `useDataStore` read would throw
(see `reference-seed-cannot-read-store`).

```ts
/** This broker's share of one deposit. */
export function payableShare({
  broker, depositAmount, allReceivables,
}: {
  broker: DealBroker
  depositAmount: number
  allReceivables: FinancialReceivable[]
}): number
```

**Proportional to the deposit, against the whole voucher.**

```
share = broker.grossCommission x (deposit.amount / total receivable amount)
```

The denominator is *every* receivable on the voucher, not the ones this deposit
happened to touch. This is the identical rule `previewDeposit` uses for
deduction coverage, and for the identical reason: a voucher paid in two parts,
each deposit against one of two receivables, would otherwise hand the broker a
full share twice over.

A voucher with nothing billed has no denominator; its payables read `$0.00`
rather than dividing by zero.

The rest of the module:

```ts
/** Gross x the broker's own split, less this payment's deductions. */
export function paymentNet(payment: VoucherPayment, broker: DealBroker): number

/** Sum of a payable's payment gross amounts. */
export function payableGrossPaid(payable: VoucherPayable): number

/** Sum of a payable's payment nets. */
export function payableNetPaid(payable, broker): number

/** Gross minus gross paid. Never negative. */
export function payableBalance(payable: VoucherPayable): number

/** Every payable one deposit would raise, in broker order. */
export function payablesForDeposit({ deposit, brokers, allReceivables }): Omit<VoucherPayable, 'id'>[]
```

### Gross and net, settled

`paymentNet` is:

```
net = grossAmount x (broker.personalSplitPct ?? 100) / 100 - sum(deductions)
```

An outside broker carries no `personalSplitPct`, so their net is their gross
before deductions — which is why the reference modal's "Estimated Total Due to
Outside Broker Co." reads the full `$2,777.78` unchanged.

The table's `Net Paid` column is the sum of these. The Create Payment modal's
footer line is this same figure for the payment being written.

### A pre-existing quirk this does not fix

The seed gives the internal broker 100% of the net commission *and* the outside
broker 40–60% of the gross (`seed.ts:1355`). Their shares already overlap, so
on a deal carrying both, the payables will sum to more than came in. Correcting
the split math would move figures on every seeded deal and on the pipeline
forecast. Payables use each broker's stored `grossCommission` as-is and leave
the quirk where it is.

## 3. When a payable appears — `actions.ts`

### `applyDeposit`

Extended, not rewritten. After it has clamped the allocations and appended the
deposit, it raises payables **only when `back.status === 'Approved'`**. On a
Draft voucher it stores the deposit and nothing else, and the Payables section
keeps the note it renders today.

The deposit's own amount is what feeds `payableShare` — the cash that arrived,
not the sum of the allocations, which may be less when a deposit over-pays.

### `deleteDeposit`

Drops the payables the deposit raised, matched on `depositId`. This is the same
principle already written into `deleteDeposit`'s own comment — a deposit comes
off whole, putting back everything it moved.

**A payable with payments against it is still deleted.** The alternative — keep
an orphan payable whose funding deposit is gone — is a row that claims the
brokerage owes money it never received. The Delete confirmation says how many
payments go with it, so nobody loses a recorded cheque without being told.

### `approveVoucher` (new)

```ts
export function approveVoucher(dealId: string, reviewerId: string): { deal: Listing | null }
```

Pending only — the mirror of `reopenVoucher`'s Pending-only rule. Sets
`status: 'Approved'`, writes the `VoucherApproval`, and back-fills payables by
running `payablesForDeposit` over every deposit already on the voucher.

`approvedOn` is today's date. `DealFinancials`' invariant — `approval` non-null
exactly when `status` is `'Approved'` — holds by construction, the same way
`reopenVoucher` keeps it.

Back-fill is idempotent by `depositId`: a deposit that already raised payables
raises none. Nothing can call this twice today (Pending-only), but the guard
costs one `Set` and makes the function safe to reuse from a future approver
flow.

### `recordPayment` / `deletePayment` (new)

```ts
export function recordPayment(dealId, payableId, input: {
  date: string
  grossAmount: number
  deductions: { description: string; amount: number }[]
}): { deal: Listing | null; paymentId: string | null }

export function deletePayment(dealId, payableId, paymentId): { deal: Listing | null }
```

`recordPayment` clamps `grossAmount` to the payable's balance read from the
store, not from the caller's copy — the same defence `applyDeposit` applies to
its allocations. A payment that lands on zero is refused rather than stored.
Deductions with no description or a zero amount are dropped.

Both refuse on anything but an Approved voucher, since that is the only status
that has payables at all.

## 4. UI

### A new file

`src/components/deals/VoucherPayables.tsx` holds the section, its rows, and its
row menu. `src/components/deals/CreatePaymentModal.tsx` holds the dialog.

`DealFinancials.tsx` is 2,860 lines. This section plus its modal would push it
past 3,200, and the payables table shares nothing with the receivables table
above it beyond the `Section` wrapper. `DealFinancials` imports
`<PayablesSection listing={listing} />` and the empty-state note it renders
today moves into that component.

### The table

Columns, matching the reference:

| Column | Content |
|---|---|
| Pay To | Broker name. Plain text — neither an internal nor an outside broker has a resolvable contact record, so `PersonLink` has nothing to link to. |
| Date | The funding deposit's date, `formatDate`. |
| Commission Plan | The broker's plan. An info icon on internal brokers only, tooltipped with their own split. |
| Gross Amount | `payable.grossAmount`, right-aligned. |
| Gross Paid | `payableGrossPaid`, right-aligned. |
| Net Paid | `payableNetPaid`, right-aligned. |
| *(actions)* | **Pay** — a link-styled button, hidden once the balance is zero. |

A footer Total row on the three money columns. Per CLAUDE.md's repeater rule, a
column carrying a total is read downward at any row count, so this is a table
rather than a card per row — and the reference design agrees.

**Payments render as child rows** under the payable they settle, the way
`DepositRow` does under its receivable: a row in the parent grid, not a nested
table, so the figures stay under the columns they belong to. A child row shows
`↳ Payment`, its date, its deductions summarised under Commission Plan
(`"2 deductions"`, or the single description when there is one, or nothing when
there are none), its gross under Gross Paid, its net under Net Paid, and a
trash button. Gross Amount stays empty on a child row — a payment has no billed
amount, the same reason a `DepositRow` leaves Receivable Amount blank.

### The Commission Plan tooltip

Every internal broker's `personalSplitPct` stays at `DEFAULT_PERSONAL_SPLIT_PCT`
(55) — the seed comment is explicit that one flat rate keeps the "You" pipeline
forecast predictable across the demo. So the plan *name* varies and the split
does not, and a tooltip claiming "the House Split Plan pays 50%" would be a lie.

The tooltip states the broker's own figure instead, which is true and is the
thing the reader wants: **"Nikos Buse keeps 55% of their gross commission under
this plan."** Outside brokers show "No Plan" with no icon — they have no plan
and no split.

### Create Payment modal

Per the reference:

- **Date** — required, a Blueprint `Calendar` (per `feedback-form-modal-quality`),
  pre-set to today.
- **Balance** — read-only, the payable's outstanding gross.
- **Gross Amount** — required, pre-filled to the balance. Typing more than the
  balance is clamped at save.
- **Deductions** — an "Add a deduction" repeater, description + amount per row,
  with a remove button. Stacked flex, not a table: two fields per row and
  usually zero rows, which is `AdditionalTypesEditor`'s case exactly, and
  nothing here is read down a column.
- **Estimated Total Due to {broker}** — the running `paymentNet`, above the
  footer.
- Save disabled until date and a non-zero gross amount are both present.

### The Approve button

On the voucher header, Pending only. Draft keeps `AttestationSubmit`; Approved
keeps the `VoucherApprovalBanner` it has.

It opens a small confirm dialog rather than approving on click, because
`approveVoucher` needs a reviewer and the current user cannot be one.
`CURRENT_USER` is a Broker, and `VOUCHER_APPROVER_IDS` is explicit that the
broker who closed the deal is the one person who must not approve it. The
dialog carries an **Approver** select over `VOUCHER_APPROVER_IDS` (defaulting to
the first), and says what approving does: it is final, and it will raise
payables for the deposits already on the voucher.

This is the smallest honest version of an approver action. The full approver
persona — an inbox, a rejection path, `reopenVoucher` finally wired up — stays
in its own backlog pass.

## 5. Seed

### Commission plans

Internal brokers get one of the three named plans in `COMMISSION_PLANS`
(`Standard Commission Plan`, `Custom Plan`, `House Split Plan`) instead of
`'No Plan'`, so the column carries information.

**Hashed from the broker's id, not drawn from faker.** A `faker.helpers`
call inside `generateBroker` would move the shared stream and shift every
property, contact and deal generated after it — the same reason
`generateDepositReference` and `isQuickbooksSynced` are hashes.

`personalSplitPct` does not move. `commissionPlan` is display-only everywhere it
is read (`DealFinancials.tsx:547`), so this changes a label and no money.

Outside brokers keep `commissionPlan: undefined`, rendering "No Plan".

### Payables

Back-filled on Approved vouchers only, from the deposits the seed already
builds, through the same `payablesForDeposit` the actions use. Placed directly
after the existing deposits block, and faker-free for the same reason that
block is.

### Payments

Some payables carry one partial payment, so `Gross Paid` and `Net Paid` are not
`$0.00` down the whole column — the same reasoning the deposits block gives for
seeding `credited`. A column of zeros cannot show what Net Paid means or that
the two differ.

Deterministic throughout: a payable pays roughly half its gross when its id
hashes even, nothing when it hashes odd, and every seeded id is spelled from
its parent (`payable-${deposit.id}-${broker.id}`, `payment-${payable.id}`) the
way `deposit-${receivable.id}` already is. No faker, no clock, so a reseed
produces the same rows. A few carry one deduction so the child row's deduction
summary has something to render.

`SEED_VERSION` moves — `reference-indexeddb-masks-seed-edits` means the browser
shows stale data otherwise.

## 6. Tests

- **`payables.test.ts`** — `payableShare`'s proportional rule, including the
  two-deposit case that the whole-voucher denominator exists to protect;
  `paymentNet` with and without a `personalSplitPct` and with deductions;
  `payableBalance`'s floor at zero; `payablesForDeposit` over a mixed
  internal/outside broker list.
- **`actions.test.ts`** — `applyDeposit` raises payables on Approved and none on
  Draft; `approveVoucher` back-fills and is idempotent; `approveVoucher` refuses
  on Draft and Approved; `deleteDeposit` removes the payables it raised;
  `recordPayment` clamps to the balance and refuses a zero; `deletePayment` puts
  the totals back.
- **`seed.test.ts`** — payables exist on a voucher **iff** its status is
  `Approved`; every payable's `brokerId` resolves against the deal's broker
  lists; every payable's `depositId` resolves against the voucher's deposits;
  gross paid never exceeds gross.

## 7. Out of scope

- Wiring the `Payables Report` card in `reportCatalog.ts` to real data.
- Payables on the back-office vouchers list or its KPI band.
- The full approver persona — an approval inbox, a rejection path, wiring
  `reopenVoucher`.
- Editing a payable's amount. It is a consequence of a deposit, not a record
  someone files, so it has no edit and no delete of its own.
- QuickBooks sync badges on payables.

## 8. What changes

| File | Change |
|---|---|
| `src/data/types.ts` | `PaymentDeduction`, `VoucherPayment`, `VoucherPayable`; `DealFinancials.payables?` |
| `src/data/payables.ts` | **new** — the pure money module |
| `src/data/payables.test.ts` | **new** |
| `src/data/actions.ts` | `applyDeposit` raises payables; `deleteDeposit` drops them; `approveVoucher`, `recordPayment`, `deletePayment` |
| `src/data/actions.test.ts` | the cases above |
| `src/data/vouchers.ts` | `commissionPlanFor` hash helper |
| `src/data/seed.ts` | broker plans; payables + payments blocks; `SEED_VERSION` |
| `src/data/seed.test.ts` | the invariants above |
| `src/components/deals/VoucherPayables.tsx` | **new** — section, rows, row actions |
| `src/components/deals/CreatePaymentModal.tsx` | **new** |
| `src/components/deals/ApproveVoucherModal.tsx` | **new** |
| `src/components/deals/DealFinancials.tsx` | swap the placeholder section for `<PayablesSection>`; Approve button on Pending |
| `src/components/deals/ApplyDepositModal.tsx` | the "Create payables for brokers" bullet becomes true — reword it to say it happens on an approved voucher |
