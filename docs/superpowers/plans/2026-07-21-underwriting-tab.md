# Underwriting Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated underwriting a stored, structured result on the deal, and add an Underwriting tab (under "Data", for qualifying asset classes) that shows the full breakdown and can generate / re-generate.

**Architecture:** Extract the deterministic figure engine (`buildCtx`) into a new pure module `underwritingResult.ts`, which also produces a stored `UnderwritingResult` (flat addressable `metrics` + plain-data `sections`). The editor keeps its existing rich table builders but imports the shared `buildCtx` (document output stays byte-identical). The new tab and future dynamic-field suggestions read the stored `result`. All three entry points (create-deal modal, Overview planner row, tab) compute through the same builder and persist through `updateListingUnderwriting`.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routes) · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Zustand + IndexedDB data store · Vitest.

## Global Constraints

- Package manager is Bun. Run tests with `bun --bun run test`.
- All UI uses Blueprint React components imported from the `ui` subpath; Bootstrap 5 utility classes for spacing/layout. No Tailwind.
- FontAwesome icons default to `pro-regular`. Never pass `fixedWidth` to `FontAwesomeIcon`.
- Figure logic must stay deterministic: no `Math.random`, no `Date.now()` / `new Date()` inside `underwritingResult.ts` (the editor rebuilds it repeatedly and relies on stable output). Timestamps are stamped by the store/UI layer only.
- Underwriting is gated to qualifying asset classes via the existing `propertyQualifiesForUnderwriting(property)` — reuse it, do not re-implement.
- Path alias `#/` → `src/`.
- Do not edit `src/routes/routeTree.gen.ts` (auto-generated).

---

### Task 1: Extract the shared figure engine (`buildCtx`)

Move the deterministic `Ctx` model out of the editor into a new pure module so both the editor and the new result builder share one figure source. No behavior change — the existing editor tests are the guard.

**Files:**
- Create: `src/components/deals/underwriting/underwritingResult.ts`
- Modify: `src/features/editor/underwritingPages.ts` (remove local `Ctx`/`buildCtx`; import from the new module)
- Test: `src/features/editor/underwritingPages.test.ts` (existing — used as regression guard)

**Interfaces:**
- Produces: `export interface Ctx { price: number; sqft: number; cap: number; noi: number; egi: number; opex: number; pgi: number; vacancy: number; rentPerSf: number; loan: number; debtService: number }` and `export function buildCtx(property: Property | undefined): Ctx`

- [ ] **Step 1: Create the shared module with `Ctx` + `buildCtx`**

Create `src/components/deals/underwriting/underwritingResult.ts` with exactly the logic currently in `underwritingPages.ts` (lines ~120-148):

```ts
import type { Property } from "#/data/types";

/** The deterministic figure model behind a deal's underwriting. */
export interface Ctx {
  price: number;
  sqft: number;
  cap: number;
  noi: number;
  egi: number;
  opex: number;
  pgi: number;
  vacancy: number;
  rentPerSf: number;
  loan: number;
  debtService: number;
}

/**
 * Back a full income + financing model out of a property's headline figures.
 * All values are FAKE but deterministic (no Math.random / Date) so repeated
 * builds are stable. Falls back to sensible constants for a bare property.
 */
export function buildCtx(property: Property | undefined): Ctx {
  const price = property && property.askingPrice > 0 ? property.askingPrice : 2_450_000;
  const sqft = property && property.buildingSqFt > 0 ? property.buildingSqFt : 42_000;
  const cap = property && property.capRate > 0 ? property.capRate : 0.062;
  const noi = Math.round(price * cap);
  const egi = Math.round(noi / 0.62);
  const opex = egi - noi;
  const pgi = Math.round(egi / 0.94);
  const vacancy = pgi - egi;
  const rentPerSf = Math.round((pgi / sqft) * 100) / 100;
  const loan = Math.round(price * 0.65);
  const debtService = Math.round(loan * 0.075);
  return { price, sqft, cap, noi, egi, opex, pgi, vacancy, rentPerSf, loan, debtService };
}
```

- [ ] **Step 2: Re-point the editor at the shared `buildCtx`**

In `src/features/editor/underwritingPages.ts`: delete the local `interface Ctx {…}` and `function buildCtx(…)` (lines ~120-148) and add to the imports near the top (next to the `strategies` import):

```ts
import { buildCtx, type Ctx } from "#/components/deals/underwriting/underwritingResult";
```

Leave every `SECTION_BUILDERS` function, `buildSummaryPage`, and `buildUnderwritingSection` unchanged — they still receive a `Ctx` exactly as before.

- [ ] **Step 3: Run the existing editor tests to verify no change**

Run: `bun --bun run test src/features/editor/underwritingPages.test.ts`
Expected: PASS (same output as before the move — the refactor is behavior-preserving).

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/underwriting/underwritingResult.ts src/features/editor/underwritingPages.ts
git commit -m "refactor(underwriting): extract shared buildCtx figure engine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Result types + `buildUnderwritingResult`

Add the stored-result types and the pure builder that turns a property + underwriting scope into flat `metrics` and plain-data `sections`.

**Files:**
- Modify: `src/data/types.ts` (add result types; extend `DealUnderwriting`)
- Modify: `src/components/deals/underwriting/underwritingResult.ts` (add `buildUnderwritingResult`)
- Test: `src/components/deals/underwriting/underwritingResult.test.ts` (create)

