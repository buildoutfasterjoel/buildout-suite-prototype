# Commission Forecast — design

**Date:** 2026-07-23
**Status:** Approved, ready for implementation plan

## Problem

Users told us the "Weighted forecast" stat — each deal's *value* discounted by its
close probability — isn't what they care about. They want to see **commission**:
how much the brokerage as a whole and they personally are on track to earn.

Replace every "Weighted forecast" surface with a **Commission Forecast** that shows
two probability-weighted figures side by side: **You** and **Brokerage**.

## The stat

Both figures are **probability-weighted** (expected commission), summed over a set of
deals:

- **Brokerage** = `Σ transaction.commissionAmount × (closeProbability / 100)`
  — the whole firm's expected gross commission on the deal.
- **You** = `Σ internalBrokers[0].grossCommission × (closeProbability / 100)`
  — the logged-in broker's expected share (the primary internal broker is treated
  as "you").

`closeProbability` already encodes lifecycle (Closed = 100%, Lost ≈ 0%), so a plain
weighted sum over a deal set behaves sensibly without special-casing stages.

**Known simplification:** "Brokerage" uses the full deal `commissionAmount` even when
an outside co-broker takes a slice. This is the intended reading for the prototype.
If we later want to net out co-brokers, it's a one-line change in the selector
(sum `internalBrokers[].grossCommission` instead of `transaction.commissionAmount`).

## Presentation

Both surfaces render the same two-figure block — two peer stats split by a vertical
divider, neither dominating:

```
COMMISSION FORECAST
$840K        |  $2.4M
You          |  Brokerage
```

Small uppercase "Commission forecast" label; two bold figures; a Blueprint
`Separator` (vertical) between them. Reuse the existing dashboard `StatCard` /
board-header stat styling so it reads as part of the same system.

## Components

### 1. Shared selector — `src/data/commission.ts`

Add a pure function so both surfaces share identical math and it's unit-testable
alongside the existing `commission.test.ts`:

```ts
export interface CommissionForecast {
  you: number
  brokerage: number
}

export function commissionForecast(deals: Listing[]): CommissionForecast
```

- Pure: takes a deal array, returns the two summed figures. No store access inside.
- Each deal always has at least one internal broker (seed and `createListing` both
  guarantee `internalBrokers[0]`), but guard with `?? 0` for safety.

### 2. Deals board — `src/routes/_shell/listings/index.tsx`

- Replace the `weightedForecast` `useMemo` with `commissionForecast(filtered)`
  (keep computing over `filtered`, so it stays search/facet-reactive as today).
- Replace the single "Weighted forecast" stat in the board-header row with the
  two-figure `You | Brokerage` block.
- Remove the now-unused `dealHeadlineValue`-based weighted computation if nothing
  else uses it (verify before deleting).

### 3. Dashboard card — `src/components/dashboard/ForecastSummaryCard.tsx`

- Read deals from the store: `getStore().listings.values()` inside a `useMemo`,
  matching the existing `YourListingsSection` pattern (read-once at mount is
  consistent with the rest of the dashboard).
- Compute `commissionForecast` over all deals.
- Replace the big "Weighted pipeline forecast" headline with the two-figure
  `You | Brokerage` block.
- **Keep** the existing Open pipeline / Open deals / Closed stats untouched.

### 4. Cleanup

- `src/components/dashboard/dashboardData.ts` — remove the now-unused
  `weightedTotal` from the `FORECAST` object.
- `src/routes/index.tsx` — update the prototype-index description text
  ("weighted pipeline forecast" → "commission forecast").

## Data source & consistency

Both surfaces call the same `commissionForecast` selector over real store deals, so
the numbers are internally consistent. The dashboard computes over all deals; the
Deals board computes over the currently-filtered set.

## Testing

- Unit tests for `commissionForecast` in `src/data/commission.test.ts`:
  - Empty deal list → `{ you: 0, brokerage: 0 }`.
  - Single deal: verifies both figures apply the `closeProbability` weighting.
  - Multiple deals: sums correctly across a mixed set.
  - A deal missing `internalBrokers[0]` contributes 0 to `you` (guard holds).
- Manual: dashboard card and Deals board both render the two-figure block; the
  Deals board figures react to filtering.

## Out of scope

- Netting out outside co-brokers from the brokerage figure (noted above).
- Tying seed deals to `CURRENT_USER` by identity — "you" = primary internal broker.
- Any change to the Open pipeline / Open deals / Closed stats.
