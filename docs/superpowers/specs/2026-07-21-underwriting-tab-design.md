# Underwriting tab — a first-class, stored underwriting result

**Date:** 2026-07-21
**Branch:** `joel/cactus-refinements-ai-pages`
**Related:** `project_cactus_underwriting`, `2026-07-14-phase-2-field-catalog`

## Problem

Underwriting is generated at deal-creation time (and from the Overview planner
row), but its output is not stored data — the figures are reinvented on the fly
by `buildUnderwritingSection(property, underwriting)` in the editor
(`src/features/editor/underwritingPages.ts`). The output therefore only exists
as pages inside one shared seeded document. Consequences:

- There is no page where a broker can see the full underwriting breakdown as
  data (only inside the document editor).
- No other surface can consume underwriting numbers.
- A planned future feature — letting users insert **dynamic fields** into text
  objects in the document editor, with suggestions drawn from underwriting —
  has nothing structured to read from.

## Goal

Make the generated underwriting a **stored, structured result** on the deal,
and give it a home: a new **Underwriting** tab under a deal (for qualifying
asset classes) that shows the full breakdown and can generate / re-generate.
One computed result, three consumers: the tab, the document, and (future)
dynamic-field suggestions.

## Non-goals

- Building the dynamic-fields feature itself (this spec only makes its data
  source exist).
- Real staleness detection / auto-invalidation (manual re-generate only).
- Changing the create-deal flow or the Overview planner row's UX — both keep
  working; they just also persist the structured result.
- Making the editor document-id aware (placement stays cosmetic, as today).

## Architecture

### Single source of truth: extract a pure result builder

Create `src/components/deals/underwriting/underwritingResult.ts` — a **pure**
module (no editor `Block` types, no `Date.now()`, no `Math.random`) that owns
the deterministic figure logic currently inside `underwritingPages.ts`:

- Move `buildCtx(property)` here (the price/cap/NOI/EGI/opex/PGI/vacancy/
  rent-per-SF/loan/debt-service engine).
- Add `buildUnderwritingResult(property, underwriting): UnderwritingResult` that
  produces the flat metrics + grouped sections for the selected checks.

Then re-point the two rendering surfaces at that result:

- **Editor** — `buildUnderwritingSection` becomes a thin adapter: it reads
  `underwriting.result` (falling back to `buildUnderwritingResult(...)` when an
  older deal has no stored result) and converts each `UnderwritingResultSection`
  into the editor's table `Block`s. The document output stays byte-for-byte
  equivalent to today.
- **Tab** — renders the same `UnderwritingResult` as Blueprint tables.

This keeps a deal tab from depending on editor internals and keeps the numbers
"data-shaped" rather than "document-shaped" — the key enabler for dynamic fields.

## Data model

`DealUnderwriting` (in `src/data/types.ts`) gains a stored result and a
timestamp, alongside the existing scope fields:

```ts
export interface DealUnderwriting {
  strategy: UnderwritingStrategyId
  tier: string
  selectedChecks: number[]
  status?: 'not-started' | 'generating' | 'generated' | 'ready'
  placement?: { documentId?: string; documentName: string }

  // NEW
  result?: UnderwritingResult
  generatedAt?: string // ISO timestamp; stamped by the caller, not the pure builder
}

/** A single addressable metric — the unit a future dynamic field references. */
export interface UnderwritingMetric {
  key: string          // stable, e.g. 'goingInCapRate', 'stabilizedNOI', 'dscr'
  label: string        // human label, e.g. 'Going-In Cap Rate'
  value: number        // raw numeric value
  display: string      // formatted for display, e.g. '$1,517,000', '6.2%', '1.34x'
  format: 'money' | 'percent' | 'number' | 'ratio' | 'sqft' | 'text'
}

/** A plain-data mirror of one breakdown table (renders in tab + document). */
export interface UnderwritingResultSection {
  key: string              // matches the strategy check key, e.g. 'financing'
  name: string             // display heading, e.g. 'Financing Assumptions'
  columns: string[]        // column headers
  rows: string[][]         // cell strings, aligned to columns
}

export interface UnderwritingResult {
  strategy: UnderwritingStrategyId
  metrics: UnderwritingMetric[]
  sections: UnderwritingResultSection[]
  /** Provenance for the "reflects data as of…" line on the tab. */
  inputs: { address: string; askingPrice: number; buildingSqFt: number; capRate: number }
}
```

`metrics` includes the current headline set (asking price, cap rate, NOI,
building size) **plus** the derived analytics presently buried in section tables
(DSCR, debt yield, loan amount, exit cap, exit/reversion value, stabilized NOI,
equity multiple, total project cost, etc.) — one flat list, each independently
addressable.