**Interfaces:**
- Consumes: `buildCtx`, `Ctx` (Task 1); `checksFor`, `coerceStrategy` from `./strategies`.
- Produces: `export function buildUnderwritingResult(property: Property | undefined, underwriting: DealUnderwriting): UnderwritingResult`; types `UnderwritingResult`, `UnderwritingMetric`, `UnderwritingResultSection`, `UnderwritingResultRow`.

- [ ] **Step 1: Add the result types to `types.ts`**

In `src/data/types.ts`, extend `DealUnderwriting` (add the two new optional fields after `placement`) and add the new interfaces directly below it:

```ts
export interface DealUnderwriting {
  strategy: UnderwritingStrategyId
  tier: string
  selectedChecks: number[]
  status?: 'not-started' | 'generating' | 'generated' | 'ready'
  placement?: { documentId?: string; documentName: string }

  /** The stored, structured output — computed once at generation, read by the tab + document + future dynamic fields. */
  result?: UnderwritingResult
  /** ISO timestamp of the last generation. Stamped by the store/UI layer, never the pure builder. */
  generatedAt?: string
}

/** A single addressable metric — the unit a future dynamic field references. */
export interface UnderwritingMetric {
  key: string
  label: string
  value: number
  display: string
  format: 'money' | 'percent' | 'number' | 'ratio' | 'sqft' | 'text'
}

/** One row of a breakdown section. `emphasis` marks a total/summary row. */
export interface UnderwritingResultRow {
  cells: string[]
  emphasis?: boolean
}

/** A plain-data breakdown table. `keyValue` = label/value pairs (no header row); `matrix` = a header row + data rows. */
export interface UnderwritingResultSection {
  key: string
  name: string
  kind: 'keyValue' | 'matrix'
  columns?: string[]
  rows: UnderwritingResultRow[]
}

export interface UnderwritingResult {
  strategy: UnderwritingStrategyId
  metrics: UnderwritingMetric[]
  sections: UnderwritingResultSection[]
  inputs: { address: string; askingPrice: number; buildingSqFt: number; capRate: number }
}
```

- [ ] **Step 2: Write the failing test**

Create `src/components/deals/underwriting/underwritingResult.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildUnderwritingResult } from './underwritingResult'
import { underwritingFromSelection, checksFor } from './strategies'
import type { Property } from '#/data/types'

const PROPERTY = {
  askingPrice: 4_000_000,
  buildingSqFt: 50_000,
  capRate: 0.06,
  street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701',
  propertyType: 'multifamily',
} as unknown as Property

describe('buildUnderwritingResult', () => {
  it('returns deterministic metrics + sections (stable across calls)', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0, 1, 2, 3, 4, 5, 6]))
    const a = buildUnderwritingResult(PROPERTY, uw)
    const b = buildUnderwritingResult(PROPERTY, uw)
    expect(a).toEqual(b)
  })

  it('includes headline + derived analytics in metrics', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0]))
    const keys = buildUnderwritingResult(PROPERTY, uw).metrics.map((m) => m.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'askingPrice', 'goingInCapRate', 'netOperatingIncome', 'buildingSize',
        'dscr', 'debtYield', 'loanAmount', 'reversionValue', 'stabilizedNOI',
      ]),
    )
  })

  it('emits one section per selected check, in strategy order', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0, 2]))
    const result = buildUnderwritingResult(PROPERTY, uw)
    const checks = checksFor('new-construction')
    expect(result.sections.map((s) => s.key)).toEqual([checks[0].key, checks[2].key])
  })

  it('formats a money metric with a $ display', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0]))
    const noi = buildUnderwritingResult(PROPERTY, uw).metrics.find((m) => m.key === 'netOperatingIncome')
    expect(noi?.display.startsWith('$')).toBe(true)
    expect(noi?.value).toBe(240_000) // 4_000_000 * 0.06
  })
})
```

- [ ] **Step 2b: Run it to verify it fails**

Run: `bun --bun run test src/components/deals/underwriting/underwritingResult.test.ts`
Expected: FAIL with "buildUnderwritingResult is not a function" (or export missing).

- [ ] **Step 3: Implement `buildUnderwritingResult`**

Append to `src/components/deals/underwriting/underwritingResult.ts`:

```ts
import type {
  DealUnderwriting,
  UnderwritingMetric,
  UnderwritingResult,
  UnderwritingResultSection,
  UnderwritingResultRow,
} from "#/data/types";
import { checksFor, coerceStrategy } from "./strategies";

// ── Formatters ────────────────────────────────────────────────────────────────
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (d: number) => `${(d * 100).toFixed(1)}%`;
const perSf = (n: number) => `$${n.toFixed(2)}`;

function metric(
  key: string,
  label: string,
  value: number,
  format: UnderwritingMetric["format"],
  display: string,
): UnderwritingMetric {
  return { key, label, value, display, format };
}

function row(cells: string[], emphasis = false): UnderwritingResultRow {
  return { cells, emphasis };
}

// ── Metrics (always the full set, independent of selected checks) ──────────────
function buildMetrics(c: Ctx): UnderwritingMetric[] {
  const dscr = c.noi / c.debtService;
  const exitCap = c.cap - 0.005;
  const reversion = Math.round(c.noi / exitCap / 10_000) * 10_000;
  const stabilizedNoi = Math.round(c.noi * 1.28);
  const stabilizedValue = Math.round(stabilizedNoi / c.cap / 10_000) * 10_000;
  const land = Math.round(c.price * 0.35);
  const hard = Math.round(c.sqft * 185);
  const soft = Math.round(hard * 0.18);
  const contingency = Math.round((hard + soft) * 0.05);
  const totalProjectCost = land + hard + soft + contingency;
  const equity = Math.round(c.price * 0.35);
  return [
    metric("askingPrice", "Asking Price", c.price, "money", money(c.price)),
    metric("goingInCapRate", "Going-In Cap Rate", c.cap, "percent", pct(c.cap)),
    metric("netOperatingIncome", "Net Operating Income", c.noi, "money", money(c.noi)),
    metric("buildingSize", "Building Size", c.sqft, "sqft", `${c.sqft.toLocaleString()} SF`),
    metric("potentialGrossIncome", "Potential Gross Income", c.pgi, "money", money(c.pgi)),
    metric("effectiveGrossIncome", "Effective Gross Income", c.egi, "money", money(c.egi)),
    metric("operatingExpenses", "Operating Expenses", c.opex, "money", money(c.opex)),
    metric("vacancyCreditLoss", "Vacancy & Credit Loss", c.vacancy, "money", money(c.vacancy)),
    metric("rentPerSf", "Rent / SF / yr", c.rentPerSf, "money", perSf(c.rentPerSf)),
    metric("loanAmount", "Loan Amount (65% LTV)", c.loan, "money", money(c.loan)),
    metric("debtService", "Annual Debt Service", c.debtService, "money", money(c.debtService)),
    metric("dscr", "Debt Service Coverage", dscr, "ratio", `${dscr.toFixed(2)}x`),
    metric("debtYield", "Debt Yield", c.noi / c.loan, "percent", pct(c.noi / c.loan)),
    metric("exitCapRate", "Exit Cap Rate", exitCap, "percent", pct(exitCap)),
    metric("reversionValue", "Projected Reversion Value", reversion, "money", money(reversion)),
    metric("stabilizedNOI", "Stabilized NOI", stabilizedNoi, "money", money(stabilizedNoi)),
    metric("stabilizedValue", "Stabilized Value", stabilizedValue, "money", money(stabilizedValue)),
    metric("totalProjectCost", "Total Project Cost", totalProjectCost, "money", money(totalProjectCost)),
    metric("totalEquity", "Total Equity", equity, "money", money(equity)),
    metric("targetEquityMultiple", "Target Equity Multiple", 1.9, "ratio", "1.9x"),
  ];
}

// ── Sections (plain data; one per selected check) ──────────────────────────────
const TENANTS = ["Northwind Traders", "Contoso Ltd.", "Fabrikam Retail", "Adventure Works"];

function keyValue(key: string, name: string, rows: [string, string][]): UnderwritingResultSection {
  return { key, name, kind: "keyValue", rows: rows.map(([l, v]) => row([l, v])) };
}

function projectInfo(c: Ctx, p: Property | undefined): UnderwritingResultSection {
  const type = p?.propertyType ?? "Multifamily";
  const year = p?.yearBuilt && p.yearBuilt > 0 ? String(p.yearBuilt) : "—";
  const zoning = p?.zoning || "Mixed-use (MU-2)";
  const lot = p?.lotSqFt && p.lotSqFt > 0 ? p.lotSqFt : Math.round(c.sqft * 1.8);
  const submarket = p?.submarket || "Central Business District";
  return keyValue("project-info", "Project Information", [
    ["Property Type", type],
    ["Submarket", submarket],
    ["Year Built", year],
    ["Building Size", `${c.sqft.toLocaleString()} SF`],
    ["Lot Size", `${lot.toLocaleString()} SF`],
    ["Zoning", zoning],
  ]);
}

function incomeExpenses(c: Ctx, key: string, name: string): UnderwritingResultSection {
  return keyValue(key, name, [
    ["Potential Gross Income", money(c.pgi)],
    ["Vacancy & Credit Loss", `(${money(c.vacancy)})`],
    ["Effective Gross Income", money(c.egi)],
    ["Operating Expenses", `(${money(c.opex)})`],
    ["Net Operating Income", money(c.noi)],
  ]);
}

function investmentCost(c: Ctx): UnderwritingResultSection {
  const land = Math.round(c.price * 0.35);
  const hard = Math.round(c.sqft * 185);
  const soft = Math.round(hard * 0.18);
  const contingency = Math.round((hard + soft) * 0.05);
  return keyValue("investment-cost", "Investment Cost Assumptions", [
    ["Land / Acquisition", money(land)],
    ["Hard Costs", money(hard)],
    ["Soft Costs", money(soft)],
    ["Contingency (5%)", money(contingency)],
    ["Total Project Cost", money(land + hard + soft + contingency)],
  ]);
}

function exitDisposition(c: Ctx): UnderwritingResultSection {
  const exitCap = c.cap - 0.005;
  const exitValue = Math.round(c.noi / exitCap / 10_000) * 10_000;
  return keyValue("exit-disposition", "Exit / Disposition Assumptions", [
    ["Hold Period", "5 years"],
    ["Exit Cap Rate", pct(exitCap)],
    ["Projected Reversion Value", money(exitValue)],
    ["Cost of Sale", "2.0%"],
  ]);
}

function financing(c: Ctx): UnderwritingResultSection {
  const dscr = c.noi / c.debtService;
  return keyValue("financing", "Financing Assumptions", [
    ["Loan Amount (65% LTV)", money(c.loan)],
    ["Interest Rate", "7.5%"],
    ["Amortization", "30 years"],
    ["Debt Service Coverage", `${dscr.toFixed(2)}x`],
    ["Debt Yield", pct(c.noi / c.loan)],
  ]);
}

function gpLpTerms(c: Ctx): UnderwritingResultSection {
  const equity = Math.round(c.price * 0.35);
  return keyValue("gp-lp-terms", "GP / LP Terms", [
    ["Total Equity", money(equity)],
    ["LP / GP Split", "90% / 10%"],
    ["Preferred Return", "8.0%"],
    ["Promote (above pref)", "20%"],
    ["Target Equity Multiple", "1.9x"],
  ]);
}

function unitMix(c: Ctx): UnderwritingResultSection {
  const units = Math.max(4, Math.round(c.sqft / 850));
  const studio = Math.round(units * 0.2);
  const one = Math.round(units * 0.45);
  const two = units - studio - one;
  const baseRent = Math.max(1200, Math.round((c.rentPerSf * 850) / 12));
  return {
    key: "unit-mix",
    name: "Unit Mix",
    kind: "matrix",
    columns: ["Unit Type", "Units", "Avg SF", "Proj. Rent / mo"],
    rows: [
      row(["Studio", String(studio), "520", money(baseRent * 0.8)]),
      row(["1 Bed / 1 Bath", String(one), "780", money(baseRent)]),
      row(["2 Bed / 2 Bath", String(two), "1,150", money(baseRent * 1.45)]),
      row(["Total", String(units), "—", "—"], true),
    ],
  };
}

function rentRoll(c: Ctx): UnderwritingResultSection {
  const unitSqft = Math.round(c.sqft / 5);
  const rates = [c.rentPerSf, c.rentPerSf - 1, c.rentPerSf + 1.5, c.rentPerSf - 0.5];
  const rows: UnderwritingResultRow[] = TENANTS.map((tenant, i) => {
    const rate = Math.max(8, rates[i]);
    return row([
      `Suite ${100 + i * 10}`,
      tenant,
      unitSqft.toLocaleString(),
      money((unitSqft * rate) / 12),
      perSf(rate),
    ]);
  });
  rows.push(row([`Suite 150`, "Vacant", unitSqft.toLocaleString(), "—", "—"]));
  return {
    key: "rent-roll",
    name: "Current Rent Roll",
    kind: "matrix",
    columns: ["Suite", "Tenant", "SF", "Rent / mo", "$/SF/yr"],
    rows,
  };
}

function renovationBudget(c: Ctx): UnderwritingResultSection {
  const units = Math.max(4, Math.round(c.sqft / 850));
  const perUnit = 22_500;
  const interior = units * perUnit;
  const common = Math.round(interior * 0.3);
  const exterior = Math.round(c.sqft * 6);
  return {
    key: "renovation-budget",
    name: "Renovation & Capex Budget",
    kind: "matrix",
    columns: ["Scope", "Basis", "Cost"],
    rows: [
      row(["Interior units", `${units} × ${money(perUnit)}`, money(interior)]),
      row(["Common areas", "Lump sum", money(common)]),
      row(["Exterior / systems", `${c.sqft.toLocaleString()} SF`, money(exterior)]),
      row(["Total Capex", "", money(interior + common + exterior)], true),
    ],
  };
}

function stabilizedProforma(c: Ctx): UnderwritingResultSection {
  const stabilizedNoi = Math.round(c.noi * 1.28);
  const stabilizedValue = Math.round(stabilizedNoi / c.cap / 10_000) * 10_000;
  const inPlaceValue = Math.round(c.noi / c.cap / 10_000) * 10_000;
  return {
    key: "stabilized-proforma",
    name: "Stabilized (Post-Reno) Pro-Forma",
    kind: "matrix",
    columns: ["Metric", "In-Place", "Stabilized"],
    rows: [
      row(["Effective Gross Income", money(c.egi), money(Math.round(c.egi * 1.22))]),
      row(["Net Operating Income", money(c.noi), money(stabilizedNoi)]),
      row(["Value @ Going-In Cap", money(inPlaceValue), money(stabilizedValue)]),
    ],
  };
}

/** Resolves each strategy check `key` to its plain-data section builder. */
const SECTIONS: Record<string, (c: Ctx, p: Property | undefined) => UnderwritingResultSection> = {
  "project-info": (c, p) => projectInfo(c, p),
  "unit-mix": (c) => unitMix(c),
  "income-expenses": (c) => incomeExpenses(c, "income-expenses", "Pro-Forma Income & Expenses"),
  "income-expenses-inplace": (c) => incomeExpenses(c, "income-expenses-inplace", "In-Place Income & Expenses"),
  "investment-cost": (c) => investmentCost(c),
  "exit-disposition": (c) => exitDisposition(c),
  financing: (c) => financing(c),
  "gp-lp-terms": (c) => gpLpTerms(c),
  "rent-roll": (c) => rentRoll(c),
  "renovation-budget": (c) => renovationBudget(c),
  "stabilized-proforma": (c) => stabilizedProforma(c),
};

function addressOf(p: Property | undefined): string {
  return p
    ? `${p.street}, ${p.city}, ${p.state} ${p.zip}`.replace(/\s+,/g, ",")
    : "123 Market Street, Dallas, TX 75201";
}

/**
 * Build the stored underwriting result: the full flat metric set plus one
 * plain-data section per SELECTED check (in strategy order). Pure + deterministic.
 */
export function buildUnderwritingResult(
  property: Property | undefined,
  underwriting: DealUnderwriting,
): UnderwritingResult {
  const c = buildCtx(property);
  const strategy = coerceStrategy(underwriting.strategy);
  const checks = checksFor(strategy);
  const sections = [...underwriting.selectedChecks]
    .filter((i) => i >= 0 && i < checks.length)
    .sort((a, b) => a - b)
    .map((i) => SECTIONS[checks[i].key])
    .filter((b): b is (c: Ctx, p: Property | undefined) => UnderwritingResultSection => Boolean(b))
    .map((build) => build(c, property));
  return {
    strategy,
    metrics: buildMetrics(c),
    sections,
    inputs: {
      address: addressOf(property),
      askingPrice: c.price,
      buildingSqFt: c.sqft,
      capRate: c.cap,
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/components/deals/underwriting/underwritingResult.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/components/deals/underwriting/underwritingResult.ts src/components/deals/underwriting/underwritingResult.test.ts
git commit -m "feat(underwriting): stored UnderwritingResult + pure builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Store helper to compute + persist the result

Add one store function that computes the result for a deal and persists it with a fresh timestamp, so every entry point stores identically.

**Files:**
- Modify: `src/data/store.ts` (add `generateUnderwritingResult`)
- Test: `src/data/store.underwriting.test.ts` (create)

**Interfaces:**
- Consumes: `buildUnderwritingResult` (Task 2); existing `getProperty`, `updateListingUnderwriting`, `getListing`.
- Produces: `export function generateUnderwritingResult(listingId: string): Listing | undefined` — computes the result from the deal's current underwriting scope + its property, then persists `{ result, generatedAt, status: 'ready' unless already generated }`.

- [ ] **Step 1: Write the failing test**

Create `src/data/store.underwriting.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDataStore } from './dataStore'
import { seedStore } from './seed'
import { getStore, updateListingUnderwriting, generateUnderwritingResult } from './store'

