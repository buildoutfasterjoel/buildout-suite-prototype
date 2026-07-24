# Commission Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Weighted forecast" stat everywhere it appears with a "Commission forecast" showing two probability-weighted figures side by side — the logged-in broker's expected commission ("You") and the whole firm's ("Brokerage").

**Architecture:** A single pure selector, `commissionForecast(deals)`, computes both figures so the dashboard card and the Deals board share identical math. The Deals board computes over its filtered deal set; the dashboard computes over all deals read from the store (read-once at mount, matching the existing `YourListingsSection` pattern).

**Tech Stack:** React 19 · TypeScript · TanStack Start · Vitest · Blueprint React · Bun

## Global Constraints

- Package manager is Bun — run everything with `bun --bun run …`.
- UI uses Blueprint React components and Bootstrap 5 utility classes (no Tailwind).
- FontAwesome icons default to `pro-regular`; never pass `fixedWidth`.
- Both figures are probability-weighted: `value × (closeProbability / 100)`.
- "You" = `internalBrokers[0].grossCommission`; "Brokerage" = `transaction.commissionAmount`. Full deal commission for Brokerage even with an outside co-broker (intended simplification).
- Money is rendered with the existing `formatPrice` helper (`$840K`, `$2.4M`).

---

### Task 1: `commissionForecast` selector + unit tests

**Files:**
- Modify: `src/data/commission.ts` (append; currently ends at line 19)
- Test: `src/data/commission.test.ts` (append; currently ends at line 34)

**Interfaces:**
- Consumes: `Listing` type from `./types` (reads `transaction.commissionAmount`, `transaction.closeProbability`, `internalBrokers[0].grossCommission`).
- Produces:
  - `interface CommissionForecast { you: number; brokerage: number }`
  - `function commissionForecast(deals: Listing[]): CommissionForecast`

- [ ] **Step 1: Write the failing tests**

Append to `src/data/commission.test.ts`. Update the existing import on line 2 to also pull in the new symbols, and add a `Listing` import. The test builds minimal partial objects cast to `Listing` — the function only reads three fields, so a full record isn't needed.

```ts
import type { Listing } from "./types";
import { commissionForecast } from "./commission";

/** Minimal Listing stub exposing only the fields commissionForecast reads. */
function dealStub(
  commissionAmount: number,
  closeProbability: number,
  grossCommission: number | undefined,
): Listing {
  return {
    transaction: { commissionAmount, closeProbability },
    internalBrokers: grossCommission == null ? [] : [{ grossCommission }],
  } as unknown as Listing;
}

describe("commissionForecast", () => {
  it("returns zeros for an empty deal list", () => {
    expect(commissionForecast([])).toEqual({ you: 0, brokerage: 0 });
  });

  it("weights a single deal by close probability", () => {
    // brokerage = 100000 * 0.5 = 50000; you = 60000 * 0.5 = 30000
    expect(commissionForecast([dealStub(100_000, 50, 60_000)])).toEqual({
      you: 30_000,
      brokerage: 50_000,
    });
  });

  it("sums weighted figures across multiple deals", () => {
    const deals = [
      dealStub(100_000, 50, 60_000), // brokerage 50000, you 30000
      dealStub(200_000, 100, 80_000), // brokerage 200000, you 80000
    ];
    expect(commissionForecast(deals)).toEqual({
      you: 110_000,
      brokerage: 250_000,
    });
  });

  it("contributes 0 to 'you' when a deal has no internal broker", () => {
    expect(commissionForecast([dealStub(100_000, 100, undefined)])).toEqual({
      you: 0,
      brokerage: 100_000,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- src/data/commission.test.ts`
Expected: FAIL — `commissionForecast` is not exported / not a function.

- [ ] **Step 3: Implement the selector**

Append to `src/data/commission.ts`:

```ts
import type { Listing } from "./types";

/** The two probability-weighted commission figures shown in the forecast stat. */
export interface CommissionForecast {
  /** The logged-in broker's expected share (primary internal broker). */
  you: number;
  /** The whole firm's expected gross commission on the deals. */
  brokerage: number;
}

/**
 * Expected commission across a set of deals, each figure discounted by the deal's
 * close probability. "Brokerage" is the full deal gross commission; "You" is the
 * primary internal broker's share (treated as the logged-in user).
 */
export function commissionForecast(deals: Listing[]): CommissionForecast {
  return deals.reduce<CommissionForecast>(
    (acc, deal) => {
      const p = deal.transaction.closeProbability / 100;
      acc.brokerage += deal.transaction.commissionAmount * p;
      acc.you += (deal.internalBrokers[0]?.grossCommission ?? 0) * p;
      return acc;
    },
    { you: 0, brokerage: 0 },
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test -- src/data/commission.test.ts`
Expected: PASS — all four new tests plus the existing eight.

- [ ] **Step 5: Commit**

```bash
git add src/data/commission.ts src/data/commission.test.ts
git commit -m "feat(commission): add probability-weighted commissionForecast selector

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Deals board — swap the stat

**Files:**
- Modify: `src/routes/_shell/listings/index.tsx` (imports near line 20–45; `weightedForecast` memo at 298–305; stat markup at 480–490)

**Interfaces:**
- Consumes: `commissionForecast` and `CommissionForecast` from Task 1; existing `formatPrice`; Blueprint `Separator`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the imports**

Add a `Separator` import (the file does not currently import it) alongside the other Blueprint `ui` imports, and import the selector from the data layer:

```tsx
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { commissionForecast } from "#/data/commission";
```

- [ ] **Step 2: Replace the weighted memo with the commission memo**

Replace the `weightedForecast` `useMemo` (currently lines 298–305) with:

```tsx
  // Commission forecast: each deal's commission discounted by its close
  // probability (Closed = 100%, Lost ≈ 0%), split between the logged-in broker
  // ("you") and the whole firm ("brokerage"), over the visible deals.
  const commission = useMemo(() => commissionForecast(filtered), [filtered]);
```

Note: `dealHeadlineValue` is still used for sorting (lines 275, 277) — leave that import and those usages intact.

- [ ] **Step 3: Replace the stat markup**

Replace the "Weighted forecast" block (currently lines 480–490) with the two-figure block:

```tsx
                <div className="d-flex align-items-center gap-3">
                  <span
                    className="text-muted fs-xs text-uppercase"
                    style={{ letterSpacing: "0.04em" }}
                  >
                    Commission forecast
                  </span>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-5">
                      {formatPrice(commission.you)}
                    </span>
                    <span className="text-muted fs-xs">You</span>
                  </div>
                  <Separator orientation="vertical" style={{ height: "1.5rem" }} />
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fw-bold fs-5">
                      {formatPrice(commission.brokerage)}
                    </span>
                    <span className="text-muted fs-xs">Brokerage</span>
                  </div>
                </div>
```

- [ ] **Step 4: Typecheck and verify no stale references**

Run: `bun --bun run build`
Expected: build succeeds with no TypeScript errors. Confirm there are no remaining references to `weightedForecast`:

Run: `grep -n weightedForecast src/routes/_shell/listings/index.tsx`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_shell/listings/index.tsx
git commit -m "feat(deals): show Commission forecast (You + Brokerage) on the board

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Dashboard card + cleanup

**Files:**
- Modify: `src/components/dashboard/ForecastSummaryCard.tsx`
- Modify: `src/components/dashboard/dashboardData.ts` (remove `weightedTotal` from `FORECAST`, lines 45–50)
- Modify: `src/routes/index.tsx` (description text, line 63)

**Interfaces:**
- Consumes: `commissionForecast` from Task 1; `getStore` from `#/data/store`; existing `formatPrice`; the existing `FORECAST` (still provides `openPipeline`, `openDeals`, `closedValue`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Rewrite the card to compute live and render two figures**

