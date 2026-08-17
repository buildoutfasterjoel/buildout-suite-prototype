# Pipeline Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pipeline Report at `/reports/pipeline` — a filterable, sortable, paginated table of deals — and extract the one shared piece (`ReportShell`) that the other seventeen catalog reports will wear.

**Architecture:** Pure logic (row derivation, filtering, totals) lives in two `.ts` modules under `components/reports/pipeline/` with Vitest coverage. Presentation lives in three `.tsx` components composed by a route that deliberately un-nests from the `/reports` layout via a trailing-underscore directory. `ReportShell` owns only the header band; everything else is Pipeline's own and deliberately not generic.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file routes) · Blueprint React (`Select`, `Table`, `Modal`, `Pagination`, `DropdownMenu`, `Breadcrumb`, `Button`) · FontAwesome Pro Regular · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-08-17-pipeline-report-design.md`

## Global Constraints

- **Package manager is Bun.** Always `bun --bun run <script>`. Never npm/yarn/pnpm.
- **Type-check with `bunx tsc --noEmit`.** `vite build` does NOT type-check — it is not a gate.
- **Test with `bun --bun run test`.** A `module is not defined` stderr line from `node_modules/react/index.js` is known-harmless noise, not a failure. Judge by the `Test Files` / `Tests` summary and the exit code.
- **This repo has ZERO React component tests** — 123 `.test.ts`, 0 `.test.tsx`. Logic goes in Vitest; components are verified in the browser. **Do not add React Testing Library, `@playwright/test`, or `playwright.config.ts`.** TDD in this plan therefore applies to Tasks 1–2 (the `.ts` modules); Tasks 3–6 are verified in the browser.
- **Blueprint components only** for UI; import from the `ui` subpath, e.g. `import { Select } from "@buildoutinc/blueprint-react/ui/Select"`.
- **FontAwesome `pro-regular` by default.** Never pass `fixedWidth` — it is deprecated in this codebase.
- **Path alias:** `#/` → `src/`.
- **Bootstrap 5 utility classes** for spacing/layout. Blueprint's SCSS var prefix is `--bp-`, not `--bs-`.
- **Never edit `src/routeTree.gen.ts`** — it regenerates when the dev server or a build runs.
- **Stage vocabulary is `proposal | active | under-contract | closed | inactive`**, labelled by `STATUS_LABELS` as **Pitching · Active · Under Contract · Closed · Lost**. Do not introduce the reference screenshot's Evaluating/On Market/Transacting/Dead.
- **Deal links must go through `dealCardLinkProps`** from `#/components/deals/dealCardLink`. An invariant test enforces this; hand-rolling `/listings/{id}` breaks child space deals.
- Commit after every task with a `type(scope): subject` message.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/reports/pipeline/pipelineRows.ts` | `Listing` → `PipelineRow`; office resolution; umbrella exclusion; report currency formatting; totals |
| `src/components/reports/pipeline/pipelineRows.test.ts` | Vitest for the above |
| `src/components/reports/pipeline/pipelineFilters.ts` | Filter state shape, defaults, predicate, chips, reset |
| `src/components/reports/pipeline/pipelineFilters.test.ts` | Vitest for the above |
| `src/components/reports/ReportShell.tsx` | **Shared** header band: breadcrumb, title, Actions, Save As |
| `src/components/reports/pipeline/PipelineReportTable.tsx` | Summary row, sortable headers, rows, pagination |
| `src/components/reports/pipeline/PipelineFilterBar.tsx` | One-row inline filters + active-filter chips + All Filters trigger |
| `src/components/reports/pipeline/PipelineFilterModal.tsx` | All Filters modal — every control |
| `src/routes/_shell/reports_/pipeline.tsx` | Route; owns filter + sort + page state, composes the rest |
| `src/components/reports/ReportRow.tsx` | *Modify* — optional `to` prop so a catalog card can link |
| `src/routes/_shell/reports/standard.tsx` | *Modify* — link the Pipeline card |

---

### Task 1: Row derivation, office resolution, and totals

**Files:**
- Create: `src/components/reports/pipeline/pipelineRows.ts`
- Test: `src/components/reports/pipeline/pipelineRows.test.ts`

**Interfaces:**
- Consumes: `Listing`, `Property`, `PropertyStatus`, `PropertyType`, `DealType`, `DealSide` from `#/data/types`; `getProperty` from `#/data/store`; `isUmbrella` from `#/data/leaseSpaces`; `SEED_ROSTER` from `#/data/roster`.
- Produces:
  - `interface PipelineRow` (fields listed in Step 3)
  - `officeForDeal(deal: Listing): string | null`
  - `toPipelineRow(deal: Listing, property: Property | undefined): PipelineRow`
  - `pipelineRows(deals: Listing[]): PipelineRow[]`
  - `formatReportCurrency(value: number | null): string`
  - `pipelineTotals(rows: PipelineRow[]): { count: number; transactionValue: number; brokerageGross: number }`

> **Why a new currency formatter:** the existing `formatPrice` abbreviates (`$4.8M`). A report needs the exact `$4,810,000.00` the reference shows, and must distinguish `--` (no value) from `$0.00` (a real zero).

> **`isUmbrella` takes a listing's `id`, not its `dealId` field.** It is declared as `isUmbrella(dealId: string)` but compares against `parentDealId`, which stores listing ids. The Deals list calls it as `isUmbrella(l.id)`. Follow that.

- [ ] **Step 1: Write the failing test**

