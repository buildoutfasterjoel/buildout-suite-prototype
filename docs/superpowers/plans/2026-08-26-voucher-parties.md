# Voucher Parties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Buyer/Tenant section and a Payers section to the voucher page, and make every receivable point at a payer contact instead of holding a copy of that person's name and email.

**Architecture:** A payer is a contact id, not a new record. The voucher stores `payerContactIds`, each receivable stores one `payerContactId`, and every name, company, email and phone is read from the contact at render time. Buyer/Tenant needs no new field — it edits the deal's existing `buyerContactIds` (Sale) or `tenantContactIds` (Lease). Both sections join the voucher's existing local working copy and commit through the one Save button that already exists.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Blueprint React · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-08-26-voucher-parties-design.md`

## Global Constraints

- Package manager is Bun. Run tests with `bun --bun run test`. Type-check with `bunx tsc --noEmit` — `vite build` does **not** type-check.
- All UI uses Blueprint React components imported from the `ui` subpath. Icons are FontAwesome Pro, `pro-regular` by default.
- `src/data/leaseSpaceFixtures.ts` must stay **faker-free**. It seeds fixed values only. The seed tests pin this.
- Any change to seeded data shape must bump `SEED_VERSION` in `src/data/persistence.ts`, or the browser keeps showing stale IndexedDB data.
- A payer is a contact. There is no Company entity — company is `Contact.company`, a plain string.
- Sections on the voucher page take an `editable` prop. `editable` is true only on a Draft voucher (`voucher.status === "Draft"`).
- Do not add `@playwright/test` or a committed E2E suite. Browser checks are manual, through the `playwright` MCP server.

---

### Task 1: Payer becomes a contact reference

Replaces the copied `payerName` / `payerEmail` strings on a receivable with a single `payerContactId`, and gives the voucher its `payerContactIds` list. Nothing visible changes yet — the Receivables table renders the same names, read from the contact record instead of from a copy.

**Files:**
- Modify: `src/data/types.ts:765-775` (`DealFinancials`), `src/data/types.ts:1062-1070` (`FinancialReceivable`)
- Modify: `src/data/persistence.ts:5` (SEED_VERSION)
- Modify: `src/data/seed.ts:1457-1503` (receivables), `src/data/seed.ts:1605-1620` (backOffice literal)
- Modify: `src/data/leaseSpaceFixtures.ts:452-472`
- Modify: `src/data/createListing.ts:694-702`
- Modify: `src/components/deals/DealFinancials.tsx:945`, `:1041`, `:1047-1049`
- Modify: `src/ai/tools.ts:1165`
- Modify: `src/data/vouchers.test.ts:145-147` (fixture rows)
- Test: `src/data/seed.test.ts`

**Interfaces:**
- Consumes: `getContact(contactId)` from `#/data/store`, returning `Contact | undefined`.
- Produces: `FinancialReceivable.payerContactId: string`; `DealFinancials.payerContactIds: string[]`. Tasks 2, 3, 6 and 7 all read these.

- [ ] **Step 1: Write the failing test**

Add to the end of `src/data/seed.test.ts`:

```ts
describe('voucher payers seed', () => {
  const { listings, contacts } = generateDataset()
  const contactIds = new Set(contacts.map((c) => c.id))

  it('points every receivable at a contact that exists', () => {
    for (const deal of listings) {
      for (const r of deal.transaction.backOffice.receivables) {
        expect(contactIds.has(r.payerContactId)).toBe(true)
      }
    }
  })

  it("lists every receivable's payer among the voucher's payers", () => {
    // The rule the Payers section depends on: a receivable cannot bill someone
    // the voucher has not named as a payer.
    for (const deal of listings) {
      const back = deal.transaction.backOffice
      for (const r of back.receivables) {
        expect(back.payerContactIds).toContain(r.payerContactId)
      }
    }
  })

  it('has no duplicate payers on a voucher', () => {
    for (const deal of listings) {
      const ids = deal.transaction.backOffice.payerContactIds
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test -- seed.test.ts`
Expected: FAIL. `payerContactId` and `payerContactIds` do not exist, so the assertions read `undefined`.

- [ ] **Step 3: Change the two types**

In `src/data/types.ts`, replace the two payer fields on `FinancialReceivable`:

```ts
/** Money owed to the brokerage on a deal — shown on the Financials tab. */
export interface FinancialReceivable {
  id: string
  /**
   * Who is billed, as a contact id — not a copy of their name and email.
   *
   * Always one of the voucher's `payerContactIds`. Storing the reference means
   * correcting a contact's email fixes it on every voucher that billed them;
   * the copies this replaced went stale silently.
   */
  payerContactId: string
  dueDate: string
  billingDescription: string
  amount: number
  credited: number
}
```

And add the payer list to `DealFinancials`:

```ts
export interface DealFinancials {
  name: string
  identifier: string
  status: 'Approved' | 'Pending' | 'Draft'
  closeDate: string | null
  relatedContactsLabel: string
  /**
   * Who this voucher bills, in the order they were added. Each is a contact id.
   *
   * A voucher can bill several parties — a commission split across both sides
   * of a deal is the ordinary case — so this is a list, and every receivable
   * names one of them.
   */
  payerContactIds: string[]
  preSplitDeductions: FinancialDeduction[]
  receivables: FinancialReceivable[]
  /** Non-null exactly when `status` is `'Approved'`. */
  approval: VoucherApproval | null
}
```

- [ ] **Step 4: Update the seed**

In `src/data/seed.ts`, in the `if (status === 'closed' && commissionAmount > 0)` block, change both `receivables.push` calls. First one:

```ts
      receivables.push({
        id: faker.string.uuid(),
        payerContactId: primaryPayer.id,
        dueDate: faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
        billingDescription: split ? 'Initial Payment' : 'Full Payment',
        amount: firstAmount,
        // Settled / part-paid / untouched, in that order — the Credited column
        // has nothing to show until these differ from each other.
        credited:
          variant === 0 ? firstAmount : variant === 1 ? Math.round(firstAmount / 2) : 0,
      })
```

Second one:

```ts
        receivables.push({
          id: faker.string.uuid(),
          payerContactId: otherPayer.id,
          dueDate: faker.date.soon({ days: 45 }).toISOString().slice(0, 10),
          billingDescription: 'Balance Due',
          amount: commissionAmount - firstAmount,
          credited: 0,
        })
```

Immediately after the closing `}` of that `if` block, derive the payer list:

```ts
    // Derived from the receivables rather than assembled separately: the two
    // must agree, and one of them has to be the source. A voucher with no
    // receivables has no payers yet, which is a real state — Draft vouchers
    // start there.
    const payerContactIds = [...new Set(receivables.map((r) => r.payerContactId))]
```

Then add `payerContactIds,` to the `backOffice` object literal (around line 1613), directly above `preSplitDeductions`.

- [ ] **Step 5: Update the lease space fixtures**

In `src/data/leaseSpaceFixtures.ts`, inside `applyStageDetail`, in the block that sets `status: 'Approved'`. The tenant is already linked by this point — the comment above reads "Under contract and beyond: a tenant was accepted". Replace the `receivables` array and add the payer list:

```ts
  // The suite's tenant is who gets billed. This used to hold
  // `relatedContactsLabel`, a display string like "Jane Doe & 2 more", in a
  // field meant for one person — so the Receivables table named a payer who
  // was not a real party.
  const tenantContactId = child.tenantContactIds[0]

  child.transaction.backOffice = {
    ...child.transaction.backOffice,
    name: child.name,
    identifier: child.dealId,
    status: 'Approved',
    // Two days after the "Submit commission voucher" task above completed.
    // Named outright rather than drawn from `VOUCHER_APPROVER_IDS`: this module
    // must stay faker-free, and the seed tests pin it that way.
    approval: { reviewerId: 'omar-haddad', approvedOn: isoDate(-6) },
    closeDate: child.transaction.closeDate,
    payerContactIds: [tenantContactId],
    receivables: [
      {
        id: `recv-${child.id}`,
        payerContactId: tenantContactId,
        dueDate: isoDate(20),
        billingDescription: `Lease commission — Suite ${suiteNumber}`,
        amount: commissionAmount,
        credited: 0,
      },
    ],
  }
```

- [ ] **Step 6: Update `createListing`**

In `src/data/createListing.ts`, add the empty list to the `backOffice` literal. A brand-new deal has no payers, the same way it has no receivables:

```ts
      backOffice: {
        name,
        identifier: dealId,
        status: 'Draft',
        closeDate: null,
        approval: null,
        relatedContactsLabel: primaryContact ? contactLabel(primaryContact) : '—',
        payerContactIds: [],
        preSplitDeductions: [],
        receivables: [],
      },
```

- [ ] **Step 7: Update the three reads in `DealFinancials.tsx`**

At the top of `ReceivablesSection`, replace the single-payer guess with a per-row lookup. Delete these lines:

```ts
  // Receivables don't carry a payer id, but every payer is the deal's buyer (or seller) contact.
  const payerContactId =
    listing.buyerContactIds[0] ?? listing.sellerContactIds[0];
```

Replace with nothing — each row now knows its own payer. Add the import at the top of the file:

```ts
import { voucherParty } from "#/data/vouchers";
```

`voucherParty` is added in Step 7a below, so this task compiles on its own.

Change the invoice rule (line 945) to compare ids rather than names:

```ts
  // One invoice bills one payer. Compared by contact id, not by name: two
  // different contacts who happen to share a name are two payers.
  const canCreateInvoice =
    someSelected && new Set(selectedRows.map((r) => r.payerContactId)).size === 1;
```

Inside the row map, replace the payer cell and the checkbox label:

```tsx
              {receivables.map((r) => {
                const payer = voucherParty(r.payerContactId);
                return (
                  <Table.Row
                    key={r.id}
                    className={
                      editable && selectedIds.has(r.id) ? "table-active" : undefined
                    }
                  >
                    {editable && (
                      <Table.Cell
                        style={{
                          width: RECEIVABLE_CHECKBOX_W,
                          minWidth: RECEIVABLE_CHECKBOX_W,
                        }}
                      >
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={(c) => toggleOne(r.id, c === true)}
                          aria-label={`Select receivable for ${payer.name}`}
                        />
                      </Table.Cell>
                    )}
                    <Table.Cell>
                      <div>
                        <PersonLink
                          name={payer.name}
                          contactId={payer.exists ? payer.contactId : undefined}
                        />
                      </div>
                      <div className="text-muted fs-small">{payer.email}</div>
                    </Table.Cell>
                    <Table.Cell>{formatDate(r.dueDate)}</Table.Cell>
                    <Table.Cell>{r.billingDescription}</Table.Cell>
                    <Table.Cell className="text-end">
                      {formatCurrency(r.amount)}
                    </Table.Cell>
                    <Table.Cell className="text-end">
                      {r.credited > 0 ? formatCurrency(r.credited) : "None"}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
```

- [ ] **Step 7a: Add `voucherParty`**

Every payer column reads through one resolver, so no component reaches into the contact store itself. In `src/data/vouchers.ts`, add `getContact` to the `./store` import and add this above `export interface VoucherRow`:

```ts
/**
 * One party on a voucher — a buyer, a tenant, or a payer — resolved from the
 * contact record for display.
 *
 * A party stores nothing of its own. Name, company, email and phone are read
 * here at render time rather than copied onto the voucher, so correcting a
 * contact corrects every voucher that names them.
 */
export interface VoucherParty {
  contactId: string
  name: string
  company: string
  email: string
  phone: string
  /**
   * False when the contact is no longer in the store.
   *
   * The row still renders. A voucher is a record of who was billed, and losing
   * a billed line because someone tidied the contact book would be a worse
   * failure than showing a placeholder. Callers use this to decide whether to
   * link the name to a contact page that is not there any more.
   */
  exists: boolean
}

export function voucherParty(contactId: string): VoucherParty {
  const contact = getContact(contactId)
  if (!contact) {
    return {
      contactId,
      name: 'Unknown contact',
      company: '',
      email: '',
      phone: '',
      exists: false,
    }
  }
  return {
    contactId,
    name: `${contact.firstName} ${contact.lastName}`.trim(),
    company: contact.company,
    email: contact.email,
    phone: contact.phone,
    exists: true,
  }
}
```

