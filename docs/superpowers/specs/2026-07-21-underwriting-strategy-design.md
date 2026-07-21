# Underwriting Strategy — Design

**Date:** 2026-07-21
**Status:** Approved design, ready for implementation planning

## Summary

The Cactus underwriting flow currently opens with a **depth slider** that selects
the first N of a single global list of 12 generic financial checks, mapping the
count to a tier badge (Rapid Screen → Standard → Deep Dive → Institutional).

Cactus's real product frames underwriting around a **strategy**, not raw depth.
This change adds a strategy chooser above the slider. The strategy is the primary
control; the slider stays underneath it (we may remove or rework the slider
later). Crucially, **each strategy has its own check list** — picking a strategy
swaps the whole set of checks the slider governs, the steps shown on the
generation screen, and the sections built into the generated document.

Two strategies ship:

- **New Construction Strategy** — underwriting a ground-up redevelopment: show the
  client the potential of tearing down / redeveloping the property.
- **Value-Add** — underwriting a renovation/improvement play: show the value of
  improving the property before selling or leasing.

## Goals

- Add a strategy `Select` above the existing slider in the underwriting depth
  control, in both places it appears (Create Deal modal, planner setup modal).
- Make the **check list strategy-specific**: selecting a strategy replaces the
  checks in the slider/toggles, the generation-progress steps, and the generated
  document sections.
- Generate a document whose sections genuinely match the chosen strategy's checks
  (Full depth — one real section per check).

## Non-goals

- Removing the slider (kept for now; may be reworked later).
- Real backend generation — everything stays deterministic client-side theater.
- Additional strategies beyond the two above.

## Decisions

| Decision | Choice |
|---|---|
| Slider fate | Keep it; strategy `Select` sits **on top** of it. |
| Strategy effect on content | Different content per strategy (checks + sections). |
| Value-Add checklist | Use the proposed 7 (below). |
| Document depth | Full — a real deterministic section per check. |
| Depth badge | Show the **strategy name**; depth reads as "N of 7 checks". Retire the 4 tier names. |
| Default strategy | **New Construction Strategy**. |

## Strategy catalog

New shared module: **`src/components/deals/underwriting/strategies.ts`**.

```ts
export type UnderwritingStrategyId = 'new-construction' | 'value-add'

export interface UnderwritingCheck {
  key: string   // stable id, used to resolve the doc section builder
  label: string // noun shown in the slider toggles + scope table
}

export interface UnderwritingStrategyDef {
  id: UnderwritingStrategyId
  label: string        // e.g. "New Construction Strategy"
  description: string  // shown in the Select option
  checks: UnderwritingCheck[]
}

export const UNDERWRITING_STRATEGIES: Record<UnderwritingStrategyId, UnderwritingStrategyDef>
export const DEFAULT_STRATEGY: UnderwritingStrategyId = 'new-construction'
```

This module is the single source of truth for check labels. `UnderwritingDepth`
and `UnderwritingProgress` both import from it, replacing today's duplicated
`UNDERWRITING_CHECKS` constant. Check `key`s are stable strings so the generated
document resolves sections by key (not by fragile numeric index).

### New Construction Strategy checks

Order matches the Cactus "Extracting Information" screen (deduped to unique items):

1. `project-info` — Project information
2. `unit-mix` — Unit mix
3. `income-expenses` — Property-level income & expenses
4. `investment-cost` — Investment cost assumptions
5. `exit-disposition` — Exit / disposition assumptions
6. `financing` — Financing assumptions
7. `gp-lp-terms` — GP/LP terms

### Value-Add checks

1. `project-info` — Project information
2. `rent-roll` — Current rent roll & unit mix
3. `income-expenses-inplace` — Property-level income & expenses (in-place)
4. `renovation-budget` — Renovation & capex budget
5. `stabilized-proforma` — Stabilized (post-reno) pro-forma
6. `financing` — Financing assumptions
7. `exit-disposition` — Exit / disposition assumptions

`project-info`, `financing`, and `exit-disposition` keys are shared across both
strategies and resolve to the same section builder.

## Data model

`DealUnderwriting` (`src/data/types.ts`) gains a `strategy` field:

```ts
export interface DealUnderwriting {
  strategy: UnderwritingStrategyId  // NEW — which strategy this underwriting uses
  tier: string                      // now holds the strategy's display label
  selectedChecks: number[]          // indices into THIS strategy's checks list
  status?: 'generating' | 'ready'
  placement?: { documentName: string; ... }
}
```

- `selectedChecks` indices are **relative to the strategy's check array**. They
  are only meaningful when read together with `strategy`.
- `tier` is repurposed to carry the strategy's display label (used by the
  document subtitle). The 4 tier-name bands (`tierForCount`) are removed.
- `strategy` is optional-safe on read: any legacy record without it falls back to
  `DEFAULT_STRATEGY`. Store default becomes
  `{ strategy: DEFAULT_STRATEGY, tier: <label>, selectedChecks: [] }`.

No data migration is required — no seeded deal sets `underwriting`, and the store
default is created fresh.

### Helper changes (`UnderwritingDepth.tsx` exports)

- Remove `UNDERWRITING_CHECKS`, `UNDERWRITING_TOTAL`, `tierForCount`,
  `DEFAULT_UNDERWRITING_SELECTION` in their current global form.
