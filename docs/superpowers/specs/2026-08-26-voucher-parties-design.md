# Voucher parties: Buyer/Tenant and Payers

**Status:** in flight on `joel/voucher-pending-lock`.
Delete this file in a `chore(docs):` commit when the work ships; anything worth
keeping goes in the PR body first.

## What we're adding

Two sections on the voucher page:

- **Buyer** (Sale) / **Tenant** (Lease) — who is acquiring the asset or taking
  the space. Editable on a Draft voucher.
- **Payers** — who is actually billed. A voucher can have several, and every
  receivable is attached to one of them. A payer is often the buyer or tenant
  and is frequently not.

A payer *is a contact*. It carries no fields of its own: name, email, phone and
company all read from the contact record.

## Data model

```ts
// DealFinancials — the voucher record
payerContactIds: string[]        // NEW. The voucher's payers, in the order added.

// FinancialReceivable
payerContactId: string           // REPLACES payerName + payerEmail
```

Buyer/Tenant needs **no new field**. It edits the deal's existing
`buyerContactIds` / `tenantContactIds`, chosen by `dealType`.

`SEED_VERSION` 48 → 49.

### Why a bare contact id, not a `VoucherPayer` object

Everything a payer displays already lives on the contact, so a wrapper would
hold exactly one field. Storing the reference rather than a copy also fixes a
latent bug: a receivable currently stores the payer's *name and email as
strings*, so renaming a contact or fixing their email leaves a stale payer on
every voucher that billed them.

The cost is a dangling reference when a contact is deleted from the store.
Handled the way the codebase already handles it — `getContact` returns
`undefined` and the row renders a muted "Unknown contact" rather than throwing.
A voucher is a record of what was billed; it should not silently lose a row
because someone tidied the contact book.

### The attachment rule

A receivable may only name a payer in `payerContactIds`, and **removing a payer
that has receivables attached is blocked** — the remove button disables with a
tooltip saying how many receivables hold it.

This is what makes "receivables get attached to those payers" a fact rather than
a convention. Without it the payer list is decorative and the two can disagree.

## Sections on the page

Current order is Transaction → Gross Commission Breakdown → Outside Commissions
→ Pre-Split Deductions → Internal Commissions → Rent Schedule → Receivables →
Payables. The two new sections slot in as:

| Position | Section | Why there |
|---|---|---|
| After Transaction | Buyer / Tenant | Party identity — it belongs with who the deal is with, before the money is broken down. |
| Immediately above Receivables | Payers | Receivables attach to payers, so the list has to be readable directly above the table that references it. |

Both use the existing `Section` + `Table` idiom, both take `editable` and follow
the same status rule as everything else on the page: live on a Draft, frozen on
Pending. (Approved keeps its current looser behaviour — see the deliberate
asymmetry documented on `reopenVoucher`.)

**Columns**

- Buyer/Tenant: Name · Company · Email · Phone
- Payers: Name · Company · Email · Phone · **Billed** (that payer's receivables
  summed on `amount` — what they were billed, not net of credits; the Credited
  column is right below in the Receivables table and does not need restating)

Name links to the contact record via the existing `PersonLink`. The Billed
column is why naming a payer is worth doing — it answers what each party is on
the hook for, and it foots to the Receivables table below it.

**Editing** mirrors the broker tables exactly: a ghost "Add …" action in the
section header opens a Combobox modal; each row carries the same trash button.
Picking is from the existing contact book only — creating a contact stays the
contacts page's job.

`getContactOptions()` already returns picker-ready options (`value`, `label` as
"Name · Company", `name`, `company`, `title`, `relationship`), so the modal is a
near-copy of `AddBrokerModal` with a different source list. Contacts already on
the section are filtered out, the way `AddBrokerModal` filters brokers.

## Data flow

The voucher page already holds a **working copy** of its editable tables in
local state, committed by the header's Save (`saveVoucherDraft`). The two new
sections join that copy rather than writing through on each click, so one Save
still commits one coherent draft:

```ts
interface VoucherDraft {
  preSplitDeductions: FinancialDeduction[]
  internalBrokers: DealBroker[]
  partyContactIds: string[]        // NEW — buyer or tenant, per dealType
  payerContactIds: string[]        // NEW
}
```

One `partyContactIds`, not two fields: the page shows exactly one of Buyer or
Tenant, so the draft carries one array and `saveVoucherDraft` writes it to
`buyerContactIds` on a Sale and `tenantContactIds` on a Lease. Two fields would
mean every caller repeating the same `dealType` branch, and would let a draft
carry a tenant list for a Sale deal.

`saveVoucherDraft` already writes `internalBrokers`, which lives on the deal
rather than in `backOffice`, so writing `buyerContactIds`/`tenantContactIds`
there too is the established shape, not a new one. Its Draft-only guard covers
the new fields for free.

### `relatedContactsLabel` must be recomputed

`DealFinancials.relatedContactsLabel` is a denormalized string
("Jane Doe & 2 more") built at seed/create time from seller + buyer names. It
feeds the Back Office vouchers index column and its search, and nothing else.

Making Buyer editable on the voucher makes it drift. `saveVoucherDraft`
recomputes it from the deal's contacts on every write. Deriving it at read time
in `allVouchers()` would be cleaner, but it is also written directly in three
places (`seed.ts` twice, `createListing.ts`) that would all have to be unpicked
— out of proportion to a column nobody has complained about.

## Seed

- Every existing receivable gets `payerContactId` from the contact it was
  already named after, and those contacts populate the voucher's
  `payerContactIds`. No receivable changes who it bills.
- **At least one seeded voucher gets a payer who is not the buyer or tenant**,
  because that is the whole point of the section and an all-defaults seed would
  never show it.
- `leaseSpaceFixtures.ts:465` currently sets `payerName` from
  `relatedContactsLabel` — a display string, not a person. It moves to a real
  tenant contact id. **The fixtures pass stays faker-free**, or the seed tests
  break.

## Testing

Vitest, in the existing files:

- `vouchers.test.ts` — the Billed-per-payer sum; a payer with no receivables
  reads $0, not absent.
- `actions.test.ts` — `saveVoucherDraft` writes both new arrays; its Draft-only
  guard rejects them on Pending and Approved; `relatedContactsLabel` recomputes.
- A guard test for the attachment rule: removing a payer with receivables is
  refused, removing one without is allowed.
- `seed.test.ts` — every receivable's `payerContactId` resolves to a real
  contact, and is in its voucher's `payerContactIds`.

Browser: both sections on a Sale (Buyer) and a Lease (Tenant) deal, add and
remove through the modals, Save, and confirm they freeze on Pending with
everything else.

## Out of scope

- **No Company entity.** Company is `Contact.company`, a free-text string, as
  everywhere else in the app. "Bill Acme Holdings LLC c/o Jane Doe" where Jane's
  contact says she works elsewhere is not expressible, and is not being asked
  for.
- Creating a contact from these modals.
- The Approved-voucher read-only pass, which is Joel's separate task and needs
  the data reworked first.
- `Add Receivable` remains the stub it is today; attaching a receivable to a
  payer at creation time is the next piece of work, not this one.