Add its tests to `src/data/vouchers.test.ts`, importing `voucherParty` alongside the existing names:

```ts
describe('voucherParty', () => {
  it('reads name, company, email and phone off the contact', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const contact = [...useDataStore.getState().contacts.values()][0]!
    const party = voucherParty(contact.id)
    expect(party.name).toBe(`${contact.firstName} ${contact.lastName}`.trim())
    expect(party.company).toBe(contact.company)
    expect(party.email).toBe(contact.email)
    expect(party.exists).toBe(true)
    expect(deal.id).toBeTruthy()
  })

  it('keeps the row when the contact is gone', () => {
    // A voucher is a record of what was billed. Deleting a contact must not
    // make a billed line vanish, so this returns a readable placeholder rather
    // than null and leaves the caller nothing to crash on.
    resetStore()
    const party = voucherParty('no-such-contact')
    expect(party.name).toBe('Unknown contact')
    expect(party.exists).toBe(false)
    expect(party.company).toBe('')
    expect(party.email).toBe('')
  })
})
```

- [ ] **Step 8: Update the AI tool field**

In `src/ai/tools.ts`, add the import:

```ts
import { voucherParty } from '#/data/vouchers'
```

and change line 1165:

```ts
          receivables: back.receivables.map((r) => ({
            payer: voucherParty(r.payerContactId).name,
```

- [ ] **Step 9: Update the existing test fixture rows**

In `src/data/vouchers.test.ts`, the two hand-written receivable rows use the old fields. Replace them:

```ts
    listing.transaction.backOffice.receivables = [
      { id: 'r1', payerContactId: 'c1', dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 4000 },
      { id: 'r2', payerContactId: 'c2', dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
```

- [ ] **Step 10: Bump SEED_VERSION**

In `src/data/persistence.ts`:

```ts
export const SEED_VERSION = 49;
```

Without this the browser reads an old IndexedDB snapshot whose receivables still have `payerName`, and every payer renders as "Unknown contact".

- [ ] **Step 11: Run the tests and the type-checker**

Run: `bun --bun run test`
Expected: PASS, including the three new seed tests.

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "refactor(voucher): a receivable's payer is a contact, not a copied name"
```

---

### Task 2: Payer and party helpers

Pure functions that turn contact ids into rows the two new sections render. Everything that needs a name, company or billed total goes through here, so no component reaches into the contact store itself.

**Files:**
- Modify: `src/data/vouchers.ts`
- Test: `src/data/vouchers.test.ts`

**Interfaces:**
- Consumes: `voucherParty(contactId): VoucherParty` and the `VoucherParty` type from Task 1; `DealFinancials`, `Listing`, `DealType` from `#/data/types`.
- Produces:
  - `voucherPayers(voucher: DealFinancials): VoucherPayerRow[]` where `VoucherPayerRow = VoucherParty & { billed: number; receivableCount: number }`
  - `payerRemovalBlock(payer: VoucherPayerRow): string | null`
  - `partyContactIds(deal: Listing): string[]`
  - `partySectionTitle(dealType: DealType): string`
  Tasks 3, 5 and 6 all use these.

- [ ] **Step 1: Write the failing tests**

Add to `src/data/vouchers.test.ts`. Extend the import at the top to include the new names:

```ts
import {
  allVouchers,
  isVoucherPending,
  partyContactIds,
  partySectionTitle,
  payerRemovalBlock,
  voucherHref,
  voucherParty,
  voucherPayers,
  voucherTotals,
} from './vouchers'
```

Then add these blocks before `describe('voucherTotals', …)`:

```ts
describe('voucherPayers', () => {
  it('sums what each payer was billed, gross of credits', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1', 'c2']
    voucher.receivables = [
      { id: 'r1', payerContactId: 'c1', dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 4000 },
      { id: 'r2', payerContactId: 'c1', dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
      { id: 'r3', payerContactId: 'c2', dueDate: '2026-03-01', billingDescription: 'Fee', amount: 2500, credited: 0 },
    ]
    const rows = voucherPayers(voucher)
    // Gross, not net: "Billed" answers what they were asked for. The Credited
    // column in the Receivables table answers what has been paid.
    expect(rows.map((r) => r.billed)).toEqual([15000, 2500])
    expect(rows.map((r) => r.receivableCount)).toEqual([2, 1])
  })

  it('reads zero for a payer with nothing billed yet', () => {
    // A named payer with no receivable is a real state — you name who you are
    // going to bill before you bill them — so the row stays and reads $0.
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = []
    expect(voucherPayers(voucher)).toHaveLength(1)
    expect(voucherPayers(voucher)[0]!.billed).toBe(0)
    expect(voucherPayers(voucher)[0]!.receivableCount).toBe(0)
  })

  it('keeps the payers in the order they were added', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c2', 'c1']
    voucher.receivables = []
    expect(voucherPayers(voucher).map((r) => r.contactId)).toEqual(['c2', 'c1'])
  })
})

describe('payerRemovalBlock', () => {
  it('refuses to remove a payer that has receivables', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = [
      { id: 'r1', payerContactId: 'c1', dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 0 },
      { id: 'r2', payerContactId: 'c1', dueDate: '2026-02-01', billingDescription: 'Balance', amount: 5000, credited: 0 },
    ]
    const reason = payerRemovalBlock(voucherPayers(voucher)[0]!)
    expect(reason).toContain('2 receivables')
  })

  it('says "receivable" in the singular for one', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = [
      { id: 'r1', payerContactId: 'c1', dueDate: '2026-01-01', billingDescription: 'Deposit', amount: 10000, credited: 0 },
    ]
    expect(payerRemovalBlock(voucherPayers(voucher)[0]!)).toContain('1 receivable.')
  })

  it('allows removing a payer with nothing billed', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const voucher = getListing(deal.id)!.transaction.backOffice
    voucher.payerContactIds = ['c1']
    voucher.receivables = []
    expect(payerRemovalBlock(voucherPayers(voucher)[0]!)).toBeNull()
  })
})

describe('partyContactIds', () => {
  it('reads the buyers on a sale', () => {
    resetStore()
    const deal = makeSale('Riverside Tower')
    const listing = getListing(deal.id)!
    listing.buyerContactIds = ['b1']
    listing.tenantContactIds = ['t1']
    expect(partyContactIds(listing)).toEqual(['b1'])
    expect(partySectionTitle(listing.dealType)).toBe('Buyer')
  })

  it('reads the tenants on a lease', () => {
    resetStore()
    const deal = makeLease('Standalone Lease')
    const listing = getListing(deal.id)!
    listing.buyerContactIds = ['b1']
    listing.tenantContactIds = ['t1']
    expect(partyContactIds(listing)).toEqual(['t1'])
    expect(partySectionTitle(listing.dealType)).toBe('Tenant')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- vouchers.test.ts`