- Replace with strategy-aware equivalents:
  - `defaultSelectionFor(strategyId)` → `Set<number>` = all checks selected.
  - `underwritingFromSelection(strategyId, sel)` → `DealUnderwriting`
    (`tier` = strategy label, `selectedChecks` = sorted indices).

## Component changes

### `UnderwritingDepth` (`src/components/deals/UnderwritingDepth.tsx`)

Controlled contract widens to carry the strategy alongside the selection.

```ts
function UnderwritingDepth({
  strategy,               // current strategy id
  value,                  // Set<number> — selected check indices for this strategy
  onStrategyChange,       // (id) => void
  onChange,               // (Set<number>) => void
}: { ... })
```

Layout, top to bottom:

1. Header row: "Underwriting strategy" label + a `Badge` showing the strategy name.
2. **Blueprint `Select`** listing the two strategies. Each option shows the
   strategy label with its description. Changing strategy calls
   `onStrategyChange(id)` **and** resets the selection to
   `defaultSelectionFor(id)` (all 7 on).
3. Existing "Fast / Thorough" slider — `max` = the strategy's check count (7),
   selects the first N of that strategy's checks.
4. Depth readout: "**N** of 7 checks" (replaces the tier-count line).
5. Show/hide checks toggle → the strategy's checks with per-check on/off, exactly
   as today but sourced from the strategy.

Uncontrolled (self-managed) mode keeps working, defaulting to `DEFAULT_STRATEGY`.

### `CreateDealModal` (`src/components/deals/CreateDealModal.tsx`)

- Add `underwritingStrategy` state (default `DEFAULT_STRATEGY`).
- `underwritingSel` defaults to `defaultSelectionFor(DEFAULT_STRATEGY)`.
- Pass `strategy` / `onStrategyChange` into `UnderwritingDepth`.
- On submit, build the draft underwriting via
  `underwritingFromSelection(strategy, sel)`.
- Reset handler resets both strategy and selection.

### Planner setup modal (`UnderwritingPlannerRow.tsx`)

- Track `setupStrategy` alongside `setupSelection`; seed both from
  `listing.underwriting` (falling back to `DEFAULT_STRATEGY` / its default set).
- Pass strategy into the modal's `UnderwritingDepth`.
- `startGeneration` persists via `underwritingFromSelection(strategy, sel)`.
- `runSelection` and `runStrategy` both feed `UnderwritingProgress`.

### `UnderwritingProgress` (`UnderwritingProgress.tsx`)

- Accept `strategy` + `selectedChecks`.
- Resolve step labels from the strategy's checks, rendering each as
  **"Building {label}…"** while active/pending to match the Cactus screen.
- Duration scaling unchanged.

## Generated document (`src/features/editor/underwritingPages.ts`)

Replace the index-keyed `SECTIONS` array with a **key-keyed builder map**:

```ts
const SECTION_BUILDERS: Record<string, (c: Ctx, property?: Property) => Section>
```

Keys correspond to the strategy check `key`s. `buildUnderwritingSection` resolves
the strategy's checks, filters to `selectedChecks`, and builds a section per
selected check via its `key`.

Section builders (deterministic fake figures from the property, as today):

| Key | Section |
|---|---|
| `project-info` | Project Information — address, property type, size, year built, zoning, parcel. |
| `unit-mix` | Unit Mix — unit types, count, avg SF, projected rent (new construction). |
| `income-expenses` | Pro-Forma Income & Expenses — PGI, vacancy, EGI, OpEx, NOI (reuses today's NOI logic). |
| `income-expenses-inplace` | In-Place Income & Expenses — same shape, labeled as current/in-place. |
| `investment-cost` | Investment Cost / Development Budget — land, hard costs, soft costs, contingency, total cost. |
| `exit-disposition` | Exit / Disposition Assumptions — hold period, exit cap, reversion value. |
| `financing` | Financing Assumptions — loan amount, LTV/LTC, rate, DSCR, debt yield (reuses cap/DSCR logic). |
| `gp-lp-terms` | GP/LP Terms — equity split, preferred return, promote/waterfall tiers. |
| `rent-roll` | Current Rent Roll — reuses today's rent roll section. |
| `renovation-budget` | Renovation & Capex Budget — scope line items, per-unit cost, total capex. |
| `stabilized-proforma` | Stabilized Pro-Forma — in-place vs. post-reno rents, NOI lift, return on cost. |

Summary page updates:
- Subtitle: `"{strategy label} · N of 7 analyses · Generated by Cactus · {address}"`.
- Scope table lists the strategy's checks with ✓ Included / — per selection.

The existing generic builders (`t12Section`, `salesCompsSection`,
`rentCompsSection`, `cashFlowSection`, `tenantCreditSection`,
`leaseAbstractionSection`, `demographicsSection`, `environmentalSection`,
`sensitivitySection`) that no strategy references are removed. `rentRollSection`,
`noiSection`, and `capDscrSection` logic is retained/adapted for the reused keys.

## Testing

- `seed.test.ts` and any store tests still pass (no underwriting in seed).
- Manual: create a deal with each strategy, confirm slider caps at 7, switching
  strategy resets checks, progress screen shows the right "Building …" steps, and
  the generated editor document renders one section per selected check with the
  strategy in the subtitle. (No Playwright — run dev, user verifies.)

## Open questions

None — all resolved during brainstorming.