Edit `src/components/dashboard/ForecastSummaryCard.tsx`. Add imports:

```tsx
import { useMemo } from "react";
import { getStore } from "#/data/store";
import { commissionForecast } from "#/data/commission";
import { formatPrice } from "#/components/properties/propertyDisplay";
```

Inside `ForecastSummaryCard`, compute the figures over all deals (read-once at mount, matching `YourListingsSection`):

```tsx
  const commission = useMemo(
    () => commissionForecast([...getStore().listings.values()]),
    [],
  );
```

Replace the big "Weighted pipeline forecast" block (currently lines 43–48 — the `<div className="d-flex flex-column">` holding `FORECAST.weightedTotal`) with the two-figure block:

```tsx
        <div className="d-flex flex-column">
          <span
            className="text-muted fs-xs text-uppercase"
            style={{ letterSpacing: "0.04em" }}
          >
            Commission forecast
          </span>
          <div className="d-flex align-items-baseline gap-4 mt-1">
            <div className="d-flex flex-column">
              <span className="fs-2 fw-bold" style={{ lineHeight: 1.1 }}>
                {formatPrice(commission.you)}
              </span>
              <span className="text-muted">You</span>
            </div>
            <Separator orientation="vertical" />
            <div className="d-flex flex-column">
              <span className="fs-2 fw-bold" style={{ lineHeight: 1.1 }}>
                {formatPrice(commission.brokerage)}
              </span>
              <span className="text-muted">Brokerage</span>
            </div>
          </div>
        </div>
```

Leave the trailing stat group (Open pipeline / Open deals / Closed) unchanged.

- [ ] **Step 2: Remove the now-unused `weightedTotal`**

In `src/components/dashboard/dashboardData.ts`, delete the `weightedTotal` line from the `FORECAST` object (lines 45–50) so it reads:

```ts
export const FORECAST = {
  openPipeline: "$27.0M",
  openDeals: 5,
  closedValue: "$12.4M",
};
```

- [ ] **Step 3: Update the prototype-index description**

In `src/routes/index.tsx`, change the Suite Home Dashboard card description (line 63) from "weighted pipeline forecast" to "commission forecast":

```tsx
                Broker home dashboard — commission forecast, a
                seller-signal-to-close pipeline snapshot, an AI-surfaced focus
                signal, today's tasks, listing engagement, and recent activity.
```

- [ ] **Step 4: Typecheck and verify no stale references**

Run: `bun --bun run build`
Expected: build succeeds with no TypeScript errors.

Run: `grep -rni "weightedTotal\|weighted forecast\|weighted pipeline forecast" src/components/dashboard src/routes`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/ForecastSummaryCard.tsx src/components/dashboard/dashboardData.ts src/routes/index.tsx
git commit -m "feat(dashboard): Commission forecast card computed live from the store

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Shared selector (spec §Components 1) → Task 1. ✔
- Deals board swap (spec §Components 2) → Task 2. ✔
- Dashboard card live compute (spec §Components 3) → Task 3, Step 1. ✔
- Cleanup — `weightedTotal` + index copy (spec §Components 4) → Task 3, Steps 2–3. ✔
- Probability weighting, You/Brokerage definitions, presentation → encoded in Global Constraints + Task 1 selector + Tasks 2–3 markup. ✔
- Testing (spec §Testing) → Task 1 unit tests cover empty/single/multiple/missing-broker. ✔
- Known simplification (full commission for Brokerage) → Global Constraints. ✔

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✔

**Type consistency:** `commissionForecast(deals: Listing[]): CommissionForecast` with `{ you, brokerage }` used identically in Task 1 (definition + tests), Task 2 (`commission.you` / `commission.brokerage`), and Task 3 (same). `formatPrice` signature matches its definition. ✔