Expected: FAIL, "voucherParty is not a function" (or a TypeScript import error).

- [ ] **Step 3: Implement the helpers**

In `src/data/vouchers.ts`, extend the type imports (`getContact` is already imported by Task 1):

```ts
import type {
  DealFinancials,
  DealType,
  Listing,
  PropertyStatus,
  PropertyType,
  TransactionSide,
} from './types'
```

Then add, below `voucherParty`:

```ts
/** A payer, plus what this voucher has billed them. */
export interface VoucherPayerRow extends VoucherParty {
  /**
   * Sum of this payer's receivables, GROSS of credits — what they were asked
   * for, not what is still outstanding. The Receivables table below carries the
   * Credited column, and restating it here would put two different answers to
   * "how much" on one screen.
   */
  billed: number
  /**
   * How many receivables name this payer. Drives the removal guard: a payer
   * with receivables cannot be taken off the voucher, because the rows that
   * bill them would point at nobody.
   */
  receivableCount: number
}

export function voucherPayers(voucher: DealFinancials): VoucherPayerRow[] {
  return voucher.payerContactIds.map((contactId) => {
    const rows = voucher.receivables.filter((r) => r.payerContactId === contactId)
    return {
      ...voucherParty(contactId),
      billed: rows.reduce((sum, r) => sum + r.amount, 0),
      receivableCount: rows.length,
    }
  })
}

/**
 * Why this payer cannot be taken off the voucher, or null when they can be.
 *
 * A payer with receivables cannot leave: the rows billing them would point at
 * nobody, and the Receivables table would name a payer the voucher does not
 * list. The rule lives here rather than only in the button that enforces it, so
 * it holds however removal is reached and can be tested without a browser.
 *
 * Returns the sentence the tooltip shows rather than a boolean, because a
 * greyed button with no explanation is a dead icon — the reason is the whole
 * value of blocking it.
 */
export function payerRemovalBlock(payer: VoucherPayerRow): string | null {
  if (payer.receivableCount === 0) return null
  const plural = payer.receivableCount === 1 ? 'receivable' : 'receivables'
  return `${payer.name} has ${payer.receivableCount} ${plural}. Remove those first.`
}

/**
 * The deal's acquiring party — buyers on a sale, tenants on a lease.
 *
 * The two live in separate arrays on the deal (`buyerContactIds` and
 * `tenantContactIds` are deliberately distinct datasets), and the voucher shows
 * exactly one of them. This is the single place that choice is made, so the
 * section title and the section's writes cannot disagree about which list they
 * are looking at.
 */
export function partyContactIds(deal: Listing): string[] {
  return deal.dealType === 'Lease' ? deal.tenantContactIds : deal.buyerContactIds
}

/** What the acquiring party is called on this deal type. */
export function partySectionTitle(dealType: DealType): string {
  return dealType === 'Lease' ? 'Tenant' : 'Buyer'
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test -- vouchers.test.ts`
Expected: PASS.

Run: `bunx tsc --noEmit`
Expected: no output. Task 1's `DealFinancials.tsx` and `ai/tools.ts` imports now resolve.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(voucher): party and payer helpers, resolved from contacts"
```

---

### Task 3: Save the two new lists, and keep the Back Office label true

Extends the voucher's one Save so it commits the buyer/tenant list and the payer list, and rebuilds the denormalized `relatedContactsLabel` the Back Office index reads.

**Files:**
- Modify: `src/data/actions.ts:337-382`
- Test: `src/data/actions.test.ts`

**Interfaces:**
- Consumes: `partyContactIds` from Task 2 is **not** used here — this writes the raw arrays.
- Produces: `VoucherDraft` gains `partyContactIds: string[]` and `payerContactIds: string[]`. Tasks 5 and 6 build this object.

- [ ] **Step 1: Write the failing tests**

Add to `src/data/actions.test.ts`, near the other voucher tests:

```ts
  it('saveVoucherDraft writes the party list to buyers on a sale', () => {
    const deal = [...useDataStore.getState().listings.values()].find(
      (l) => l.dealType === 'Sale',
    )!
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    saveVoucherDraft(deal.id, {
      preSplitDeductions: [],
      internalBrokers: deal.internalBrokers,
      partyContactIds: ['buyer-1'],
      payerContactIds: ['payer-1'],
    })
    const saved = getListing(deal.id)!
    expect(saved.buyerContactIds).toEqual(['buyer-1'])
    expect(saved.transaction.backOffice.payerContactIds).toEqual(['payer-1'])
  })

  it('saveVoucherDraft writes the party list to tenants on a lease', () => {
    // The same draft field lands in a different array. One list in, the deal
    // type decides where it goes — so a sale can never hold a tenant list.
    const deal = [...useDataStore.getState().listings.values()].find(
      (l) => l.dealType === 'Lease',
    )!
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    saveVoucherDraft(deal.id, {
      preSplitDeductions: [],
      internalBrokers: deal.internalBrokers,
      partyContactIds: ['tenant-1'],
      payerContactIds: [],
    })
    const saved = getListing(deal.id)!
    expect(saved.tenantContactIds).toEqual(['tenant-1'])
    expect(saved.buyerContactIds).not.toContain('tenant-1')
  })

  it('saveVoucherDraft rebuilds relatedContactsLabel from the saved parties', () => {
    // The label is a denormalized string the Back Office vouchers list shows
    // and searches. Editing the buyer here would leave it describing whoever
    // used to be on the deal.
    const deal = [...useDataStore.getState().listings.values()].find(
      (l) => l.dealType === 'Sale',
    )!
    const contact = [...useDataStore.getState().contacts.values()][0]!
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    saveVoucherDraft(deal.id, {
      preSplitDeductions: [],
      internalBrokers: deal.internalBrokers,
      partyContactIds: [contact.id],
      payerContactIds: [],
    })
    const label = getListing(deal.id)!.transaction.backOffice.relatedContactsLabel
    expect(label).toContain(contact.firstName)
  })

  it('saveVoucherDraft leaves a submitted voucher alone', () => {
    // The Draft-only guard has to cover the new fields too, or the page's
    // freeze is only skin-deep.
    for (const status of ['Pending', 'Approved'] as const) {
      const deal = [...useDataStore.getState().listings.values()][0]!
      updateDealTransaction(deal.id, {
        backOffice: { ...deal.transaction.backOffice, status, payerContactIds: [] },
      })
      saveVoucherDraft(deal.id, {
        preSplitDeductions: [],
        internalBrokers: deal.internalBrokers,
        partyContactIds: ['nope'],
        payerContactIds: ['nope'],
      })
      const saved = getListing(deal.id)!
      expect(saved.transaction.backOffice.payerContactIds).toEqual([])
      expect(saved.buyerContactIds).not.toContain('nope')
    }
  })