describe('generateUnderwritingResult', () => {
  beforeEach(() => { seedStore(true) })

  it('computes and stores a result + generatedAt on the deal', () => {
    const listing = [...getStore().listings.values()][0]
    updateListingUnderwriting(listing.id, {
      strategy: 'new-construction',
      tier: 'New Construction Strategy',
      selectedChecks: [0, 1, 2],
      status: 'generated',
    })

    const updated = generateUnderwritingResult(listing.id)

    expect(updated?.underwriting?.result).toBeDefined()
    expect(updated?.underwriting?.result?.metrics.length).toBeGreaterThan(0)
    expect(updated?.underwriting?.result?.sections.map((s) => s.key)).toHaveLength(3)
    expect(typeof updated?.underwriting?.generatedAt).toBe('string')
  })

  it('returns undefined for an unknown listing', () => {
    expect(generateUnderwritingResult('does-not-exist')).toBeUndefined()
  })
})
```

> Note: match the seed helper to the project's real export. If `seedStore(true)` is not the reseed signature, open `src/data/seed.ts` and use whatever the existing tests call (see `src/data/seed.test.ts`).

- [ ] **Step 2: Run it to verify it fails**

Run: `bun --bun run test src/data/store.underwriting.test.ts`
Expected: FAIL with "generateUnderwritingResult is not a function".

- [ ] **Step 3: Implement the helper**

In `src/data/store.ts`, add the import (with the other `#/components/deals/underwriting` imports or near the top):