Create `src/components/reports/pipeline/pipelineRows.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Listing, Property } from "#/data/types";
import {
  officeForDeal,
  toPipelineRow,
  formatReportCurrency,
  pipelineTotals,
  type PipelineRow,
} from "./pipelineRows";
import { SEED_ROSTER } from "#/data/roster";

/** Minimal Listing — the repo's established test idiom for this type. */
function deal(over: Partial<Listing> = {}): Listing {
  return {
    id: "l1",
    dealId: "100",
    name: "123 Main Street",
    status: "active",
    dealType: "Lease",
    dealSide: "seller",
    parentDealId: null,
    propertyId: "p1",
    internalBrokers: [],
    transaction: { salePrice: 0, commissionAmount: 0, closeDate: null },
    ...over,
  } as unknown as Listing;
}

function property(over: Partial<Property> = {}): Property {
  return {
    id: "p1",
    city: "Chicago",
    state: "IL",
    propertyType: "office",
    ...over,
  } as unknown as Property;
}

describe("formatReportCurrency", () => {
  it("writes exact dollars and cents, not an abbreviation", () => {
    expect(formatReportCurrency(4810000)).toBe("$4,810,000.00");
    expect(formatReportCurrency(143994.24)).toBe("$143,994.24");
  });

  it("distinguishes a real zero from a missing value", () => {
    expect(formatReportCurrency(0)).toBe("$0.00");
    expect(formatReportCurrency(null)).toBe("--");
  });
});

describe("officeForDeal", () => {
  it("resolves the lead internal broker's office", () => {
    const lead = SEED_ROSTER[0];
    const row = officeForDeal(
      deal({ internalBrokers: [{ name: lead.name }] as never }),
    );
    expect(row).toBe(lead.office);
  });

  it("is null when the deal has no internal broker", () => {
    expect(officeForDeal(deal({ internalBrokers: [] }))).toBeNull();
  });

  it("is null when the broker matches nobody on the roster", () => {
    const row = officeForDeal(
      deal({ internalBrokers: [{ name: "Nobody At All" }] as never }),
    );
    expect(row).toBeNull();
  });
});

describe("toPipelineRow", () => {
  it("flattens a deal and its property into one row", () => {
    const r = toPipelineRow(
      deal({
        transaction: {
          salePrice: 4810000,
          commissionAmount: 144300,
          closeDate: "2026-09-01",
        } as never,
      }),
      property(),
    );
    expect(r.dealId).toBe("100");
    expect(r.name).toBe("123 Main Street");
    expect(r.stage).toBe("active");
    expect(r.city).toBe("Chicago");
    expect(r.state).toBe("IL");
    expect(r.propertyType).toBe("office");
    expect(r.transactionValue).toBe(4810000);
    expect(r.brokerageGross).toBe(144300);
    expect(r.closeDate).toBe("2026-09-01");
  });

  it("keeps the listing id, which links need, distinct from the displayed dealId", () => {
    const r = toPipelineRow(deal({ id: "uuid-abc", dealId: "421" }), property());
    expect(r.listingId).toBe("uuid-abc");
    expect(r.dealId).toBe("421");
  });

  it("nulls the property columns when the property is missing", () => {
    const r = toPipelineRow(deal(), undefined);
    expect(r.city).toBeNull();
    expect(r.state).toBeNull();
    expect(r.propertyType).toBeNull();
  });
});

describe("pipelineTotals", () => {
  it("counts rows and sums both money columns", () => {
    const rows = [
      { transactionValue: 100, brokerageGross: 10 },
      { transactionValue: 250, brokerageGross: 25 },
    ] as PipelineRow[];
    expect(pipelineTotals(rows)).toEqual({
      count: 2,
      transactionValue: 350,
      brokerageGross: 35,
    });
  });

  it("totals an empty set to zero rather than NaN", () => {
    expect(pipelineTotals([])).toEqual({
      count: 0,
      transactionValue: 0,
      brokerageGross: 0,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test pipelineRows`
Expected: FAIL — `Failed to resolve import "./pipelineRows"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/reports/pipeline/pipelineRows.ts`:

```ts
import type {
  DealSide,
  DealType,
  Listing,
  Property,
  PropertyStatus,
  PropertyType,
} from "#/data/types";
import { getProperty } from "#/data/store";
import { isUmbrella } from "#/data/leaseSpaces";
import { SEED_ROSTER } from "#/data/roster";

/** One deal, flattened to exactly the columns the Pipeline Report shows. */
export interface PipelineRow {
  /** Listing id — what links resolve against. Not the displayed number. */
  listingId: string;
  /** The human-facing sequential deal number, e.g. "100". */
  dealId: string;
  name: string;
  stage: PropertyStatus;
  dealType: DealType;
  dealSide: DealSide;
  propertyType: PropertyType | null;
  city: string | null;
  state: string | null;
  office: string | null;
  brokers: string[];
  transactionValue: number;
  brokerageGross: number;
  closeDate: string | null;
}

/**
 * Exact dollars and cents. Deliberately not `formatPrice`, which abbreviates to
 * "$4.8M" — a report column is read as a figure, not a headline.
 *
 * `--` and `$0.00` mean different things and both appear in the reference: no
 * value on the record versus a real zero. Collapsing them loses information.
 */
export function formatReportCurrency(value: number | null): string {
  if (value == null) return "--";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A deal has no office of its own, so it inherits its lead internal broker's.
 *
 * Returns null rather than defaulting to an office: filing an unassigned deal
 * under a real office would quietly make that office's numbers wrong, and the
 * Office Leaderboard Report will read the same derivation.
 */
export function officeForDeal(deal: Listing): string | null {
  const lead = deal.internalBrokers[0];
  if (!lead) return null;
  return SEED_ROSTER.find((u) => u.name === lead.name)?.office ?? null;
}

export function toPipelineRow(
  deal: Listing,
  property: Property | undefined,
): PipelineRow {
  return {
    listingId: deal.id,
    dealId: deal.dealId,
    name: deal.name,
    stage: deal.status,
    dealType: deal.dealType,
    dealSide: deal.dealSide,
    propertyType: property?.propertyType ?? null,
    city: property?.city ?? null,
    state: property?.state ?? null,
    office: officeForDeal(deal),
    brokers: deal.internalBrokers.map((b) => b.name),
    transactionValue: deal.transaction.salePrice,
    brokerageGross: deal.transaction.commissionAmount,
    closeDate: deal.transaction.closeDate,
  };
}

/**
 * Every reportable deal, umbrella shells excluded.
 *
 * A shell and its child space deals would otherwise both appear, overstating
 * Count and double-counting the same money in both total columns. The Deals
 * list excludes shells for the same reason.
 */
export function pipelineRows(deals: Listing[]): PipelineRow[] {
  return deals
    .filter((d) => !isUmbrella(d.id))
    .map((d) => toPipelineRow(d, getProperty(d.propertyId)));
}

export function pipelineTotals(rows: PipelineRow[]): {
  count: number;
  transactionValue: number;
  brokerageGross: number;
} {
  return {
    count: rows.length,
    transactionValue: rows.reduce((n, r) => n + r.transactionValue, 0),
    brokerageGross: rows.reduce((n, r) => n + r.brokerageGross, 0),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test pipelineRows`
Expected: PASS, 10 tests.

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/reports/pipeline/pipelineRows.ts src/components/reports/pipeline/pipelineRows.test.ts
git commit -m "feat(reports): derive Pipeline Report rows from deals"
```

---

### Task 2: Filter state, predicate, and chips

**Files:**
- Create: `src/components/reports/pipeline/pipelineFilters.ts`
- Test: `src/components/reports/pipeline/pipelineFilters.test.ts`

**Interfaces:**
- Consumes: `PipelineRow` from `./pipelineRows`; `STATUS_LABELS`, `TYPE_LABELS` from `#/components/properties/propertyDisplay`.
- Produces:
  - `type CloseDatePreset = "this-quarter" | "this-year" | "next-90" | "past"`
  - `interface PipelineFilterState`
  - `const EMPTY_PIPELINE_FILTERS: PipelineFilterState`
  - `interface PipelineFilterChip { key: string; label: string; clear: (s: PipelineFilterState) => PipelineFilterState }`
  - `applyPipelineFilters(rows: PipelineRow[], f: PipelineFilterState, today: Date): PipelineRow[]`
  - `pipelineFilterChips(f: PipelineFilterState): PipelineFilterChip[]`
  - `hasActivePipelineFilters(f: PipelineFilterState): boolean`

> **`today` is a parameter, not `new Date()` inside.** Date-relative presets are untestable otherwise. The route passes `DASHBOARD_TODAY` from `#/components/dashboard/dashboardData`, which is what the rest of the prototype treats as "today".

- [ ] **Step 1: Write the failing test**