```

Make sure `saveVoucherDraft` and `getListing` are in that file's imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- actions.test.ts`
Expected: FAIL. `VoucherDraft` has no `partyContactIds`, so TypeScript rejects the call.

- [ ] **Step 3: Extend the draft and the write**

In `src/data/actions.ts`, replace the `VoucherDraft` interface and `saveVoucherDraft`:

```ts
export interface VoucherDraft {
  preSplitDeductions: FinancialDeduction[]
  internalBrokers: DealBroker[]
  /**
   * The acquiring party — buyers on a sale, tenants on a lease.
   *
   * ONE list, not two. The voucher shows exactly one of the two sections, so a
   * draft carrying both would let a Sale deal hold a list of tenants that
   * nothing renders and nothing clears. `dealType` decides where it lands, in
   * one place, below.
   */
  partyContactIds: string[]
  /** Who this voucher bills. Each is a contact id. */
  payerContactIds: string[]
}

/**
 * The label the Back Office vouchers list shows in its Related Contacts column,
 * and searches.
 *
 * Rebuilt on every save because it is denormalized: the deal's parties are the
 * truth and this is a copy, so an edited buyer would otherwise leave it naming
 * whoever used to be there. The format matches what the seed writes, so a saved
 * voucher does not suddenly read differently from an untouched one.
 */
function buildRelatedContactsLabel(deal: Listing): string {
  const ids = [
    ...deal.sellerContactIds,
    ...deal.buyerContactIds,
    ...deal.tenantContactIds,
  ]
  const first = ids.map((id) => getContact(id)).find((c) => c !== undefined)
  if (!first) return '—'
  const name = `${first.firstName} ${first.lastName}`.trim()
  return ids.length > 1 ? `${name} & ${ids.length - 1} more` : name
}

/**
 * Commit a Draft voucher's editable tables — the write behind its Save button.
 *
 * **Draft only,** the same guard `submitVoucher` and `reopenVoucher` carry and
 * for the same reason: a Pending voucher is sitting with an approver and an
 * Approved one has been signed off, so the figures either is looking at cannot
 * change underneath it. The rule lives here rather than only in the Save button
 * so it holds however the write is reached.
 *
 * Whole arrays are replaced rather than patched row by row: the tables edit
 * rows, add them, and delete them in one local working copy, and Save is a
 * statement about that copy as a whole. One write for all of them, because one
 * button commits them — a partial save would leave the deduction total, the
 * broker splits and the payer list describing different drafts.
 *
 * `internalBrokers` and the party lists sit on the deal rather than in
 * `backOffice`, so this is also the one place that fact is spelled out.
 */
export function saveVoucherDraft(
  dealId: string,
  draft: VoucherDraft,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => {
      if (l.transaction.backOffice.status !== 'Draft') return l
      const isLease = l.dealType === 'Lease'
      const next: Listing = {
        ...l,
        internalBrokers: draft.internalBrokers,
        buyerContactIds: isLease ? l.buyerContactIds : draft.partyContactIds,
        tenantContactIds: isLease ? draft.partyContactIds : l.tenantContactIds,
        transaction: {
          ...l.transaction,
          backOffice: {
            ...l.transaction.backOffice,
            preSplitDeductions: draft.preSplitDeductions,
            payerContactIds: draft.payerContactIds,
          },
        },
        updatedAt: new Date().toISOString(),
      }
      // Built from `next`, not `l` — the label has to describe the parties
      // being saved, not the ones being replaced.
      next.transaction.backOffice.relatedContactsLabel =
        buildRelatedContactsLabel(next)
      return next
    }),
  }
}
```

Add `getContact` to the file's imports from `./store`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test -- actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the one existing caller**

`src/components/deals/DealFinancials.tsx` calls `saveVoucherDraft` with two fields and will no longer type-check. Pass the deal's current values through for now — Tasks 5 and 6 replace these with the working copies:

```ts
    saveVoucherDraft(listing.id, {
      preSplitDeductions: deductions,
      internalBrokers: brokers,
      partyContactIds: partyContactIds(listing),
      payerContactIds: voucher.payerContactIds,
    });
```

Add to the imports:

```ts
import { partyContactIds } from "#/data/vouchers";
```

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(voucher): Save commits the party and payer lists"
```

---

### Task 4: The contact picker modal

One modal, used by both new sections. A near-copy of `AddBrokerModal` with contacts as the source and no second field.

**Files:**
- Create: `src/components/deals/AddContactModal.tsx`
- Test: none. This is presentation over `getContactOptions()`, which is already covered; it is verified in the browser in Tasks 5 and 6.

**Interfaces:**
- Consumes: `getContactOptions(): ContactOption[]` from `#/data/store`, where `ContactOption = { value, label, name, company, title, relationship }`.
- Produces: `<AddContactModal open onOpenChange takenIds title onAdd />` where `onAdd: (contactId: string) => void`. Tasks 5 and 6 render it.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { getContactOptions, type ContactOption } from "#/data/store";