```ts
import { buildUnderwritingResult } from "#/components/deals/underwriting/underwritingResult";
```

Then add below `updateListingUnderwriting`:

```ts
/**
 * Compute a deal's underwriting result from its current scope + property and
 * persist it with a fresh timestamp. The single path every entry point uses so
 * the stored result never diverges. Stamps `generatedAt` here (not in the pure
 * builder, which must stay deterministic).
 */
export function generateUnderwritingResult(listingId: string): Listing | undefined {
  const listing = useDataStore.getState().listings.get(listingId)
  if (!listing?.underwriting) return undefined
  const property = getProperty(listing.propertyId)
  const result = buildUnderwritingResult(property, listing.underwriting)
  return updateListingUnderwriting(listingId, {
    result,
    generatedAt: new Date().toISOString(),
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test src/data/store.underwriting.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/store.ts src/data/store.underwriting.test.ts
git commit -m "feat(underwriting): store helper to compute + persist result

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Persist the result from the Overview planner row

When the planner row finishes generating (`onComplete`), persist the structured result so the create-deal auto-start path and the manual planner path both produce stored data. UX is unchanged.

**Files:**
- Modify: `src/components/deals/underwriting/UnderwritingPlannerRow.tsx:159-169` (the `onComplete` handler)

**Interfaces:**
- Consumes: `generateUnderwritingResult` (Task 3).

- [ ] **Step 1: Import the helper**

In `src/components/deals/underwriting/UnderwritingPlannerRow.tsx`, extend the store import:

```ts
import { updateListingUnderwriting, generateUnderwritingResult } from "#/data/store";
```

- [ ] **Step 2: Persist the result on completion**

Replace the `onComplete` body (currently sets `status: 'generated'` then notifies) so it also builds + stores the result. The strategy/selection for this run are already persisted (set in `startGeneration`), so the helper reads the right scope:

```tsx
onComplete={() => {
  // Persist the structured result first, then flip to 'generated' so the
  // tab/document/dynamic-fields all read the same stored output.
  generateUnderwritingResult(listing.id);
  updateListingUnderwriting(listing.id, { status: "generated" });
  setPhase("generated");
  notify({
    title: "Underwriting ready",
    description: `Save it from ${listing.name}'s planner.`,
  });
}}
```

- [ ] **Step 3: Verify the suite still passes**

Run: `bun --bun run test`
Expected: PASS (no regressions; the row has no unit test of its own — the store + builder tests cover the new behavior).

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/underwriting/UnderwritingPlannerRow.tsx
git commit -m "feat(underwriting): planner row persists the structured result

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: The Underwriting tab (component, route, nav)

Add the tab route + component (empty / generating / ready states), a compute-on-read fallback for deals that have a status but no stored `result`, and the sidebar nav entry under "Data" gated to qualifying assets.

**Files:**
- Create: `src/routes/_shell/listings/$listingId/underwriting.tsx`
- Create: `src/components/deals/underwriting/DealUnderwritingTab.tsx`
- Modify: `src/components/properties/PropertyDetailSidebar.tsx` (add nav item under "Data", gated)

**Interfaces:**
- Consumes: `useDataStore`, `getListing`, `getProperty`, `generateUnderwritingResult` (Task 3); `propertyQualifiesForUnderwriting`; `UnderwritingDepth`, `UnderwritingProgress`, `UnderwritingPlacementModal`; `strategies` helpers; `buildUnderwritingResult` (fallback).

- [ ] **Step 1: Create the route**

Create `src/routes/_shell/listings/$listingId/underwriting.tsx` (mirrors the `financials.tsx` pattern):

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealUnderwritingTab } from "#/components/deals/underwriting/DealUnderwritingTab";

export const Route = createFileRoute("/_shell/listings/$listingId/underwriting")({
  component: UnderwritingRoute,
});

function UnderwritingRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealUnderwritingTab listing={listing} />;
}
```

