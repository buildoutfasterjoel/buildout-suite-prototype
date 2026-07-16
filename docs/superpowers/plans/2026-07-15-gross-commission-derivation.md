# Gross Commission Derivation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link a deal's Sale Price, Gross Commission %, and Gross Commission $ as a bi-directional trio (sale price anchors) in the "Move to Under Contract" stage gate and in a new Edit Transaction dialog.

**Architecture:** A shared pure-function helper (`commission.ts`) does the math both surfaces call. The stage gate gains a % field and bi-directional recompute; the currently-dead pencil on the Transaction card opens a new dialog that commits through a new `updateDealTransaction` merge-patch action.

**Tech Stack:** React 19 · TypeScript · Zustand data store · Blueprint React (Modal/Dialog/Field/Input) · Vitest.

## Global Constraints

- Package manager is Bun; run everything with `bun --bun run`.
- Tests use Vitest; `bun --bun run test` runs the whole suite once (`vitest run`). A single file: `bun --bun run test <path>`.
- UI uses Blueprint React components imported from the `ui` subpath. No Tailwind; Bootstrap 5 utility classes for spacing/layout.
- Do NOT edit `routeTree.gen.ts` (auto-generated).
- Do NOT use Playwright. Run tests + typecheck; ask the user to click through the UI.
- FontAwesome: `pro-regular` by default; never pass `fixedWidth`.
- Derived % precision: 2 decimals. Sale price is the anchor.

---

### Task 1: Commission math helper

**Files:**
- Create: `src/data/commission.ts`
- Test: `src/data/commission.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `commissionAmountFromPct(salePrice: number, pct: number): number` — whole-dollar amount.
  - `commissionPctFromAmount(salePrice: number, amount: number): number` — 2-decimal %, `0` when `salePrice <= 0`.

- [ ] **Step 1: Write the failing tests**

Create `src/data/commission.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { commissionAmountFromPct, commissionPctFromAmount } from "./commission";

describe("commissionAmountFromPct", () => {
  it("computes whole-dollar commission from a rate", () => {
    expect(commissionAmountFromPct(2_000_000, 3)).toBe(60_000);
  });

  it("rounds to the nearest dollar", () => {
    expect(commissionAmountFromPct(1_234_567, 2.5)).toBe(30_864); // 30864.175 -> 30864
  });

  it("returns 0 for a zero rate", () => {
    expect(commissionAmountFromPct(2_000_000, 0)).toBe(0);
  });
});