/**
 * Pick one contact — the Add behind the voucher's Buyer/Tenant and Payers
 * sections.
 *
 * Picking, not typing. A party on a voucher is a real person the company has a
 * record of; a free-text name would let a voucher bill someone the contact book
 * has never heard of, and every column beside the name — company, email, phone
 * — is read from that record and would have nowhere to come from.
 *
 * Creating a contact stays the contacts page's job. A half-filled contact made
 * in a hurry from a voucher is the kind of duplicate a CRM never recovers from.
 *
 * `title` is passed rather than derived, because the same modal opens as "Add
 * Buyer", "Add Tenant" and "Add Payer".
 */
export function AddContactModal({
	open,
	onOpenChange,
	takenIds,
	title,
	onAdd,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Already on the section — filtered out, so nobody is added twice. */
	takenIds: string[];
	/** "Buyer", "Tenant" or "Payer" — names the modal and its confirm button. */
	title: string;
	onAdd: (contactId: string) => void;
}) {
	const [selected, setSelected] = useState<ContactOption | null>(null);
	const [inputValue, setInputValue] = useState("");

	// A fresh form every time it opens — a half-filled one left over from a
	// cancelled add would be an odd thing to reopen into.
	useEffect(() => {
		if (open) {
			setSelected(null);
			setInputValue("");
		}
	}, [open]);

	const taken = new Set(takenIds);
	const options = getContactOptions().filter((o) => !taken.has(o.value));

	const add = () => {
		if (!selected) return;
		onAdd(selected.value);
		onOpenChange(false);
	};

	return (
		<Modal open={open} onOpenChange={onOpenChange}>
			<Modal.Content centered style={{ maxWidth: "30rem" }}>
				<Modal.Header>
					<Modal.Title>Add {title}</Modal.Title>
				</Modal.Header>

				<Modal.Body>
					<Field>
						<Field.Label>{title}</Field.Label>
						<Combobox
							items={options}
							value={selected}
							inputValue={inputValue}
							onInputValueChange={(v: string) => setInputValue(v)}
							onValueChange={(v) => {
								const opt = v as ContactOption | null;
								setSelected(opt);
								setInputValue(opt?.label ?? "");
							}}
						>
							<Combobox.InputGroup>
								<InputGroup.Addon>
									<FontAwesomeIcon icon={faMagnifyingGlass} />
								</InputGroup.Addon>
								<Combobox.Input placeholder="Search contacts..." />
							</Combobox.InputGroup>
							<Combobox.Content>
								<Combobox.Empty className="text-muted">
									{options.length === 0
										? "Every contact is already on this voucher"
										: "No matching contacts"}
								</Combobox.Empty>
								<Combobox.List>
									{(item: ContactOption) => (
										<Combobox.Item key={item.value} value={item}>
											<div className="d-flex flex-column">
												<span>{item.name}</span>
												<span className="text-muted fs-small">
													{[item.title, item.company]
														.filter(Boolean)
														.join(" · ")}
												</span>
											</div>
										</Combobox.Item>
									)}
								</Combobox.List>
							</Combobox.Content>
						</Combobox>
					</Field>
				</Modal.Body>

				<Modal.Footer>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button variant="primary" onClick={add} disabled={!selected}>
						Add {title}
					</Button>
				</Modal.Footer>
			</Modal.Content>
		</Modal>
	);
}
```

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. If `ContactOption` is not exported from `#/data/store`, export it — it is declared there at `store.ts:337`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(voucher): one contact picker for both new party sections"
```

---

### Task 5: The Buyer / Tenant section

**Files:**
- Modify: `src/components/deals/DealFinancials.tsx`
- Test: browser (see Step 5)

**Interfaces:**
- Consumes: `voucherParty`, `partyContactIds`, `partySectionTitle` (Task 2); `AddContactModal` (Task 4); the existing local-working-copy pattern in `DealFinancials`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add a shared party table**

Both new sections render the same four columns, so write the table once. Add above `OutsideCommissionsSection` in `DealFinancials.tsx`:

```tsx
/**
 * The contact columns both party sections share — buyer/tenant and payer.
 *
 * Written once because the two tables differ only in their heading, their
 * removal rule, and whether a Billed column follows. Two copies would drift the
 * first time one of them gained a column.
 */
function PartyRowCells({ party }: { party: VoucherParty }) {
  return (
    <>
      <Table.Cell>
        {/* No link when the contact is gone — a dead link to a contact page
            that 404s is worse than plain text. */}
        <PersonLink
          name={party.name}
          contactId={party.exists ? party.contactId : undefined}
        />
      </Table.Cell>
      <Table.Cell>{party.company || "—"}</Table.Cell>
      <Table.Cell>{party.email || "—"}</Table.Cell>
      <Table.Cell>{party.phone || "—"}</Table.Cell>
    </>
  );
}

