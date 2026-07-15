# Gross Commission Derivation — Design

**Date:** 2026-07-15
**Status:** Approved (pending spec review)

## Problem

A deal's transaction carries `salePrice`, `commissionPct`, and `commissionAmount`
(all already on `DealTransaction`), but nothing in the UI links them. Today the
"Move to Under Contract" stage gate asks the broker to type **Sale Price** and
**Gross Commission ($)** as two independent numbers — there is no percent field,
and the dollar amount is not derived. The Transaction card's "Edit transaction"
pencil is a no-op.

Brokers think in terms of a commission **rate**: they enter a sale price and a
gross commission %, and expect the total gross commission $ to populate. They
also sometimes enter a flat dollar amount and expect the implied % to fall out.

## Goal

Make Sale Price, Gross Commission %, and Gross Commission $ a linked,
bi-directional trio wherever a broker sets a deal's transaction terms:

- Sale Price is the anchor.
- Editing **%** recalculates **$** (`salePrice × pct%`).
- Editing **$** recalculates **%** (`amount / salePrice × 100`, 2 decimals).
- Editing **Sale Price** recalculates **$** from the current %.

This appears in two places: the "Move to Under Contract" **stage gate** and a new
**Edit Transaction dialog** opened from the Transaction card pencil.

## Non-goals

- Changing `commissionAmount` does **not** cascade into broker splits
  (`internalBrokers[].grossCommission`), pre-split deductions, or receivables.
  Those retain their existing values. A future change can recalc splits.
- No new persisted fields — `commissionPct` already exists on `DealTransaction`.

## Components

### 1. Commission helper — `src/data/commission.ts` (new)

Pure functions, shared by the gate and the dialog so the math is identical:

```ts
/** Total gross commission $ from a sale price and rate. Rounded to whole dollars. */
export function commissionAmountFromPct(salePrice: number, pct: number): number

/** Implied gross commission % from a dollar amount. 2-decimal precision; 0 when salePrice <= 0. */
export function commissionPctFromAmount(salePrice: number, amount: number): number
```

- `commissionAmountFromPct` → `Math.round(salePrice * pct / 100)`
- `commissionPctFromAmount` → `salePrice > 0 ? Math.round(amount / salePrice * 10000) / 100 : 0`

Unit-tested (TDD) including the `salePrice = 0` guard and rounding cases.

### 2. Stage gate — `StageGate.tsx` + `stageGates.ts`

- Add `commissionPct: number | null` to `GateFormState` and `EMPTY_FORM`.
- Seed it from the deal on open (mirror the existing `salePrice`/`commissionAmount`
  hydration around `stageGates.ts:153`).
- Add a **Gross Commission %** `Input` between the Sale Price and Gross Commission
  $ fields, gated by `req("commissionPct")` following the existing pattern.
- Bi-directional handlers using the helper:
  - Sale Price change → recompute `commissionAmount` from current `commissionPct`.
  - `commissionPct` change → recompute `commissionAmount`.
  - `commissionAmount` change → recompute `commissionPct`.
- In `buildTransitionInput`, persist `commissionPct` into the `transaction` patch
  (alongside the existing `salePrice`/`commissionAmount`).
- `required` for the "Move to Under Contract" gate stays `['buyerLinked',
  'salePrice', 'commissionAmount']`; the % is a driver, and satisfying sale price
  plus either commission field fills the other.

### 3. Edit Transaction dialog — `EditTransactionDialog.tsx` (new)

- Blueprint `Dialog`, opened by the existing pencil `Button` in `TransactionCard`
  (`DealOverview.tsx:95`). `TransactionCard` gains local open state and renders
  the dialog.
- Fields (all bi-directional trio + one extra):
  - Sale Price
  - Gross Commission %
  - Gross Commission $
  - Close Probability (`%`, independent number input)
- Save commits through a new action `updateDealTransaction(dealId, patch:
  Partial<DealTransaction>)` in `actions.ts`, mirroring `updateDealMarketing`:
  `patchListing(dealId, (l) => ({ ...l, transaction: { ...l.transaction, ...patch } }))`.
  (Plain `updateDeal` would shallow-replace the whole `transaction` object.)
- Cancel discards the working copy.

## Data flow

1. Component holds a local working copy of the trio (+ close probability).
2. Each edit runs through the helper to keep the trio consistent.
3. On commit, the gate uses `commitStageTransition`; the dialog uses
   `updateDealTransaction`.
4. Zustand store updates; the deal detail / overview re-render reactively.

## Testing

- `commission.test.ts` — unit tests for both helper functions (TDD, written first).
- Update `useStageGate.test.ts` for the new `commissionPct` form field and the
  bi-directional recompute behavior.
- Manual verification (per CLAUDE.md, no Playwright): run the dev server, open the
  gate and the dialog, confirm the trio stays consistent and persists.