- [ ] **Step 2: Create the tab component**

Create `src/components/deals/underwriting/DealUnderwritingTab.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles, faCalculator, faFileLines } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, UnderwritingResult, UnderwritingResultSection } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import {
  getProperty,
  updateListingUnderwriting,
  generateUnderwritingResult,
} from "#/data/store";
import { notify } from "#/lib/notify";
import { UnderwritingDepth } from "../UnderwritingDepth";
import { UnderwritingProgress } from "./UnderwritingProgress";
import { UnderwritingPlacementModal } from "./UnderwritingPlacementModal";
import { buildUnderwritingResult } from "./underwritingResult";
import {
  defaultSelectionFor,
  underwritingFromSelection,
  coerceStrategy,
  checksFor,
  strategyLabel,
  type UnderwritingStrategyId,
} from "./strategies";

type Phase = "idle" | "generating" | "generated" | "ready";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString();
}

export function DealUnderwritingTab({ listing: initial }: { listing: Listing }) {
  const navigate = useNavigate();
  // Reactive: reflect generation triggered from any entry point.
  const listing = useDataStore((s) => s.listings.get(initial.id)) ?? initial;
  const uw = listing.underwriting;

  const initialStrategy = (): UnderwritingStrategyId => coerceStrategy(uw?.strategy);
  const initialSelection = (strat: UnderwritingStrategyId) => {
    const count = checksFor(strat).length;
    const persisted = uw?.selectedChecks;
    return persisted?.length
      ? new Set(persisted.filter((i) => i >= 0 && i < count))
      : new Set(defaultSelectionFor(strat));
  };

  const [phase, setPhase] = useState<Phase>(
    uw?.status === "ready" ? "ready" : uw?.status === "generated" ? "generated" : uw?.status === "generating" ? "generating" : "idle",
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStrategy, setSetupStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  const [setupSelection, setSetupSelection] = useState<Set<number>>(() => initialSelection(initialStrategy()));
  const [runStrategy, setRunStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  const [runSelection, setRunSelection] = useState<Set<number>>(() => initialSelection(initialStrategy()));
  const [placementOpen, setPlacementOpen] = useState(false);

  // Compute-on-read fallback: a deal marked ready/generated with no stored
  // result (older data) gets one built + persisted once, so the breakdown shows.
  useEffect(() => {
    if ((uw?.status === "ready" || uw?.status === "generated") && !uw.result) {
      generateUnderwritingResult(listing.id);
    }
  }, [uw?.status, uw?.result, listing.id]);

  function openSetup() {
    const strat = initialStrategy();
    setSetupStrategy(strat);
    setSetupSelection(initialSelection(strat));
    setSetupOpen(true);
  }

  function startGeneration() {
    const sel = setupSelection.size > 0 ? setupSelection : new Set([0]);
    updateListingUnderwriting(listing.id, {
      ...underwritingFromSelection(setupStrategy, sel),
      status: "generating",
    });
    setRunStrategy(setupStrategy);
    setRunSelection(sel);
    setSetupOpen(false);
    setPhase("generating");
  }

  const result = uw?.result;

  return (
    <div className="p-4">
      {phase === "idle" && (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faCalculator} aria-label="Underwriting" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No underwriting yet</Empty.Title>
            Generate an AI underwriting breakdown for this deal — figures are
            estimated from property, market, and financial data for your review.
          </Empty.Content>
          <Empty.Actions>
            <Button variant="primary" onClick={openSetup}>
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Generate underwriting
            </Button>
          </Empty.Actions>
        </Empty>
      )}

      {phase === "generating" && (
        <div>
          <div className="fw-semibold mb-2">AI underwriting</div>
          <UnderwritingProgress
            strategy={runStrategy}
            selectedChecks={[...runSelection]}
            onComplete={() => {
              generateUnderwritingResult(listing.id);
              updateListingUnderwriting(listing.id, { status: "generated" });
              setPhase("generated");
              notify({ title: "Underwriting ready", description: "Save it to a document to finish." });
            }}
          />
        </div>
      )}

      {(phase === "generated" || phase === "ready") && result && (
        <UnderwritingBreakdown
          result={result}
          strategyLabel={strategyLabel(coerceStrategy(uw?.strategy))}
          generatedAt={uw?.generatedAt}
          saved={phase === "ready"}
          onRegenerate={openSetup}
          onSave={() => setPlacementOpen(true)}
          onViewInDocument={() =>
            navigate({
              to: "/editor/$listingId",
              params: { listingId: listing.id },
              search: { focus: "underwriting" },
            })
          }
        />
      )}

      {/* Depth setup — reuse the create-flow thoroughness control. */}
      <Modal open={setupOpen} onOpenChange={setSetupOpen}>
        <Modal.Content centered>
          <Modal.Header>
            <Modal.Title>Generate underwriting</Modal.Title>
            <Modal.Description>
              Set how thorough the underwriting should be. More checks means a deeper analysis — and a little longer to generate.
            </Modal.Description>
          </Modal.Header>
          <Modal.Body>
            <UnderwritingDepth
              strategy={setupStrategy}
              value={setupSelection}
              onStrategyChange={setSetupStrategy}
              onChange={setSetupSelection}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={setupSelection.size === 0} onClick={startGeneration}>
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              Start underwriting
            </Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>

      <UnderwritingPlacementModal
        open={placementOpen}
        onOpenChange={setPlacementOpen}
        listing={listing}
        onPlaced={() => setPhase("ready")}
      />
    </div>
  );
}

function UnderwritingBreakdown({
  result,
  strategyLabel,
  generatedAt,
  saved,
  onRegenerate,
  onSave,
  onViewInDocument,
}: {
  result: UnderwritingResult;
  strategyLabel: string;
  generatedAt?: string;
  saved: boolean;
  onRegenerate: () => void;
  onSave: () => void;
  onViewInDocument: () => void;
}) {
  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="h5 mb-1">{strategyLabel}</div>
          <div className="text-muted fs-small">
            {result.sections.length} {result.sections.length === 1 ? "analysis" : "analyses"}
            {generatedAt ? ` · Generated ${relativeTime(generatedAt)}` : ""} · reflects data for {result.inputs.address}
          </div>
        </div>
        <div className="d-flex gap-2 flex-shrink-0">
          {!saved && (
            <Button variant="primary" size="sm" onClick={onSave}>Save to document</Button>
          )}
          <Button variant="outline" size="sm" onClick={onRegenerate}>
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            Re-generate
          </Button>
          <Button variant="ghost" size="sm" onClick={onViewInDocument}>
            <FontAwesomeIcon icon={faFileLines} />
            View in document
          </Button>
        </div>
      </div>

      {/* Metrics grid — all addressable metrics, body-size bold figures. */}
      <div>
        <div className="fw-semibold mb-2">Key metrics</div>
        <div className="d-flex flex-wrap gap-4">
          {result.metrics.map((m) => (
            <div key={m.key} style={{ minWidth: 140 }}>
              <div className="text-muted fs-small">{m.label}</div>
              <div className="fw-bold">{m.display}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown tables — one per selected check. */}
      {result.sections.map((s) => (
        <SectionTable key={s.key} section={s} />
      ))}
    </div>
  );
}

function SectionTable({ section }: { section: UnderwritingResultSection }) {
  return (
    <div>
      <div className="fw-semibold mb-2">{section.name}</div>
      <Table>
        {section.kind === "matrix" && section.columns && (
          <Table.Header>
            <Table.Row>
              {section.columns.map((col, i) => (
                <Table.Head key={col} className={i === 0 ? undefined : "text-end"}>{col}</Table.Head>
              ))}
            </Table.Row>
          </Table.Header>
        )}
        <Table.Body>
          {section.rows.map((r, ri) => (
            <Table.Row key={ri}>
              {r.cells.map((cell, ci) => (
                <Table.Cell
                  key={ci}
                  className={[ci === 0 ? "" : "text-end", r.emphasis || (section.kind === "keyValue" && ci === 0) ? "fw-semibold" : ""].join(" ").trim() || undefined}
                >
                  {cell}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
```

