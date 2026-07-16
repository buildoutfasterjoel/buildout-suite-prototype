# Deal Edit Page — Transaction Terms Section

**Date:** 2026-07-15
**Status:** Approved (pending spec review)

## Problem

The deal edit page (`/listings/$listingId/edit` → `DealMarketingEditor`) is meant to
be the single place a broker edits everything about a deal. But several transaction
fields that the stage gate and the new Edit Transaction dialog collect are **not
surfaced** on the edit page — even though the editor already loads and saves the
entire `transaction` object.

Today the editor surfaces only two transaction fields (Listed On, Listing
Expiration dates, in the "Setup & Status" section). Missing:

- Sale Price
- Gross Commission %
- Gross Commission $
- Close Probability
- Contract Executed date
- Close Date

A broker who wants to correct a sale price or commission must open the gate or the
Transaction-card dialog — the edit page, which claims to edit the whole deal,
silently omits them.

## Goal

Add a **Transaction Terms** section to `DealMarketingEditor` surfacing the six
missing fields, so the edit page reaches parity with the gate + Edit Transaction
dialog. Sale Price / Gross Commission % / Gross Commission $ behave as the same
bi-directional trio (sale price anchors) already built in `commission.ts`.

## Non-goals

- No data-layer changes. `DealMarketingEditor.save()` already commits the whole
  `transaction` via `updateDeal`; the new fields ride the existing working-copy
  state (`transaction` / `patchTransaction`).
- No Dead Reason field (that stays gate-only; a rarely-used field would clutter the
  everyday editor).
- No cascade into broker splits / deductions / receivables (same non-goal as the
  commission-derivation feature).
- Do NOT restructure the editor's existing sections or convert its native date
  inputs to a Calendar popover — match the surrounding code.

## Design

### One new section in `DealMarketingEditor.tsx`

Add a `<Section title="Transaction Terms">` placed **immediately after the
"Setup & Status" section** (before "Sale Marketing & Terms"), so the transacted
facts sit near the top of the editor rather than buried in sale-only marketing.
The section renders unconditionally (commission and close terms apply to both sale
and lease deals).

Fields, laid out in the editor's existing `<FieldGrid>` / `<Col>` grid, reusing the
editor's existing field-helper components:

| Field | Component | Wiring |
|---|---|---|
| Sale Price | `NumberField` | `setSalePrice` |
| Gross Commission % | `NumberField` | `setCommissionPct` |
| Gross Commission $ | `NumberField` | `setCommissionAmount` |
| Close Probability | `NumberField` | `patchTransaction({ closeProbability })` |
| Contract Executed | `DateField` | `patchTransaction({ contractExecutedDate })` |
| Close Date | `DateField` | `patchTransaction({ closeDate })` |

### Bi-directional commission handlers

Add three handlers in `DealMarketingEditor` mirroring the gate/dialog, but written
against the functional `setTransaction` updater so they read the current working
copy (`t`) rather than a possibly-stale closure:

```ts
const setSalePrice = (v: number | null) =>
  setTransaction((t) => ({
    ...t,
    salePrice: v ?? 0,
    commissionAmount:
      v != null && t.commissionPct != null
        ? commissionAmountFromPct(v, t.commissionPct)
        : t.commissionAmount,
  }));
const setCommissionPct = (v: number | null) =>
  setTransaction((t) => ({
    ...t,
    commissionPct: v ?? 0,
    commissionAmount:
      v != null && t.salePrice != null
        ? commissionAmountFromPct(t.salePrice, v)
        : t.commissionAmount,
  }));
const setCommissionAmount = (v: number | null) =>
  setTransaction((t) => ({
    ...t,
    commissionAmount: v ?? 0,
    commissionPct:
      v != null && t.salePrice > 0
        ? commissionPctFromAmount(t.salePrice, v)
        : t.commissionPct,
  }));
```

`transaction.salePrice`, `commissionPct`, `commissionAmount`, and `closeProbability`
are non-nullable `number` on `DealTransaction`, so a cleared input coalesces to `0`
(consistent with how the Edit Transaction dialog saves). The dates are
`string | null`.

Import the helpers: `import { commissionAmountFromPct, commissionPctFromAmount } from "#/data/commission";`

## Data flow

Unchanged from the existing editor: local working copy in `transaction` state →
each edit runs through a handler → `Save` commits the whole `transaction` via
`updateDeal` → store updates → routes reading the store reactively reflect it.

## Testing

- No new unit tests (the math helper is already covered by `commission.test.ts`;
  this task is UI wiring against existing, tested state/actions — consistent with
  the project's No-Playwright constraint for UI-only changes).
- Verify with `bunx tsc --noEmit` (no new errors beyond the pre-existing baseline)
  and `bun --bun run build`; full suite (`bun --bun run test`) stays green.
- Manual browser check: on the edit page, the Transaction Terms section shows the
  six fields prefilled from the deal; editing % updates $, editing $ updates %,
  editing Sale Price updates $; Save persists and the values appear on the
  Transaction tab / gate.