Create `src/components/reports/pipeline/pipelineFilters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PipelineRow } from "./pipelineRows";
import {
  EMPTY_PIPELINE_FILTERS,
  applyPipelineFilters,
  pipelineFilterChips,
  hasActivePipelineFilters,
} from "./pipelineFilters";

const TODAY = new Date(2026, 7, 17); // 17 Aug 2026 — Q3

function row(over: Partial<PipelineRow> = {}): PipelineRow {
  return {
    listingId: "l1",
    dealId: "100",
    name: "123 Main Street",
    stage: "active",
    dealType: "Lease",
    dealSide: "seller",
    propertyType: "office",
    city: "Chicago",
    state: "IL",
    office: "Chicago — West Loop",
    brokers: ["Ethan Delgado"],
    transactionValue: 0,
    brokerageGross: 0,
    closeDate: null,
    ...over,
  };
}

describe("applyPipelineFilters", () => {
  it("returns every row when nothing is set", () => {
    const rows = [row(), row({ dealId: "101" })];
    expect(applyPipelineFilters(rows, EMPTY_PIPELINE_FILTERS, TODAY)).toHaveLength(2);
  });

  it("searches name, city, state and the deal id", () => {
    const rows = [
      row({ dealId: "100", name: "123 Main Street", city: "Chicago" }),
      row({ dealId: "205", name: "Westgate Plaza", city: "Denver", state: "CO" }),
    ];
    const only = (search: string) =>
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, search }, TODAY)
        .map((r) => r.dealId);

    expect(only("westgate")).toEqual(["205"]);
    expect(only("denver")).toEqual(["205"]);
    expect(only("CO")).toEqual(["205"]);
    expect(only("100")).toEqual(["100"]);
  });

  it("matches search case-insensitively", () => {
    const rows = [row({ name: "Westgate Plaza" })];
    expect(
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, search: "WESTGATE" }, TODAY),
    ).toHaveLength(1);
  });

  it("filters by each single-value field", () => {
    const rows = [
      row({ dealId: "1", stage: "active", dealType: "Lease", dealSide: "seller", propertyType: "office" }),
      row({ dealId: "2", stage: "closed", dealType: "Sale", dealSide: "buyer", propertyType: "retail" }),
    ];
    const ids = (f: Partial<typeof EMPTY_PIPELINE_FILTERS>) =>
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, ...f }, TODAY).map((r) => r.dealId);

    expect(ids({ stage: "closed" })).toEqual(["2"]);
    expect(ids({ dealType: "Sale" })).toEqual(["2"]);
    expect(ids({ dealSide: "seller" })).toEqual(["1"]);
    expect(ids({ propertyType: "retail" })).toEqual(["2"]);
  });

  it("composes filters as AND", () => {
    const rows = [
      row({ dealId: "1", stage: "active", dealType: "Lease" }),
      row({ dealId: "2", stage: "active", dealType: "Sale" }),
    ];
    const out = applyPipelineFilters(
      rows,
      { ...EMPTY_PIPELINE_FILTERS, stage: "active", dealType: "Sale" },
      TODAY,
    );
    expect(out.map((r) => r.dealId)).toEqual(["2"]);
  });

  it("drops rows with no office when an office filter is active", () => {
    const rows = [row({ dealId: "1", office: null }), row({ dealId: "2", office: "Denver" })];
    const out = applyPipelineFilters(
      rows,
      { ...EMPTY_PIPELINE_FILTERS, office: "Denver" },
      TODAY,
    );
    expect(out.map((r) => r.dealId)).toEqual(["2"]);
  });

  it("matches a broker against any broker on the deal, not just the lead", () => {
    const rows = [row({ dealId: "1", brokers: ["Ethan Delgado", "Priya Raman"] })];
    const out = applyPipelineFilters(
      rows,
      { ...EMPTY_PIPELINE_FILTERS, broker: "Priya Raman" },
      TODAY,
    );
    expect(out).toHaveLength(1);
  });

  it("applies the close-date presets against the injected today", () => {
    const rows = [
      row({ dealId: "q3", closeDate: "2026-09-15" }), // this quarter + this year + next 90
      row({ dealId: "q4", closeDate: "2026-11-20" }), // this year only
      row({ dealId: "old", closeDate: "2025-01-05" }), // past
      row({ dealId: "none", closeDate: null }),
    ];
    const ids = (closeDate: typeof EMPTY_PIPELINE_FILTERS.closeDate) =>
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, closeDate }, TODAY)
        .map((r) => r.dealId);

    expect(ids("this-quarter")).toEqual(["q3"]);
    expect(ids("this-year")).toEqual(["q3", "q4"]);
    expect(ids("next-90")).toEqual(["q3"]);
    expect(ids("past")).toEqual(["old"]);
  });

  it("excludes rows with no close date from every close-date preset", () => {
    const rows = [row({ dealId: "none", closeDate: null })];
    expect(
      applyPipelineFilters(rows, { ...EMPTY_PIPELINE_FILTERS, closeDate: "this-year" }, TODAY),
    ).toHaveLength(0);
  });
});

describe("pipelineFilterChips", () => {
  it("is empty when nothing is set", () => {
    expect(pipelineFilterChips(EMPTY_PIPELINE_FILTERS)).toEqual([]);
    expect(hasActivePipelineFilters(EMPTY_PIPELINE_FILTERS)).toBe(false);
  });

  it("names every active filter, inline and modal alike", () => {
    const chips = pipelineFilterChips({
      ...EMPTY_PIPELINE_FILTERS,
      search: "westgate",
      stage: "closed",
      office: "Denver",
    });
    expect(chips.map((c) => c.label)).toEqual([
      "Search: westgate",
      "Stage: Closed",
      "Office: Denver",
    ]);
  });

  it("uses the display label, not the raw stage value", () => {
    const [chip] = pipelineFilterChips({ ...EMPTY_PIPELINE_FILTERS, stage: "proposal" });
    expect(chip.label).toBe("Stage: Pitching");
  });

  it("clears only its own field", () => {
    const state = { ...EMPTY_PIPELINE_FILTERS, stage: "closed" as const, dealType: "Sale" as const };
    const [stageChip] = pipelineFilterChips(state);
    const next = stageChip.clear(state);
    expect(next.stage).toBeNull();
    expect(next.dealType).toBe("Sale");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test pipelineFilters`
Expected: FAIL — `Failed to resolve import "./pipelineFilters"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/reports/pipeline/pipelineFilters.ts`:

```ts
import type { DealSide, DealType, PropertyStatus, PropertyType } from "#/data/types";
import { STATUS_LABELS, TYPE_LABELS } from "#/components/properties/propertyDisplay";
import type { PipelineRow } from "./pipelineRows";

/**
 * Close date reads as a preset rather than a calendar: a pipeline question is
 * "what closes this quarter", not "what closes on the 14th".
 */
export type CloseDatePreset = "this-quarter" | "this-year" | "next-90" | "past";

export const CLOSE_DATE_LABELS: Record<CloseDatePreset, string> = {
  "this-quarter": "This quarter",
  "this-year": "This year",
  "next-90": "Next 90 days",
  past: "Past",
};

/**
 * Every filter is single-select — "Any" plus one value — matching the reference
 * design's selects rather than the Deals list's multi-select facets. `null`
 * means Any.
 *
 * This state has three writers: the inline row, the All Filters modal, and chip
 * removal. That is why it lives here rather than inside any one of them.
 */
export interface PipelineFilterState {
  search: string;
  office: string | null;
  broker: string | null;
  stage: PropertyStatus | null;
  dealType: DealType | null;
  dealSide: DealSide | null;
  propertyType: PropertyType | null;
  closeDate: CloseDatePreset | null;
}

export const EMPTY_PIPELINE_FILTERS: PipelineFilterState = {
  search: "",
  office: null,
  broker: null,
  stage: null,
  dealType: null,
  dealSide: null,
  propertyType: null,
  closeDate: null,
};

export const DEAL_SIDE_LABELS: Record<DealSide, string> = {
  seller: "Seller / Landlord",
  buyer: "Buyer / Tenant",
};

/** Parsed as local time so a date never shifts a day backward. */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function matchesCloseDate(
  closeDate: string | null,
  preset: CloseDatePreset,
  today: Date,
): boolean {
  // A deal with no close date is not "past" and not in any future window — it
  // simply has no answer, so every preset excludes it.
  if (!closeDate) return false;
  const when = parseIsoDate(closeDate);

  switch (preset) {
    case "past":
      return when < today;
    case "this-year":
      return when.getFullYear() === today.getFullYear() && when >= today;
    case "this-quarter": {
      const sameYear = when.getFullYear() === today.getFullYear();
      const sameQuarter =
        Math.floor(when.getMonth() / 3) === Math.floor(today.getMonth() / 3);
      return sameYear && sameQuarter && when >= today;
    }
    case "next-90": {
      const limit = new Date(today);
      limit.setDate(limit.getDate() + 90);
      return when >= today && when <= limit;
    }
  }
}

export function applyPipelineFilters(
  rows: PipelineRow[],
  f: PipelineFilterState,
  today: Date,
): PipelineRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.stage && r.stage !== f.stage) return false;
    if (f.dealType && r.dealType !== f.dealType) return false;
    if (f.dealSide && r.dealSide !== f.dealSide) return false;
    if (f.propertyType && r.propertyType !== f.propertyType) return false;
    if (f.office && r.office !== f.office) return false;
    if (f.broker && !r.brokers.includes(f.broker)) return false;
    if (f.closeDate && !matchesCloseDate(r.closeDate, f.closeDate, today)) return false;
    if (q) {
      const haystack =
        `${r.name} ${r.dealId} ${r.city ?? ""} ${r.state ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export interface PipelineFilterChip {
  key: string;
  label: string;
  clear: (s: PipelineFilterState) => PipelineFilterState;
}

/**
 * One chip per active filter — inline and modal alike. A chips row that only
 * sometimes mirrors the controls above it is harder to read than one that
 * always states the whole filter state.
 */
export function pipelineFilterChips(f: PipelineFilterState): PipelineFilterChip[] {
  const chips: PipelineFilterChip[] = [];

  if (f.search.trim())
    chips.push({
      key: "search",
      label: `Search: ${f.search.trim()}`,
      clear: (s) => ({ ...s, search: "" }),
    });
  if (f.stage)
    chips.push({
      key: "stage",
      label: `Stage: ${STATUS_LABELS[f.stage]}`,
      clear: (s) => ({ ...s, stage: null }),
    });
  if (f.dealType)
    chips.push({
      key: "dealType",
      label: `Deal Type: ${f.dealType}`,
      clear: (s) => ({ ...s, dealType: null }),
    });
  if (f.propertyType)
    chips.push({
      key: "propertyType",
      label: `Property Type: ${TYPE_LABELS[f.propertyType]}`,
      clear: (s) => ({ ...s, propertyType: null }),
    });
  if (f.closeDate)
    chips.push({
      key: "closeDate",
      label: `Close Date: ${CLOSE_DATE_LABELS[f.closeDate]}`,
      clear: (s) => ({ ...s, closeDate: null }),
    });
  if (f.office)
    chips.push({
      key: "office",
      label: `Office: ${f.office}`,
      clear: (s) => ({ ...s, office: null }),
    });
  if (f.broker)
    chips.push({
      key: "broker",
      label: `Broker: ${f.broker}`,
      clear: (s) => ({ ...s, broker: null }),
    });
  if (f.dealSide)
    chips.push({
      key: "dealSide",
      label: `Deal Side: ${DEAL_SIDE_LABELS[f.dealSide]}`,
      clear: (s) => ({ ...s, dealSide: null }),
    });

  return chips;
}

export function hasActivePipelineFilters(f: PipelineFilterState): boolean {
  return pipelineFilterChips(f).length > 0;
}
```

> **Chip order note:** the test expects `Search, Stage, Office` for that state. The push order above is search → stage → dealType → propertyType → closeDate → office → broker → dealSide, which yields exactly that. Keep the order stable; the test asserts it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun --bun run test pipelineFilters`
Expected: PASS, 13 tests.

- [ ] **Step 5: Type-check**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/reports/pipeline/pipelineFilters.ts src/components/reports/pipeline/pipelineFilters.test.ts
git commit -m "feat(reports): add Pipeline Report filter state, predicate, and chips"
```

---

### Task 3: `ReportShell` and the un-nested route

Get the riskiest assumption — that `reports_/` escapes the `/reports` layout — on screen before anything is built on top of it.

**Files:**
- Create: `src/components/reports/ReportShell.tsx`
- Create: `src/routes/_shell/reports_/pipeline.tsx`

**Interfaces:**
- Produces: `ReportShell({ title, children }: { title: string; children: ReactNode })`

- [ ] **Step 1: Write `ReportShell`**

Create `src/components/reports/ReportShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faFloppyDisk } from "@fortawesome/pro-regular-svg-icons";

/**
 * The header band every report wears: breadcrumb back to the catalog, the
 * report's name, and the two actions.
 *
 * This is the only piece extracted from the first report, and it is judged by
 * whether the *second* report can wear it unchanged — which is why nothing
 * Pipeline-specific (its filters, its columns) appears here.
 *
 * Actions and Save As are inert this phase: they render enabled and do nothing.
 * Deliberately not `disabled`, which reads as "unavailable to you" when the
 * truth is "not built yet". Column management and report saving are later
 * phases that fill these slots rather than redesign the band.
 */
export function ReportShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <div className="bg-card border-bottom">
        <div className="container p-4 d-flex align-items-center gap-3">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <Breadcrumb className="mb-1">
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<Link to="/reports/standard" />}>
                    Reports
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Page>{title}</Breadcrumb.Page>
                </Breadcrumb.Item>
              </Breadcrumb.List>
            </Breadcrumb>
            <h1 className="fs-4 fw-semibold mb-0">{title}</h1>
          </div>

          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button variant="outline">
                  Actions
                  <FontAwesomeIcon icon={faChevronDown} />
                </Button>
              }
            />
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item>Edit Columns</DropdownMenu.Item>
              <DropdownMenu.Item>Export to PDF</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>

          <Button>
            <FontAwesomeIcon icon={faFloppyDisk} />
            Save As
          </Button>
        </div>
      </div>

      <div className="container py-4">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Write the route with a placeholder body**