> Verify the Blueprint `Table` subcomponent names (`Table.Header`, `Table.Head`, `Table.Body`, `Table.Row`, `Table.Cell`) against the Blueprint docs (https://buildoutinc.github.io/blueprint/llms.txt) or an existing table usage in the repo (e.g. grep `Table.` under `src/components`), and adjust if the API differs.

- [ ] **Step 3: Add the sidebar nav item (under "Data", gated)**

In `src/components/properties/PropertyDetailSidebar.tsx`:

Add `faCalculator` to the `pro-regular-svg-icons` import block, and import the gate at the top:

```ts
import { getListing, getProperty } from "#/data/store";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";
```

Add the nav item to the "Deal" group's `items` array, immediately after the `Data` entry:

```ts
      { label: "Data", href: "files", icon: faHardDrive },
      { label: "Underwriting", href: "underwriting", icon: faCalculator },
```

Then gate it in the `navGroups` filter (extend the existing `.filter`), so it only appears for qualifying assets or when a run already exists:

```ts
  const property = listing ? getProperty(listing.propertyId) : undefined;
  const showsUnderwriting =
    listing?.underwriting != null || propertyQualifiesForUnderwriting(property);

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "spaces") return canAddSpace;
      if (item.href === "underwriting") return showsUnderwriting;
      return true;
    }),
  }));
```

- [ ] **Step 4: Type-check + run the suite**

Run: `bun --bun run test`
Expected: PASS. Then scan the dev server / `tsc` output for TypeScript warnings and fix any (e.g. unused imports, Table API mismatch) before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/underwriting.tsx src/components/deals/underwriting/DealUnderwritingTab.tsx src/components/properties/PropertyDetailSidebar.tsx
git commit -m "feat(underwriting): Underwriting tab with full breakdown + regenerate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Seed version bump + manual smoke test

Bump the seed version so existing IndexedDB datasets regenerate cleanly, and run the human smoke test (no Playwright in this repo).

**Files:**
- Modify: `src/data/seed.ts` (`SEED_VERSION`)
- Modify: `src/data/seed.test.ts` (only if it asserts the version literal)

- [ ] **Step 1: Bump `SEED_VERSION`**

In `src/data/seed.ts`, increment `SEED_VERSION` by one (find its current value and add 1). This forces a reseed so any locally-stored deals with the old underwriting shape are regenerated.

- [ ] **Step 2: Update the seed test if needed**

Run: `bun --bun run test src/data/seed.test.ts`
If it fails only because it asserts the old `SEED_VERSION` literal, update that literal to match. If it passes, no change.

- [ ] **Step 3: Run the full suite**

Run: `bun --bun run test`
Expected: PASS (all suites).

- [ ] **Step 4: Commit**

```bash
git add src/data/seed.ts src/data/seed.test.ts
git commit -m "chore(data): bump SEED_VERSION for stored underwriting result

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Human smoke test**

Ask the user to run `bun --bun run dev`, clear IndexedDB (to reseed), and confirm:
1. On a **qualifying** deal (Multi-Family / Self Storage / Industrial Outdoor Storage), the **Underwriting** tab appears in the sidebar under **Data**; on a non-qualifying deal it does not.
2. Empty state → "Generate underwriting" → depth modal → progress → "Save to document" placement → breakdown renders (all metrics + one table per selected check).
3. **Re-generate** re-opens the depth modal pre-filled and rebuilds; the "Generated … ago" line updates.
4. A deal generated from the **create-deal modal** or the **Overview planner row** shows the same breakdown on the tab.
5. **View in document** opens the editor and the Underwriting section still renders as before.

---

## Self-Review

**Spec coverage:**
- Stored structured result → Task 2 (types + builder), Task 3 (persist). ✓
- Flat metrics + grouped tables → Task 2 (`metrics` + `sections`). ✓
- Shared source of truth / pure builder → Task 1 (`buildCtx`) + Task 2; editor keeps rich builders but shares `buildCtx` (documented refinement to the spec's "thin adapter" wording — same outcome, document byte-identical). ✓
- Underwriting tab under "Data", gated to qualifying assets, always present when qualifying → Task 5. ✓
- Three coexisting entry points funneling through one writer → Task 3 (`generateUnderwritingResult`) used by Task 4 (row) and Task 5 (tab); create-deal path flows through the row's auto-start. ✓
- Manual re-generate + "last generated" context → Task 5 (`UnderwritingBreakdown` header). ✓
- Placement modal kept in the flow → Task 5 (`UnderwritingPlacementModal`, "Save to document"). ✓
- "View in document" link → Task 5. ✓
- Editor consumes shared figures, output unchanged → Task 1. ✓
- Seed migration / `SEED_VERSION` → Task 6; compute-on-read fallback for legacy data → Task 5 Step 2. ✓
- Tests → Tasks 2, 3, 6. ✓

**Placeholder scan:** No TBD/TODO. Two explicit "verify against the real API" notes (seed reseed signature in Task 3; Blueprint `Table` subcomponent names in Task 5) — these are guardrails for API names the implementer must confirm in-repo, not deferred work; both name the exact file/doc to check.

**Type consistency:** `Ctx`/`buildCtx` (Task 1) consumed unchanged by Tasks 2. `buildUnderwritingResult(property, underwriting)` signature consistent across Tasks 2, 3, 5. `UnderwritingResult`/`UnderwritingMetric`/`UnderwritingResultSection`/`UnderwritingResultRow` defined in Task 1 Step 1 (types.ts) and used identically in Tasks 2 and 5. `generateUnderwritingResult(listingId)` defined in Task 3, called in Tasks 4 and 5. Section `key`s match strategy check keys from `strategies.ts`.