describe("commissionPctFromAmount", () => {
  it("computes the implied rate to 2 decimals", () => {
    expect(commissionPctFromAmount(2_000_000, 61_000)).toBe(3.05);
  });

  it("rounds to 2 decimals", () => {
    expect(commissionPctFromAmount(1_234_567, 30_864)).toBe(2.5);
  });

  it("returns 0 when sale price is 0 (avoids divide-by-zero)", () => {
    expect(commissionPctFromAmount(0, 60_000)).toBe(0);
  });

  it("returns 0 when sale price is negative", () => {
    expect(commissionPctFromAmount(-5, 60_000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun --bun run test src/data/commission.test.ts`
Expected: FAIL — cannot resolve `./commission`.

- [ ] **Step 3: Write the helper**

Create `src/data/commission.ts`:

```ts
/**
 * The Sale Price / Gross Commission % / Gross Commission $ trio, with sale price
 * as the anchor. Both the Under Contract stage gate and the Edit Transaction
 * dialog use these so the math is identical in both places.
 */

/** Total gross commission $ from a sale price and rate, rounded to whole dollars. */
export function commissionAmountFromPct(salePrice: number, pct: number): number {
  return Math.round((salePrice * pct) / 100);
}

/**
 * Implied gross commission % from a dollar amount, to 2-decimal precision.
 * Returns 0 when salePrice <= 0 to avoid a divide-by-zero / nonsensical rate.
 */
export function commissionPctFromAmount(salePrice: number, amount: number): number {
  if (salePrice <= 0) return 0;
  return Math.round((amount / salePrice) * 10000) / 100;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun --bun run test src/data/commission.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/commission.ts src/data/commission.test.ts
git commit -m "feat(deals): add bi-directional commission math helper"
```

---

### Task 2: `updateDealTransaction` action

**Files:**
- Modify: `src/data/actions.ts` (add after `updateDealMarketing`, ~line 118)
- Test: `src/data/actions.test.ts` (add a new `describe` block)

**Interfaces:**
- Consumes: `patchListing` (module-local in `actions.ts`), `DealTransaction` type.
- Produces: `updateDealTransaction(dealId: string, patch: Partial<DealTransaction>): { deal: Listing | null }` — merge-patches into `listing.transaction` (does not replace it).

- [ ] **Step 1: Write the failing test**

Add to `src/data/actions.test.ts` (import `updateDealTransaction` from `./actions` alongside the existing imports; check the top of the file for the exact import style and reuse it):

```ts
import { updateDealTransaction } from "./actions";
import { useDataStore } from "#/data/dataStore";

describe("updateDealTransaction", () => {
  it("merges into transaction without dropping sibling fields", () => {
    const deal = [...useDataStore.getState().listings.values()][0];
    const originalPricePerSqFt = deal.transaction.pricePerSqFt;

    const { deal: updated } = updateDealTransaction(deal.id, {
      salePrice: 2_000_000,
      commissionPct: 3,
      commissionAmount: 60_000,
    });

    expect(updated?.transaction.salePrice).toBe(2_000_000);
    expect(updated?.transaction.commissionPct).toBe(3);
    expect(updated?.transaction.commissionAmount).toBe(60_000);
    // Sibling fields survive the merge.
    expect(updated?.transaction.pricePerSqFt).toBe(originalPricePerSqFt);
  });
});
```

> If `actions.test.ts` already imports from `./actions`, add `updateDealTransaction` to that existing import instead of adding a second import line. If it already imports `useDataStore`, reuse it.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/actions.test.ts`
Expected: FAIL — `updateDealTransaction` is not exported.

- [ ] **Step 3: Add the action**

In `src/data/actions.ts`, immediately after the `updateDealMarketing` function, add:

```ts
/** Merge-patch the deal's transaction terms (price, commission %/$, close probability). */
export function updateDealTransaction(
  dealId: string,
  patch: Partial<DealTransaction>,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      transaction: { ...l.transaction, ...patch },
      updatedAt: new Date().toISOString(),
    })),
  }
}
```

Ensure `DealTransaction` is in the `./types` import at the top of `actions.ts` (add it to the existing type import if missing).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/actions.ts src/data/actions.test.ts
git commit -m "feat(deals): add updateDealTransaction merge-patch action"
```

---

### Task 3: Gross Commission % in the Under Contract gate

**Files:**
- Modify: `src/data/stageGates.ts` (`GateFormState`, `EMPTY_FORM` is in `StageGate.tsx`, `buildTransitionInput` ~line 172)
- Modify: `src/components/deals/StageGate.tsx` (`EMPTY_FORM` ~line 36, form hydration ~line 143, gate fields ~line 443)

**Interfaces:**
- Consumes: `commissionAmountFromPct`, `commissionPctFromAmount` from Task 1.
- Produces: gate persists `transaction.commissionPct`; `GateFormState` gains `commissionPct: number | null`.

- [ ] **Step 1: Add `commissionPct` to `GateFormState`**

In `src/data/stageGates.ts`, in the `GateFormState` interface, add after the `commissionAmount` line:

```ts
  commissionAmount: number | null
  commissionPct: number | null
```

- [ ] **Step 2: Persist `commissionPct` in `buildTransitionInput`**

In `src/data/stageGates.ts`, inside `buildTransitionInput`, after the `commissionAmount` line (~line 185), add:

```ts
  if (form.commissionAmount != null) transaction.commissionAmount = form.commissionAmount
  if (form.commissionPct != null) transaction.commissionPct = form.commissionPct
```

- [ ] **Step 3: Add `commissionPct` to `EMPTY_FORM` and hydration in `StageGate.tsx`**

In `src/components/deals/StageGate.tsx`, in `EMPTY_FORM` (~line 43) add after `commissionAmount: null,`:

```ts
  commissionAmount: null,
  commissionPct: null,
```

In the `initialForm` `useMemo` (~line 153), after the `commissionAmount` line add:

```ts
      commissionAmount: deal.transaction.commissionAmount || null,
      commissionPct: deal.transaction.commissionPct || null,
```

- [ ] **Step 4: Import the helper**

At the top of `src/components/deals/StageGate.tsx`, add:

```ts
import { commissionAmountFromPct, commissionPctFromAmount } from "#/data/commission";
```

- [ ] **Step 5: Add bi-directional handlers**

In the component body, just after the `set` helper (~line 179–181), add:

```ts
  const setSalePrice = (v: number | null) =>
    setForm((f) => ({
      ...f,
      salePrice: v,
      commissionAmount:
        v != null && f.commissionPct != null
          ? commissionAmountFromPct(v, f.commissionPct)
          : f.commissionAmount,
    }));
  const setCommissionPct = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionPct: v,
      commissionAmount:
        v != null && f.salePrice != null
          ? commissionAmountFromPct(f.salePrice, v)
          : f.commissionAmount,
    }));
  const setCommissionAmount = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionAmount: v,
      commissionPct:
        v != null && f.salePrice != null && f.salePrice > 0
          ? commissionPctFromAmount(f.salePrice, v)
          : f.commissionPct,
    }));
```

- [ ] **Step 6: Rewire the Sale Price field and add the % field**

In `StageGate.tsx`, replace the existing Sale Price and Gross Commission ($) field blocks (~lines 443–473) with these three, in order (Sale Price → % → $). The % field is gated on `req("commissionAmount")` so it appears wherever the $ field does (no change to the gate's `required` array):

```tsx
              {req("salePrice") && (
                <Field>
                  <Field.Label>Sale Price</Field.Label>
                  <Input
                    type="number"
                    value={form.salePrice ?? ""}
                    onChange={(e) =>
                      setSalePrice(e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
              )}

              {req("commissionAmount") && (
                <Field>
                  <Field.Label>Gross Commission %</Field.Label>
                  <Input
                    type="number"
                    value={form.commissionPct ?? ""}
                    onChange={(e) =>
                      setCommissionPct(e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
              )}

              {req("commissionAmount") && (
                <Field>
                  <Field.Label>Gross Commission ($)</Field.Label>
                  <Input
                    type="number"
                    value={form.commissionAmount ?? ""}
                    onChange={(e) =>
                      setCommissionAmount(e.target.value ? Number(e.target.value) : null)
                    }
                  />
                </Field>
              )}
```

- [ ] **Step 7: Typecheck + run the gate test suite**

Run: `bun --bun run test src/data/stageGates.test.ts src/components/deals/useStageGate.test.ts`
Expected: PASS. If `useStageGate.test.ts` constructs a `GateFormState` literal, add `commissionPct: null` to it.

Run: `bun --bun run build` (or the project typecheck) to confirm no TS errors from the new field.
Expected: no type errors related to `commissionPct`.

- [ ] **Step 8: Commit**

```bash
git add src/data/stageGates.ts src/components/deals/StageGate.tsx
git commit -m "feat(deals): derive gross commission from % in the Under Contract gate"
```

---

### Task 4: Edit Transaction dialog wired to the Transaction card pencil

**Files:**
- Create: `src/components/deals/EditTransactionDialog.tsx`
- Modify: `src/components/deals/DealOverview.tsx` (`TransactionCard`, ~lines 90–111)

**Interfaces:**
- Consumes: `commissionAmountFromPct`, `commissionPctFromAmount` (Task 1); `updateDealTransaction` (Task 2); `Listing` type; `Dialog`, `Field`, `Input`, `Button` from Blueprint.
- Produces: `EditTransactionDialog` component:
  `{ listing: Listing; open: boolean; onOpenChange: (open: boolean) => void }`.

- [ ] **Step 1: Create the dialog**

Create `src/components/deals/EditTransactionDialog.tsx`:

```tsx
import { useState } from "react";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import type { Listing } from "#/data/types";
import { updateDealTransaction } from "#/data/actions";
import { commissionAmountFromPct, commissionPctFromAmount } from "#/data/commission";

interface TransactionForm {
  salePrice: number | null;
  commissionPct: number | null;
  commissionAmount: number | null;
  closeProbability: number | null;
}

/** Edit a deal's transaction terms. Sale Price anchors the commission %/$ trio. */
export function EditTransactionDialog({
  listing,
  open,
  onOpenChange,
}: {
  listing: Listing;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { transaction } = listing;
  const [form, setForm] = useState<TransactionForm>({
    salePrice: transaction.salePrice || null,
    commissionPct: transaction.commissionPct || null,
    commissionAmount: transaction.commissionAmount || null,
    closeProbability: transaction.closeProbability ?? null,
  });

  // Re-seed the working copy each time the dialog (re)opens for a deal.
  const [seededFor, setSeededFor] = useState("");
  const seedKey = `${listing.id}:${open}`;
  if (open && seedKey !== seededFor) {
    setForm({
      salePrice: transaction.salePrice || null,
      commissionPct: transaction.commissionPct || null,
      commissionAmount: transaction.commissionAmount || null,
      closeProbability: transaction.closeProbability ?? null,
    });
    setSeededFor(seedKey);
  }

  const setSalePrice = (v: number | null) =>
    setForm((f) => ({
      ...f,
      salePrice: v,
      commissionAmount:
        v != null && f.commissionPct != null
          ? commissionAmountFromPct(v, f.commissionPct)
          : f.commissionAmount,
    }));
  const setCommissionPct = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionPct: v,
      commissionAmount:
        v != null && f.salePrice != null
          ? commissionAmountFromPct(f.salePrice, v)
          : f.commissionAmount,
    }));
  const setCommissionAmount = (v: number | null) =>
    setForm((f) => ({
      ...f,
      commissionAmount: v,
      commissionPct:
        v != null && f.salePrice != null && f.salePrice > 0
          ? commissionPctFromAmount(f.salePrice, v)
          : f.commissionPct,
    }));

  const save = () => {
    updateDealTransaction(listing.id, {
      salePrice: form.salePrice ?? 0,
      commissionPct: form.commissionPct ?? 0,
      commissionAmount: form.commissionAmount ?? 0,
      closeProbability: form.closeProbability ?? 0,
    });
    onOpenChange(false);
  };

  const num = (e: React.ChangeEvent<HTMLInputElement>) =>
    e.target.value ? Number(e.target.value) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Edit Transaction</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <div className="d-flex flex-column gap-3">
              <Field>
                <Field.Label>Sale Price</Field.Label>
                <Input
                  type="number"
                  value={form.salePrice ?? ""}
                  onChange={(e) => setSalePrice(num(e))}
                />
              </Field>
              <Field>
                <Field.Label>Gross Commission %</Field.Label>
                <Input
                  type="number"
                  value={form.commissionPct ?? ""}
                  onChange={(e) => setCommissionPct(num(e))}
                />
              </Field>
              <Field>
                <Field.Label>Gross Commission ($)</Field.Label>
                <Input
                  type="number"
                  value={form.commissionAmount ?? ""}
                  onChange={(e) => setCommissionAmount(num(e))}
                />
              </Field>
              <Field>
                <Field.Label>Close Probability (%)</Field.Label>
                <Input
                  type="number"
                  value={form.closeProbability ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, closeProbability: num(e) }))
                  }
                />
              </Field>
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel variant="outline">Cancel</Dialog.Cancel>
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the pencil in `TransactionCard`**

In `src/components/deals/DealOverview.tsx`:

Add to the imports at the top:

```tsx
import { useState } from "react";
import { EditTransactionDialog } from "./EditTransactionDialog";
```

Replace the `TransactionCard` function (~lines 90–111) with:

```tsx
function TransactionCard({ listing }: { listing: Listing }) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <SectionCard
        title="Transaction"
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit transaction"
            onClick={() => setEditOpen(true)}
          >
            <FontAwesomeIcon icon={faPencil} />
          </Button>
        }
      >
        <Field label="Deal ID" value={listing.dealId} />
        <Field label="Sale Price" value={formatCurrency(listing.transaction.salePrice)} />
        <Field
          label="Price / SF"
          value={`$${listing.financials.pricePerSqFt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <Field label="Commission %" value={`${listing.transaction.commissionPct}%`} />
        <Field label="Commission $" value={formatCurrency(listing.transaction.commissionAmount)} />
        <Field label="Close Probability" value={`${listing.transaction.closeProbability}%`} />
      </SectionCard>
      <EditTransactionDialog listing={listing} open={editOpen} onOpenChange={setEditOpen} />
    </>
  );
}
```

> Note: this `Field` is the local presentational `Field` defined in `DealOverview.tsx` (label/value row), NOT Blueprint's `Field`. The dialog imports Blueprint's `Field` separately — the two do not collide because they live in different files.

- [ ] **Step 3: Typecheck / build**

Run: `bun --bun run build`
Expected: no TS errors. (No `useState` "declared but unused" — it's used in both the card and the dialog.)

- [ ] **Step 4: Manual verification (ask the user)**

Run: `bun --bun run dev`
Ask the user to: open a deal → Overview tab → click the Transaction card pencil → confirm the dialog opens, that editing % updates $, editing $ updates %, editing Sale Price updates $, and that Save persists to the card. Also open the "Move to Under Contract" gate on a sell-side deal and confirm the same trio behavior there.

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/EditTransactionDialog.tsx src/components/deals/DealOverview.tsx
git commit -m "feat(deals): edit transaction terms from the Transaction card pencil"
```

---

## Notes / Non-goals

- Changing `commissionAmount` does not recalculate broker splits, pre-split deductions, or receivables — out of scope per the design spec.
- The gate's `required` array is unchanged; the % field renders alongside the $ field via `req("commissionAmount")`, and satisfying Sale Price + either commission field fills the other.