Create `src/routes/_shell/reports_/pipeline.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { ReportShell } from "#/components/reports/ReportShell";

export const Route = createFileRoute("/_shell/reports_/pipeline")({
  component: PipelineReport,
  head: () => ({ meta: [{ title: "Pipeline Report | Buildout Suite" }] }),
});

function PipelineReport() {
  return (
    <ReportShell title="Pipeline Report">
      <Card className="shadow">
        <div className="p-4">Pipeline report body</div>
      </Card>
    </ReportShell>
  );
}
```

- [ ] **Step 3: Start the dev server and confirm the route generated**

```bash
bun --bun run dev
```

Then in another shell:

```bash
grep -c "reports_/pipeline\|ReportsPipeline" src/routeTree.gen.ts
```

Expected: a non-zero count. If it is 0, the route file was not picked up — check the path is exactly `src/routes/_shell/reports_/pipeline.tsx`.

> The dev server may report "Port 3000 is in use" and fall back to 3001. Read the actual URL out of its output before browsing.

- [ ] **Step 4: Verify the un-nesting in the browser**

Navigate to `/reports/pipeline` and confirm, scoping selectors to `main.app-shell__main`:

- Exactly **one** header band — the report's. If you also see "View and analyze data about your company", the underscore did not take effect and the route is nesting.
- **No** Standard reports / My reports sidebar.
- The breadcrumb reads Reports → Pipeline Report, and clicking **Reports** returns to `/reports/standard`.
- Actions opens with two items; clicking either closes it and does nothing. Save As does nothing.
- Console clean.

> Never use `waitUntil: "networkidle"` — Vite's HMR socket keeps it open forever. Use `domcontentloaded` plus a wait for text unique to this page, e.g. `"Pipeline Report"`.

- [ ] **Step 5: Type-check and test**

```bash
bunx tsc --noEmit
bun --bun run test
```
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/reports/ReportShell.tsx src/routes/_shell/reports_/pipeline.tsx src/routeTree.gen.ts
git commit -m "feat(reports): add the shared report shell on an un-nested route"
```

---

### Task 4: The report table

**Files:**
- Create: `src/components/reports/pipeline/PipelineReportTable.tsx`
- Modify: `src/routes/_shell/reports_/pipeline.tsx`

**Interfaces:**
- Consumes: `PipelineRow`, `formatReportCurrency`, `pipelineTotals` from `./pipelineRows`; `dealCardLinkProps` from `#/components/deals/dealCardLink`; `getListing` from `#/data/store`.
- Produces: `PipelineReportTable({ rows }: { rows: PipelineRow[] })`, `type PipelineSortKey`.

- [ ] **Step 1: Write the table component**

Create `src/components/reports/pipeline/PipelineReportTable.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Pagination } from "@buildoutinc/blueprint-react/ui/Pagination";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSort, faSortUp, faSortDown } from "@fortawesome/pro-regular-svg-icons";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";
import { DealStageBadge } from "#/components/deals/DealStageBadge";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { dealShape } from "#/data/dealShape";
import { getListing } from "#/data/store";
import { DEAL_SIDE_LABELS } from "./pipelineFilters";
import {
  formatReportCurrency,
  pipelineTotals,
  type PipelineRow,
} from "./pipelineRows";

const PAGE_SIZE = 20;

export type PipelineSortKey =
  | "dealId"
  | "name"
  | "stage"
  | "dealType"
  | "propertyType"
  | "city"
  | "state"
  | "transactionValue"
  | "brokerageGross";

/** Page numbers with gaps, matching the Tasks page's pagination. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

/** `--` for a value the record does not have. A real zero renders "$0.00". */
function orDash(value: string | null): string {
  return value && value.length > 0 ? value : "--";
}

/**
 * A deal's link, resolved through the one shared rule so a child space deal
 * opens its own space page rather than its building's.
 */
function DealLink({ row, children }: { row: PipelineRow; children: React.ReactNode }) {
  const listing = getListing(row.listingId);
  if (!listing) return <>{children}</>;
  const props = dealCardLinkProps(listing);
  return (
    <Link {...props} className="text-decoration-none">
      {children}
    </Link>
  );
}

export function PipelineReportTable({ rows }: { rows: PipelineRow[] }) {
  // Transaction Value descending is the reference's default and the useful
  // pipeline read.
  const [sortKey, setSortKey] = useState<PipelineSortKey>("transactionValue");
  const [asc, setAsc] = useState(false);
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const x = a[sortKey];
      const y = b[sortKey];
      if (typeof x === "number" && typeof y === "number") return asc ? x - y : y - x;
      const cmp = String(x ?? "").localeCompare(String(y ?? ""));
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, asc]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Filtering can shrink the set under the current page; clamp rather than
  // render an empty page the user cannot see they are on.
  const current = Math.min(page, pageCount);
  const paged = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const totals = pipelineTotals(rows);

  function toggleSort(key: PipelineSortKey) {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(false);
    }
    setPage(1);
  }

  function SortHead({
    columnKey,
    children,
    align = "start",
  }: {
    columnKey: PipelineSortKey;
    children: React.ReactNode;
    align?: "start" | "end";
  }) {
    const icon = columnKey !== sortKey ? faSort : asc ? faSortUp : faSortDown;
    return (
      <Table.Head className={align === "end" ? "text-end" : undefined}>
        <button
          type="button"
          className="btn btn-link p-0 text-reset text-decoration-none d-inline-flex align-items-center gap-1 fw-semibold"
          onClick={() => toggleSort(columnKey)}
        >
          {children}
          <FontAwesomeIcon icon={icon} className="text-muted" style={{ fontSize: 11 }} />
        </button>
      </Table.Head>
    );
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="border rounded-3 overflow-auto">
        <Table variant="sticky">
          <Table.Header sticky>
            <Table.Row>
              <SortHead columnKey="dealId">Deal ID</SortHead>
              <SortHead columnKey="name">Deal Name</SortHead>
              <SortHead columnKey="stage">Stage</SortHead>
              <SortHead columnKey="dealType">Deal Type</SortHead>
              <Table.Head>Deal Side</Table.Head>
              <SortHead columnKey="propertyType">Property Type</SortHead>
              <SortHead columnKey="city">City</SortHead>
              <SortHead columnKey="state">State</SortHead>
              <SortHead columnKey="transactionValue" align="end">
                Transaction Value
              </SortHead>
              <SortHead columnKey="brokerageGross" align="end">
                Brokerage Gross
              </SortHead>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {/* Summary row above the data, as in the reference: the count is
                the report's first question. Tracks the filtered set. */}
            <Table.Row className="bg-body fw-semibold">
              <Table.Cell colSpan={8}>Count {totals.count}</Table.Cell>
              <Table.Cell className="text-end">
                {formatReportCurrency(totals.transactionValue)}
              </Table.Cell>
              <Table.Cell className="text-end">
                {formatReportCurrency(totals.brokerageGross)}
              </Table.Cell>
            </Table.Row>

            {paged.map((r) => (
              <Table.Row key={r.listingId}>
                <Table.Cell>
                  <DealLink row={r}>{r.dealId}</DealLink>
                </Table.Cell>
                <Table.Cell>
                  <DealLink row={r}>{r.name}</DealLink>
                </Table.Cell>
                <Table.Cell>
                  <StageCell row={r} />
                </Table.Cell>
                <Table.Cell>{r.dealType}</Table.Cell>
                <Table.Cell>{DEAL_SIDE_LABELS[r.dealSide]}</Table.Cell>
                <Table.Cell>
                  {orDash(r.propertyType ? TYPE_LABELS[r.propertyType] : null)}
                </Table.Cell>
                <Table.Cell>{orDash(r.city)}</Table.Cell>
                <Table.Cell>{orDash(r.state)}</Table.Cell>
                <Table.Cell className="text-end">
                  {formatReportCurrency(r.transactionValue)}
                </Table.Cell>
                <Table.Cell className="text-end">
                  {formatReportCurrency(r.brokerageGross)}
                </Table.Cell>
              </Table.Row>
            ))}

            {paged.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={10} className="text-center text-muted py-4">
                  No deals match these filters.
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>

      {pageCount > 1 && (
        <Pagination className="d-flex justify-content-center">
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                href="#"
                aria-disabled={current === 1}
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
              />
            </Pagination.Item>
            {pageWindow(current, pageCount).map((item, i) =>
              item === "…" ? (
                <Pagination.Item key={`gap-${i}`}>
                  <span className="px-2 text-muted" aria-hidden>
                    …
                  </span>
                </Pagination.Item>
              ) : (
                <Pagination.Item key={item}>
                  <Pagination.Link
                    href="#"
                    isActive={item === current}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(item);
                    }}
                  >
                    {item}
                  </Pagination.Link>
                </Pagination.Item>
              ),
            )}
            <Pagination.Item>
              <Pagination.Next
                href="#"
                aria-disabled={current === pageCount}
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(pageCount, p + 1));
                }}
              />
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      )}
    </div>
  );
}

/**
 * Stage renders through the same badge the deal page uses, resolved with the
 * deal's shape so a space deal reads the label its own page shows.
 */
function StageCell({ row }: { row: PipelineRow }) {
  const listing = getListing(row.listingId);
  return (
    <DealStageBadge stage={row.stage} shape={listing ? dealShape(listing) : "sale"} />
  );
}
```