/** The remove action both party tables carry. */
function RemovePartyButton({
  name,
  blockedReason,
  onRemove,
}: {
  name: string;
  /** Non-null when removal is refused — greys the button and explains why. */
  blockedReason: string | null;
  onRemove: () => void;
}) {
  const button = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Remove ${name}`}
      disabled={blockedReason !== null}
      onClick={blockedReason !== null ? undefined : onRemove}
    >
      <FontAwesomeIcon icon={faTrashCan} />
    </Button>
  );
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          // A disabled button fires no pointer events, so a blocked one hangs
          // its tooltip off a wrapper — the same trick RemoveBrokerButton uses,
          // and the reason the rule is discoverable rather than a dead icon.
          blockedReason !== null ? (
            <span className="d-inline-flex">{button}</span>
          ) : (
            button
          )
        }
      />
      <Tooltip.Content>{blockedReason ?? `Remove ${name}`}</Tooltip.Content>
    </Tooltip>
  );
}
```

Add `VoucherParty` to the type imports from `#/data/vouchers`.

- [ ] **Step 2: Add the section**

```tsx
/**
 * Who is acquiring — the deal's buyers on a sale, its tenants on a lease.
 *
 * The section title and the list both come from `dealType`, in one place, so a
 * lease voucher can never show a "Buyer" heading over its tenants.
 *
 * Editable on a Draft. These contacts live on the deal rather than in the
 * voucher record, so this and the Deal form's own contact fields write the same
 * arrays — which is why Save routes through `saveVoucherDraft` like everything
 * else here, instead of writing on each add.
 */
function PartySection({
  dealType,
  contactIds,
  editable,
  onChange,
}: {
  dealType: DealType;
  contactIds: string[];
  editable: boolean;
  onChange: (next: string[]) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const title = partySectionTitle(dealType);
  const parties = contactIds.map(voucherParty);

  return (
    <Section
      title={title}
      action={
        editable ? (
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} />
            Add {title}
          </Button>
        ) : undefined
      }
    >
      {parties.length === 0 ? (
        <p className="text-muted mb-0">
          No {title.toLowerCase()} has been added.
        </p>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Company</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
              {editable && <Table.Head style={{ width: 56 }} />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {parties.map((party) => (
              <Table.Row key={party.contactId}>
                <PartyRowCells party={party} />
                {editable && (
                  <Table.Cell>
                    <RemovePartyButton
                      name={party.name}
                      blockedReason={null}
                      onRemove={() =>
                        onChange(
                          contactIds.filter((id) => id !== party.contactId),
                        )
                      }
                    />
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}

      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        takenIds={contactIds}
        title={title}
        onAdd={(contactId) => onChange([...contactIds, contactId])}
      />
    </Section>
  );
}
```

Add to the imports at the top of the file. `partyContactIds` is already imported — Task 3 Step 5 added it — so extend that statement rather than writing a second one:

```tsx
import type { DealType } from "#/data/types";
import { AddContactModal } from "./AddContactModal";
import {
  partyContactIds,
  partySectionTitle,
  voucherParty,
  type VoucherParty,
} from "#/data/vouchers";
```

- [ ] **Step 3: Hold the working copy and render it**

In the `DealFinancials` component, beside the existing `deductions` and `brokers` working copies, add:

```tsx
  // The party list's working copy, on the same terms as the deduction and
  // broker tables above: edited locally, committed by the one Save. `stored…`
  // is the dirty test — every write here spreads a new array, so an add or a
  // remove breaks identity and Save writing it through restores it.
  const storedParties = partyContactIds(listing);
  const [parties, setParties] = useState(storedParties);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `storedParties` alone by design
  useEffect(() => setParties(storedParties), [storedParties]);
```

Extend the `dirty` test:

```tsx
  const dirty =
    deductions !== stored ||
    brokers !== storedBrokers ||
    parties !== storedParties;
```

Update the `save` call to send the working copy:

```tsx
    saveVoucherDraft(listing.id, {
      preSplitDeductions: deductions,
      internalBrokers: brokers,
      partyContactIds: parties,
      payerContactIds: voucher.payerContactIds,
    });
```

and its toast, which no longer describes everything it saves:

```tsx
    notify({
      title: "Voucher saved",
      description: "Parties, deductions and commissions updated.",
    });
```

Render the section directly after `TransactionSummarySection`:

```tsx
      <TransactionSummarySection listing={listing} editable={isDraft} />

      <PartySection
        dealType={listing.dealType}
        contactIds={parties}
        editable={isDraft}
        onChange={setParties}
      />

      <Separator />
```

- [ ] **Step 4: Type-check and run the tests**

Run: `bunx tsc --noEmit`
Expected: no output.

Run: `bun --bun run test`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Start the dev server if it is not running: `bun --bun run dev`.

Using the `playwright` MCP server, and following the gotchas in CLAUDE.md — never `waitUntil: "networkidle"`, scope selectors to `main.app-shell__main`, always `browser_wait_for` on text unique to the destination after `browser_navigate`, and always `browser_close` at the end:

1. Open `/backoffice/vouchers` and find a **Draft** Sale deal and a **Draft** Lease deal. Read their hrefs from the rows.
2. On the Sale voucher: confirm the section reads **Buyer**. Add a contact, confirm the row shows name, company, email and phone. Remove it. Add it again and press **Save**. Reload and confirm the row survived.
3. On the Lease voucher: confirm the section reads **Tenant**, and that saving there does not put the contact in `buyerContactIds` (check the Deal form's own fields, or read the store).
4. On a **Pending** voucher: confirm the section shows no Add button and no remove buttons.
5. Check `browser_console_messages` for errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(voucher): Buyer/Tenant section"
```

---

### Task 6: The Payers section

**Files:**
- Modify: `src/components/deals/DealFinancials.tsx`
- Test: browser (see Step 4)

**Interfaces:**
- Consumes: `voucherPayers`, `VoucherPayerRow` (Task 2); `PartyRowCells`, `RemovePartyButton`, `AddContactModal` (Tasks 4–5).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add the section**

```tsx
/**
 * Who this voucher bills.
 *
 * Sits directly above Receivables because that table references it: every
 * receivable names one of these payers, and the two have to be readable
 * together.
 *
 * A payer is usually the buyer or the tenant and often is not — a lease
 * commission billed to a corporate AP department, a sale where a holding
 * company pays. That is the reason this is its own list rather than a column on
 * the section above.
 */
function PayersSection({
  payers,
  editable,
  onChange,
}: {
  payers: VoucherPayerRow[];
  editable: boolean;
  onChange: (next: string[]) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const contactIds = payers.map((p) => p.contactId);
  const billedTotal = sum(payers.map((p) => p.billed));

  return (
    <Section
      title="Payers"
      action={
        editable ? (
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} />
            Add Payer
          </Button>
        ) : undefined
      }
    >
      {payers.length === 0 ? (
        <p className="text-muted mb-0">No payers have been added.</p>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Name</Table.Head>
              <Table.Head>Company</Table.Head>
              <Table.Head>Email</Table.Head>
              <Table.Head>Phone</Table.Head>
              <Table.Head className="text-end">Billed</Table.Head>
              {editable && <Table.Head style={{ width: 56 }} />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {payers.map((payer) => (
              <Table.Row key={payer.contactId}>
                <PartyRowCells party={payer} />
                <Table.Cell className="text-end">
                  {formatCurrency(payer.billed)}
                </Table.Cell>
                {editable && (
                  <Table.Cell>
                    <RemovePartyButton
                      name={payer.name}
                      blockedReason={payerRemovalBlock(payer)}
                      onRemove={() =>
                        onChange(
                          contactIds.filter((id) => id !== payer.contactId),
                        )
                      }
                    />
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
            <Table.Row>
              <Table.Cell colSpan={4} className="fw-semibold">
                Sum
              </Table.Cell>
              <Table.Cell className="text-end fw-semibold">
                {formatCurrency(billedTotal)}
              </Table.Cell>
              {editable && <Table.Cell />}
            </Table.Row>
          </Table.Body>
        </Table>
      )}

      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        takenIds={contactIds}
        title="Payer"
        onAdd={(contactId) => onChange([...contactIds, contactId])}
      />
    </Section>
  );
}
```

Add `voucherPayers`, `payerRemovalBlock` and `type VoucherPayerRow` to the existing `#/data/vouchers` import.

- [ ] **Step 2: Hold its working copy and render it**

Beside the other working copies in `DealFinancials`:

```tsx
  const storedPayers = voucher.payerContactIds;
  const [payerIds, setPayerIds] = useState(storedPayers);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `storedPayers` alone by design
  useEffect(() => setPayerIds(storedPayers), [storedPayers]);
```

Extend `dirty` again:

```tsx
  const dirty =
    deductions !== stored ||
    brokers !== storedBrokers ||
    parties !== storedParties ||
    payerIds !== storedPayers;
```

and the save:

```tsx
      payerContactIds: payerIds,
```

Render it directly above `ReceivablesSection`. The rows are derived from the working copy so an unsaved payer still shows, with its billed total read from the stored receivables:

```tsx
      <PayersSection
        payers={voucherPayers({ ...voucher, payerContactIds: payerIds })}
        editable={isDraft}
        onChange={setPayerIds}
      />

      <ReceivablesSection listing={listing} editable={!isPending} />
```

- [ ] **Step 3: Type-check and run the tests**

Run: `bunx tsc --noEmit`
Expected: no output.

Run: `bun --bun run test`
Expected: PASS.

- [ ] **Step 4: Verify in the browser**

Same MCP rules as Task 5.

1. Open a **closed** deal's voucher — those are the ones with receivables. Confirm the Payers section lists the same people the Receivables table bills, and that each Billed figure matches the sum of that payer's rows.
2. Confirm the Sum row equals the Receivables table's Receivable Amount sum.
3. Try to remove a payer who has receivables: the button must be greyed, and hovering must explain why.
4. On a Draft voucher, add a payer with no receivables and confirm the row reads $0.00 and **can** be removed.
5. On a **Pending** voucher, confirm no Add button, no remove buttons, and no Sum-row action column.
6. Check `browser_console_messages` for errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(voucher): Payers section, with what each party was billed"
```

---

### Task 7: Seed a payer who is not the buyer

Without this the feature is invisible in the demo: every seeded payer is already the buyer or the seller, so the Payers section looks like a duplicate of the Buyer section.

**Files:**
- Modify: `src/data/seed.ts:1457-1503`
- Test: `src/data/seed.test.ts`

**Interfaces:**
- Consumes: `payerContactIds` and `payerContactId` from Task 1.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing test**

Add to the `voucher payers seed` block from Task 1:

```ts
  it('bills at least one voucher to somebody who is not its buyer or tenant', () => {
    // The Payers section exists because the payer is often a different party —
    // a corporate AP department, a holding company. An all-defaults seed would
    // make the section look like a copy of the Buyer section.
    const outsider = listings.some((deal) => {
      const parties = new Set([
        ...deal.buyerContactIds,
        ...deal.tenantContactIds,
      ])
      return deal.transaction.backOffice.payerContactIds.some(
        (id) => !parties.has(id),
      )
    })
    expect(outsider).toBe(true)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test -- seed.test.ts`
Expected: FAIL — `expected false to be true`. Every seeded payer is currently a buyer or a seller.

Note: a seller is not a buyer or a tenant, so a split receivable billed to the seller may already satisfy this. If the test passes at this step, keep it anyway and skip to Step 4 — it is a real guarantee worth pinning — but still make the Step 3 change, because a seller-payer does not demonstrate a payer from **outside** the deal's parties.

- [ ] **Step 3: Bill one deal's commission to a third party**

In `src/data/seed.ts`, inside the `if (status === 'closed' && commissionAmount > 0)` block, after `const otherPayer = …`:

```ts
      // One closed deal in three bills a party that is on neither side — the
      // corporate AP department or holding company that actually cuts the
      // cheque. The Payers section is built for exactly this, and a seed where
      // every payer is also the buyer would make it look redundant.
      //
      // Cycled on the deal number rather than drawn, for the same reason
      // `variant` is: only a handful of deals reach Closed, and at that sample
      // size a probability leaves the case unreachable in some runs.
      const thirdPartyPayer =
        Number(dealId) % 3 === 2
          ? propertyContacts.find(
              (c) =>
                !buyerContacts.some((b) => b.id === c.id) &&
                !sellerContacts.some((s) => s.id === c.id),
            )
          : undefined
      // Falls back to the buyer when this property has no spare contact, so a
      // small contact list degrades to today's behaviour instead of throwing.
      const billTo = thirdPartyPayer ?? primaryPayer
```

Then use `billTo.id` in place of `primaryPayer.id` in the first `receivables.push`.

`propertyContacts` is `generateListings`' second parameter and is already in scope. Drawing from it rather than from all contacts keeps the rule the surrounding code states: "Parties are drawn from THIS property's associated contacts so the graph stays reciprocal."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test`
Expected: PASS, all four `voucher payers seed` tests included.

- [ ] **Step 5: Verify in the browser**

Reload the app (the SEED_VERSION bump from Task 1 already forces a re-seed; if data looks stale, delete the `keyval-store` IndexedDB database). Find a voucher whose Payers section lists somebody who is not in its Buyer or Tenant section. Confirm both sections render side by side and read as two different lists.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "seed(voucher): bill some deals to a third-party payer"
```

---

## Wrap-up

- [ ] Run the full gates one last time: `bunx tsc --noEmit` and `bun --bun run test`.
- [ ] Delete the spec and this plan in a `chore(docs):` commit, per the repo's in-flight-only rule. Move anything worth keeping — chiefly anything tried and reverted — into the PR body first.
- [ ] Do not merge. Push and open the PR with `/ship`.