## The tab

**Route:** `src/routes/_shell/listings/$listingId/underwriting.tsx`
**Component:** `src/components/deals/underwriting/DealUnderwritingTab.tsx`

- **Sidebar:** add to `PropertyDetailSidebar.tsx` in the **"Deal"** group,
  positioned **directly under "Data"**. Suggested icon `faCalculator`
  (regular). The tab is shown **only for qualifying asset classes** via the
  existing `propertyQualifiesForUnderwriting(property)`; on a non-qualifying
  deal the tab is absent from the nav.
- The component reads the listing **reactively** from the data store
  (`useDataStore`) so it reflects generation triggered from any entry point.

### States (keyed off `underwriting.status`)

1. **Not started / no run** — always-present empty state: short explainer +
   **"Generate underwriting"** primary button → opens the setup modal (reuse
   `UnderwritingDepth`: strategy chooser + depth slider). Confirm sets
   `status: 'generating'`.
2. **Generating** — inline `UnderwritingProgress` (reused). On completion, the
   existing **placement modal** (`UnderwritingPlacementModal`) runs (kept in the
   flow per decision), then `status: 'ready'`.
3. **Ready — full breakdown:**
   - **Header:** strategy label · "N of M analyses" · **"Generated {relative
     time}"** (from `generatedAt`) · "reflects data as of {inputs.address}" ·
     **Re-generate** button (re-opens the setup modal pre-filled with the
     current strategy + selected checks) · secondary **"View in document"** link
     → `/editor/$listingId?focus=underwriting` (existing behavior).
   - **Metrics grid:** render **all** `result.metrics` as a compact,
     body-size-bold figure grid with small labels (not large KpiTiles — the page
     is dense; follows the stat-tile hierarchy convention). Doubles as a preview
     of what dynamic fields will be able to pull.
   - **Breakdown:** each `result.sections` entry rendered as a Blueprint `Table`
     under its section heading — the same data the document shows, native on the
     page.

## Entry-point wiring (one result, three doorways)

All three doorways coexist (per decision) and funnel through the same compute +
store path so they cannot diverge:

- **Create-deal modal** — unchanged UX; still creates the deal with
  `status: 'generating'`.
- **Overview planner row** (`UnderwritingPlannerRow`) — unchanged UX; on
  completion it now also calls `buildUnderwritingResult(...)` and stores
  `result` + `generatedAt` (today it only flips `status`). "Review" still works.
- **The tab** — generate + re-generate, as above.

Single writer: the store action `updateListingUnderwriting` persists
`{ status, result, generatedAt, placement }`. Single computer: the pure
`buildUnderwritingResult`. `generatedAt` is stamped by the calling component
(store/UI layer), never inside the pure builder.

## Gating & housekeeping

- **Eligibility:** reuse `propertyQualifiesForUnderwriting(property)`
  (`src/components/deals/underwriting/eligibility.ts`) for the sidebar tab, the
  same gate already used by the planner row and create-deal toggle.
- **Seed migration:** bump `SEED_VERSION` so seeded "ready" deals gain a
  backfilled `result` + `generatedAt`. The editor fallback (build-on-read when
  `result` is absent) means no hard break if an un-migrated deal is encountered.

## Testing

- New `underwritingResult.test.ts`: `buildUnderwritingResult` returns
  deterministic, stable metrics + sections for a given property; identical
  across repeated calls; selected-checks filtering drives which sections appear;
  metrics include the derived analytics.
- Update `underwritingPages.test.ts`: assert the editor section is built from a
  stored `result` and remains equivalent to the previous on-the-fly output;
  assert the build-on-read fallback for a result-less deal.
- Update `seed.test.ts` for the new seeded fields / `SEED_VERSION`.
- No Playwright — a human smoke test (`bun --bun run dev`, clear IndexedDB to
  reseed) confirms: tab appears only for qualifying assets, empty → generate →
  breakdown, re-generate, and the document still renders.

## Files touched

- **New:** `src/components/deals/underwriting/underwritingResult.ts` (+ test);
  `src/components/deals/underwriting/DealUnderwritingTab.tsx`;
  `src/routes/_shell/listings/$listingId/underwriting.tsx`.
- **Edit:** `src/data/types.ts` (result/metric/section types);
  `src/features/editor/underwritingPages.ts` (consume result + fallback);
  `src/components/properties/PropertyDetailSidebar.tsx` (nav item under Data);
  `src/components/deals/underwriting/UnderwritingPlannerRow.tsx` (store result);
  `src/data/store.ts` (`updateListingUnderwriting` persists result/timestamp);
  `src/data/seed.ts` + `SEED_VERSION`; relevant tests.