- [ ] **Step 2: Render it from the route**

Replace the body of `src/routes/_shell/reports_/pipeline.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { useMemo } from "react";
import { ReportShell } from "#/components/reports/ReportShell";
import { PipelineReportTable } from "#/components/reports/pipeline/PipelineReportTable";
import { pipelineRows } from "#/components/reports/pipeline/pipelineRows";
import { useDataStore } from "#/data/dataStore";

export const Route = createFileRoute("/_shell/reports_/pipeline")({
  component: PipelineReport,
  head: () => ({ meta: [{ title: "Pipeline Report | Buildout Suite" }] }),
});

function PipelineReport() {
  const listings = useDataStore((s) => s.listings);
  const rows = useMemo(() => pipelineRows([...listings.values()]), [listings]);

  return (
    <ReportShell title="Pipeline Report">
      <Card className="shadow">
        <div className="p-4">
          <PipelineReportTable rows={rows} />
        </div>
      </Card>
    </ReportShell>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: exit 0. If `Table.Row` rejects `className` or `Pagination.Next` is missing, check the actual Blueprint export shape and adjust — the Tasks page and `ContactsTable` are working references.

- [ ] **Step 4: Verify in the browser**

At `/reports/pipeline`, scoped to `main.app-shell__main`:

- The summary row reads `Count N` with both money totals, above the data rows.
- Clicking a column header re-sorts; clicking the same header again flips direction.
- Pagination shows 2 pages over the seeded deals; page 2 renders the remainder.
- A Deal Name opens that deal. Find a row whose deal is a child space (its name contains a `|` suite label) and confirm it lands on `/listings/{parent}/spaces/{space}/overview`, not the building page.
- No row is an umbrella shell — a building with child spaces must not appear.
- Console clean.

- [ ] **Step 5: Run tests**

Run: `bun --bun run test`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/reports/pipeline/PipelineReportTable.tsx src/routes/_shell/reports_/pipeline.tsx
git commit -m "feat(reports): add the Pipeline Report table with totals, sorting, and paging"
```

---

### Task 5: Filter row, chips, and the All Filters modal

**Files:**
- Create: `src/components/reports/pipeline/PipelineFilterBar.tsx`
- Create: `src/components/reports/pipeline/PipelineFilterModal.tsx`
- Modify: `src/routes/_shell/reports_/pipeline.tsx`

**Interfaces:**
- Consumes: everything `pipelineFilters.ts` produces; `ContactChip` from `#/components/contacts/ContactChip`.
- Produces:
  - `PipelineFilterBar({ filters, onChange, offices, brokers })`
  - `PipelineFilterModal({ open, onOpenChange, filters, onChange, offices, brokers })`

> `TaskFilterBar` already imports `ContactChip` out of `components/contacts/`, so reports doing the same follows an existing path rather than cutting a new one.

- [ ] **Step 1: Write a shared single-select control and the inline bar**

Create `src/components/reports/pipeline/PipelineFilterBar.tsx`:

```tsx
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSliders } from "@fortawesome/pro-regular-svg-icons";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import { ContactChip } from "#/components/contacts/ContactChip";
import {
  CLOSE_DATE_LABELS,
  pipelineFilterChips,
  type CloseDatePreset,
  type PipelineFilterState,
} from "./pipelineFilters";

/** "Any" is the empty selection. Select has no null value, so it needs a token. */
export const ANY = "__any__";

/**
 * One labelled single-select. Shared by the inline row and the modal so a
 * filter looks and behaves the same in both places.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  labelFor,
  onChange,
  width,
}: {
  label: string;
  value: T | null;
  options: readonly T[];
  labelFor: (v: T) => string;
  onChange: (v: T | null) => void;
  width?: number;
}) {
  return (
    <div style={width ? { width } : undefined}>
      <label className="form-label small text-muted mb-1">{label}</label>
      <Select
        value={value ?? ANY}
        onValueChange={(v) => onChange(!v || v === ANY ? null : (v as T))}
      >
        <Select.Trigger>
          <Select.Value>
            {(v) => (!v || v === ANY ? "Any" : labelFor(v as T))}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={ANY}>Any</Select.Item>
          {options.map((o) => (
            <Select.Item key={o} value={o}>
              {labelFor(o)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  );
}

const CLOSE_DATE_PRESETS: CloseDatePreset[] = [
  "this-quarter",
  "this-year",
  "next-90",
  "past",
];

/**
 * The filter row stays ONE row and never wraps. The controls that do not fit
 * live only in the All Filters modal; the chips beneath keep every active
 * filter named on the page, so a modal-only filter can never change the row
 * count with no visible cause.
 */
export function PipelineFilterBar({
  filters,
  onChange,
  onOpenAll,
}: {
  filters: PipelineFilterState;
  onChange: (next: PipelineFilterState) => void;
  onOpenAll: () => void;
}) {
  const chips = pipelineFilterChips(filters);

  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex align-items-end gap-2 flex-nowrap overflow-x-auto">
        <div style={{ minWidth: 220 }}>
          <label className="form-label small text-muted mb-1">
            Name, Address or Identifier
          </label>
          <div className="position-relative">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="position-absolute text-muted"
              style={{ left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <Input
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              style={{ paddingLeft: 30 }}
              aria-label="Search deals"
            />
          </div>
        </div>

        <FilterSelect
          label="Deal Stage"
          value={filters.stage}
          options={PROPERTY_STATUSES}
          labelFor={(s) => STATUS_LABELS[s]}
          onChange={(stage) => onChange({ ...filters, stage })}
          width={150}
        />
        <FilterSelect
          label="Deal Type"
          value={filters.dealType}
          options={["Sale", "Lease"] as const}
          labelFor={(v) => v}
          onChange={(dealType) => onChange({ ...filters, dealType })}
          width={130}
        />
        <FilterSelect
          label="Property Type"
          value={filters.propertyType}
          options={PROPERTY_TYPES}
          labelFor={(t) => TYPE_LABELS[t]}
          onChange={(propertyType) => onChange({ ...filters, propertyType })}
          width={160}
        />
        <FilterSelect
          label="Close Date"
          value={filters.closeDate}
          options={CLOSE_DATE_PRESETS}
          labelFor={(p) => CLOSE_DATE_LABELS[p]}
          onChange={(closeDate) => onChange({ ...filters, closeDate })}
          width={150}
        />

        <Button variant="outline" onClick={onOpenAll} className="flex-shrink-0">
          <FontAwesomeIcon icon={faSliders} />
          All Filters
        </Button>
      </div>

      {chips.length > 0 && (
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {chips.map((chip) => (
            <ContactChip
              key={chip.key}
              appearance="muted"
              label={chip.label}
              removeLabel={`Remove ${chip.label}`}
              onRemove={() => onChange(chip.clear(filters))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the All Filters modal**

Create `src/components/reports/pipeline/PipelineFilterModal.tsx`:

```tsx
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import {
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "#/components/properties/propertyDisplay";
import { FilterSelect } from "./PipelineFilterBar";
import {
  CLOSE_DATE_LABELS,
  DEAL_SIDE_LABELS,
  EMPTY_PIPELINE_FILTERS,
  type CloseDatePreset,
  type PipelineFilterState,
} from "./pipelineFilters";
import type { DealSide } from "#/data/types";

const CLOSE_DATE_PRESETS: CloseDatePreset[] = [
  "this-quarter",
  "this-year",
  "next-90",
  "past",
];

/**
 * *All* Filters, not *More* Filters: it repeats the inline controls as well as
 * the modal-only ones, so it is a complete surface rather than a leftovers
 * drawer and nobody has to remember which filter lives where. Both surfaces
 * write the same state, so a value set in one shows in the other.
 */
export function PipelineFilterModal({
  open,
  onOpenChange,
  filters,
  onChange,
  offices,
  brokers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PipelineFilterState;
  onChange: (next: PipelineFilterState) => void;
  offices: string[];
  brokers: string[];
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>All Filters</Modal.Title>
          <Modal.Description>
            Every filter available on the Pipeline Report.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <div>
            <label className="form-label small text-muted mb-1">
              Name, Address or Identifier
            </label>
            <Input
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              aria-label="Search deals"
            />
          </div>

          <div className="d-flex gap-3 flex-wrap">
            <FilterSelect
              label="Office"
              value={filters.office}
              options={offices}
              labelFor={(o) => o}
              onChange={(office) => onChange({ ...filters, office })}
              width={220}
            />
            <FilterSelect
              label="Broker"
              value={filters.broker}
              options={brokers}
              labelFor={(b) => b}
              onChange={(broker) => onChange({ ...filters, broker })}
              width={220}
            />
            <FilterSelect
              label="Deal Side"
              value={filters.dealSide}
              options={["seller", "buyer"] as DealSide[]}
              labelFor={(s) => DEAL_SIDE_LABELS[s]}
              onChange={(dealSide) => onChange({ ...filters, dealSide })}
              width={200}
            />
          </div>

          <div className="d-flex gap-3 flex-wrap">
            <FilterSelect
              label="Deal Stage"
              value={filters.stage}
              options={PROPERTY_STATUSES}
              labelFor={(s) => STATUS_LABELS[s]}
              onChange={(stage) => onChange({ ...filters, stage })}
              width={200}
            />
            <FilterSelect
              label="Deal Type"
              value={filters.dealType}
              options={["Sale", "Lease"] as const}
              labelFor={(v) => v}
              onChange={(dealType) => onChange({ ...filters, dealType })}
              width={200}
            />
            <FilterSelect
              label="Property Type"
              value={filters.propertyType}
              options={PROPERTY_TYPES}
              labelFor={(t) => TYPE_LABELS[t]}
              onChange={(propertyType) => onChange({ ...filters, propertyType })}
              width={200}
            />
            <FilterSelect
              label="Close Date"
              value={filters.closeDate}
              options={CLOSE_DATE_PRESETS}
              labelFor={(p) => CLOSE_DATE_LABELS[p]}
              onChange={(closeDate) => onChange({ ...filters, closeDate })}
              width={200}
            />
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="ghost" onClick={() => onChange(EMPTY_PIPELINE_FILTERS)}>
            Reset Filter
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
```

- [ ] **Step 3: Wire both into the route**

Replace `src/routes/_shell/reports_/pipeline.tsx`:

```tsx
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { ReportShell } from "#/components/reports/ReportShell";
import { PipelineReportTable } from "#/components/reports/pipeline/PipelineReportTable";
import { PipelineFilterBar } from "#/components/reports/pipeline/PipelineFilterBar";
import { PipelineFilterModal } from "#/components/reports/pipeline/PipelineFilterModal";
import { pipelineRows } from "#/components/reports/pipeline/pipelineRows";
import {
  EMPTY_PIPELINE_FILTERS,
  applyPipelineFilters,
} from "#/components/reports/pipeline/pipelineFilters";
import { DASHBOARD_TODAY } from "#/components/dashboard/dashboardData";
import { useDataStore } from "#/data/dataStore";

export const Route = createFileRoute("/_shell/reports_/pipeline")({
  component: PipelineReport,
  head: () => ({ meta: [{ title: "Pipeline Report | Buildout Suite" }] }),
});

function PipelineReport() {
  const listings = useDataStore((s) => s.listings);
  const [filters, setFilters] = useState(EMPTY_PIPELINE_FILTERS);
  const [allOpen, setAllOpen] = useState(false);

  const rows = useMemo(() => pipelineRows([...listings.values()]), [listings]);

  // Options come from the data actually in the report, so a filter can never
  // offer a value that matches nothing.
  const offices = useMemo(
    () => [...new Set(rows.map((r) => r.office).filter((o): o is string => !!o))].sort(),
    [rows],
  );
  const brokers = useMemo(
    () => [...new Set(rows.flatMap((r) => r.brokers))].sort(),
    [rows],
  );

  const filtered = useMemo(
    () => applyPipelineFilters(rows, filters, DASHBOARD_TODAY),
    [rows, filters],
  );

  return (
    <ReportShell title="Pipeline Report">
      <Card className="shadow">
        <div className="p-4 d-flex flex-column gap-3">
          <PipelineFilterBar
            filters={filters}
            onChange={setFilters}
            onOpenAll={() => setAllOpen(true)}
          />
          <PipelineReportTable rows={filtered} />
        </div>
      </Card>

      <PipelineFilterModal
        open={allOpen}
        onOpenChange={setAllOpen}
        filters={filters}
        onChange={setFilters}
        offices={offices}
        brokers={brokers}
      />
    </ReportShell>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `bunx tsc --noEmit`
Expected: exit 0.

> `FilterSelect` is generic over `T extends string`. If TypeScript cannot infer `T` for the `offices`/`brokers` cases (`string[]`), pass it explicitly: `<FilterSelect<string> ... />`.

- [ ] **Step 5: Verify in the browser**

At `/reports/pipeline`:

- The filter row holds **one line** — resize narrow and confirm it scrolls horizontally rather than wrapping.
- Setting an inline filter narrows the table and the summary `Count`, and adds a muted chip below the row.
- Removing a chip restores the rows and clears the matching control.
- **All Filters** opens with the inline values already reflected. Set **Office** there, close the modal: a chip appears on the row and the count changes — the point of the chips.
- **Reset Filter** in the modal clears every control and every chip.
- Console clean.

- [ ] **Step 6: Run tests and commit**

```bash
bun --bun run test
git add src/components/reports/pipeline/PipelineFilterBar.tsx src/components/reports/pipeline/PipelineFilterModal.tsx src/routes/_shell/reports_/pipeline.tsx
git commit -m "feat(reports): filter the Pipeline Report from one row, chips, and a modal"
```

---

### Task 6: Link the catalog card, and full verification

**Files:**
- Modify: `src/components/reports/ReportRow.tsx`
- Modify: `src/routes/_shell/reports/standard.tsx`

**Interfaces:**
- Produces: `ReportRow` gains an optional `to?: string` prop. Absent → inert `div` as today.

- [ ] **Step 1: Give `ReportRow` an optional link**

In `src/components/reports/ReportRow.tsx`, add `to` to the props type and wrap the card when it is present. The existing card markup is unchanged; only the wrapper is new:

```tsx
import { Link } from "@tanstack/react-router";

// ...existing imports and props, plus:
//   to?: string;

// At the end of the component, replace `return <Card …>…</Card>` with:
const card = (
  <Card className="shadow-sm report-row">
    {/* …existing card body, unchanged… */}
  </Card>
);

// Reports that have no page yet stay inert rather than becoming links that
// go nowhere.
if (!to) return card;
return (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <Link to={to as any} className="text-decoration-none d-block">
    {card}
  </Link>
);
```

- [ ] **Step 2: Link only the Pipeline card**

In `src/routes/_shell/reports/standard.tsx`, pass `to` from the catalog entry:

```tsx
<ReportRow
  key={report.id}
  icon={report.icon}
  title={report.title}
  description={report.description}
  to={report.id === "pipeline" ? "/reports/pipeline" : undefined}
/>
```

- [ ] **Step 3: Type-check and test**

```bash
bunx tsc --noEmit
bun --bun run test
```
Expected: both exit 0.

- [ ] **Step 4: End-to-end browser verification**

Walk the whole flow once, scoping selectors to `main.app-shell__main`:

1. `/reports` redirects to `/reports/standard`; the catalog still renders all 18 reports.
2. The **Pipeline Report** card is a link; the other 17 do not navigate.
3. Clicking it lands on `/reports/pipeline` with exactly one header band and no section sidebar.
4. Breadcrumb **Reports** returns to `/reports/standard`.
5. Filters, chips, modal, Reset all behave as in Task 5.
6. Sorting and pagination behave as in Task 4.
7. A Deal Name opens its deal; a space deal opens its space page.
8. Console clean throughout.
9. `browser_close` when finished — the browser does not exit on its own.

- [ ] **Step 5: Commit**

```bash
git add src/components/reports/ReportRow.tsx src/routes/_shell/reports/standard.tsx
git commit -m "feat(reports): link the Pipeline card to its report"
```

- [ ] **Step 6: Delete the spec and plan**

Per CLAUDE.md, a spec is in-flight only. Move anything worth keeping — chiefly the three reference-reconciliation decisions and the un-nesting rationale — into the PR body first, then:

```bash
git rm docs/superpowers/specs/2026-08-17-pipeline-report-design.md docs/superpowers/plans/2026-08-17-pipeline-report.md
git commit -m "chore(docs): delete the shipped Pipeline Report spec and plan"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Stage keeps this prototype's vocabulary | Global Constraints; Task 2 chips use `STATUS_LABELS`; Task 4 uses `DealStageBadge` |
| Deal Type splits into Deal Type + Deal Side | Tasks 2, 4, 5 — both filters and both columns |
| Dirty Deals dropped | Absent from `PipelineFilterState` by construction |
| Un-nested route | Task 3 |
| `ReportShell`, Actions + Save As inert | Task 3 |
| Filter list and sources | Tasks 2, 5 |
| One row + All Filters modal | Task 5 |
| Active-filter chips, badge dropped | Task 5 (no badge is implemented anywhere) |
| Table columns, summary row, sorting, `--` vs `$0.00` | Task 4 |
| Links via `dealCardLinkProps` | Task 4 |
| Pagination 20/page | Task 4 (`PAGE_SIZE = 20`) |
| Umbrella shells excluded | Task 1 (`pipelineRows`) |
| Office derivation + `null` fallback | Task 1 |
| Vitest coverage of logic | Tasks 1, 2 |
| Browser verification | Tasks 3, 4, 5, 6 |
| Catalog card links | Task 6 |
| No `src/data/` change, no `SEED_VERSION` move | No task touches `src/data/` |

**Placeholder scan:** none — every code step carries real code; no "TBD", no "handle edge cases", no "similar to Task N".

**Type consistency:** `PipelineRow` fields are used identically in Tasks 1, 2, 4. `PipelineFilterState` field names (`search`, `office`, `broker`, `stage`, `dealType`, `dealSide`, `propertyType`, `closeDate`) match across Tasks 2 and 5. `formatReportCurrency`, `pipelineTotals`, `pipelineRows`, `applyPipelineFilters`, `pipelineFilterChips`, `EMPTY_PIPELINE_FILTERS`, `DEAL_SIDE_LABELS`, `CLOSE_DATE_LABELS`, `FilterSelect`, `ANY` are each defined once and imported by name thereafter. `DEAL_SIDE_LABELS` is defined in `pipelineFilters.ts` (Task 2) and consumed by Task 4's table and Task 5's modal — consistent.

**Note on `hasActivePipelineFilters`:** produced in Task 2 and covered by its test, but not consumed by any component, since the chips row replaced the count badge. It is two lines and is the natural predicate for a future "Reset" enablement; if the executor prefers, deleting it and its one test is acceptable.
