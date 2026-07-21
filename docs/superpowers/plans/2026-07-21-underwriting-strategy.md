# Underwriting Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a strategy chooser above the underwriting depth slider so that picking a strategy (New Construction or Value-Add) swaps the whole check list that drives the slider, the generation-progress steps, and the generated document sections.

**Architecture:** Introduce one pure, framework-free catalog module (`strategies.ts`) as the single source of truth for strategy metadata + ordered check lists + selection helpers. The depth control, progress screen, and document builder all read from it. Each check carries a stable string `key`; the editor resolves a section builder per key. Everything stays deterministic, client-side theater — no backend.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Blueprint React (`Select`, `Badge`, `Progress`) · Vitest.

## Global Constraints

- Package manager is Bun. Run tests with `bun --bun run test` (alias for `vitest run`). Vitest picks up any `**/*.test.ts` under `src/`; default environment is `node` (no DOM) — only TDD pure logic, verify components manually.
- All UI uses Blueprint React components and Bootstrap 5 utility classes. No Tailwind.
- FontAwesome: default `pro-regular`. Never pass `fixedWidth` to `FontAwesomeIcon`.
- No Playwright. Run what you can (tsc via the dev server / `bun --bun run build`, `bun --bun run test`); ask the user to visually verify component behavior.
- All generated figures are FAKE but derived deterministically from the property. Never use `Math.random` or `Date.now` in generation code.
- Two strategies only. Default strategy is `new-construction`. The depth "tier name" concept (Rapid Screen/Standard/Deep Dive/Institutional) is retired; the badge shows the strategy label.

---

## File Structure

- **Create** `src/components/deals/underwriting/strategies.ts` — pure catalog: types, `UNDERWRITING_STRATEGIES`, `DEFAULT_STRATEGY`, `checksFor`, `defaultSelectionFor`, `underwritingFromSelection`, `strategyLabel`.
- **Create** `src/components/deals/underwriting/strategies.test.ts` — unit tests for the catalog + helpers.
- **Create** `src/features/editor/underwritingPages.test.ts` — tests the strategy-aware document builder.
- **Modify** `src/data/types.ts` — add `strategy` to `DealUnderwriting`.
- **Modify** `src/data/store.ts` — default underwriting record includes a strategy.
- **Modify** `src/features/editor/underwritingPages.ts` — key-keyed section builders + strategy-aware assembly.
- **Modify** `src/components/deals/underwriting/UnderwritingProgress.tsx` — strategy-aware "Building …" steps.
- **Modify** `src/components/deals/UnderwritingDepth.tsx` — strategy `Select` + strategy-bound slider; drop the old global exports.
- **Modify** `src/components/deals/CreateDealModal.tsx` — carry strategy state, wire into control + draft.
- **Modify** `src/components/deals/underwriting/UnderwritingPlannerRow.tsx` — carry strategy through setup + run + persist.

---

## Task 1: Strategy catalog module

**Files:**
- Create: `src/components/deals/underwriting/strategies.ts`
- Test: `src/components/deals/underwriting/strategies.test.ts`

**Interfaces:**
- Consumes: `DealUnderwriting` from `#/data/types` (type-only).
- Produces:
  - `type UnderwritingStrategyId = 'new-construction' | 'value-add'`
  - `interface UnderwritingCheck { key: string; label: string }`
  - `interface UnderwritingStrategyDef { id: UnderwritingStrategyId; label: string; description: string; checks: UnderwritingCheck[] }`
  - `const UNDERWRITING_STRATEGIES: Record<UnderwritingStrategyId, UnderwritingStrategyDef>`
  - `const STRATEGY_ORDER: UnderwritingStrategyId[]`
  - `const DEFAULT_STRATEGY: UnderwritingStrategyId`
  - `function checksFor(id: UnderwritingStrategyId): UnderwritingCheck[]`
  - `function strategyLabel(id: UnderwritingStrategyId): string`
  - `function defaultSelectionFor(id: UnderwritingStrategyId): Set<number>` — all checks selected
  - `function underwritingFromSelection(id: UnderwritingStrategyId, sel: Set<number>): DealUnderwriting`

- [ ] **Step 1: Write the failing test**

Create `src/components/deals/underwriting/strategies.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  UNDERWRITING_STRATEGIES,
  STRATEGY_ORDER,
  DEFAULT_STRATEGY,
  checksFor,
  strategyLabel,
  defaultSelectionFor,
  underwritingFromSelection,
} from './strategies'

describe('strategy catalog', () => {
  it('defaults to new construction and lists both strategies in order', () => {
    expect(DEFAULT_STRATEGY).toBe('new-construction')
    expect(STRATEGY_ORDER).toEqual(['new-construction', 'value-add'])
  })

  it('gives each strategy 7 checks with unique keys', () => {
    for (const id of STRATEGY_ORDER) {
      const checks = checksFor(id)
      expect(checks).toHaveLength(7)
      expect(new Set(checks.map((c) => c.key)).size).toBe(7)
    }
  })

  it('orders new-construction checks to match the Cactus screen', () => {
    expect(checksFor('new-construction').map((c) => c.key)).toEqual([
      'project-info',
      'unit-mix',
      'income-expenses',
      'investment-cost',
      'exit-disposition',
      'financing',
      'gp-lp-terms',
    ])
  })

  it('exposes the display label', () => {
    expect(strategyLabel('new-construction')).toBe(
      UNDERWRITING_STRATEGIES['new-construction'].label,
    )
  })

  it('default selection turns every check on', () => {
    expect(defaultSelectionFor('value-add')).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
  })

  it('builds a persistable record with the strategy label as tier and sorted checks', () => {
    const uw = underwritingFromSelection('value-add', new Set([2, 0, 1]))
    expect(uw.strategy).toBe('value-add')
    expect(uw.tier).toBe(strategyLabel('value-add'))
    expect(uw.selectedChecks).toEqual([0, 1, 2])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- strategies`
Expected: FAIL — cannot resolve `./strategies`.

- [ ] **Step 3: Write the module**

Create `src/components/deals/underwriting/strategies.ts`:

```ts
import type { DealUnderwriting } from '#/data/types'

export type UnderwritingStrategyId = 'new-construction' | 'value-add'

/** One analysis step. `key` is stable and resolves the document section builder. */
export interface UnderwritingCheck {
  key: string
  /** Noun shown in the depth toggles and the document scope table. */
  label: string
}

export interface UnderwritingStrategyDef {
  id: UnderwritingStrategyId
  /** Full display label, e.g. "New Construction Strategy". */
  label: string
  /** One-line explanation shown in the strategy dropdown. */
  description: string
  checks: UnderwritingCheck[]
}

export const UNDERWRITING_STRATEGIES: Record<
  UnderwritingStrategyId,
  UnderwritingStrategyDef
> = {
  'new-construction': {
    id: 'new-construction',
    label: 'New Construction Strategy',
    description:
      'Underwrite the upside of redeveloping or rebuilding the property from the ground up.',
    checks: [
      { key: 'project-info', label: 'Project information' },
      { key: 'unit-mix', label: 'Unit mix' },
      { key: 'income-expenses', label: 'Property-level income & expenses' },
      { key: 'investment-cost', label: 'Investment cost assumptions' },
      { key: 'exit-disposition', label: 'Exit / disposition assumptions' },
      { key: 'financing', label: 'Financing assumptions' },
      { key: 'gp-lp-terms', label: 'GP/LP terms' },
    ],
  },
  'value-add': {
    id: 'value-add',
    label: 'Value-Add Strategy',
    description:
      'Underwrite the value of renovating and improving the property before selling or leasing.',
    checks: [
      { key: 'project-info', label: 'Project information' },
      { key: 'rent-roll', label: 'Current rent roll & unit mix' },
      { key: 'income-expenses-inplace', label: 'Property-level income & expenses (in-place)' },
      { key: 'renovation-budget', label: 'Renovation & capex budget' },
      { key: 'stabilized-proforma', label: 'Stabilized (post-reno) pro-forma' },
      { key: 'financing', label: 'Financing assumptions' },
      { key: 'exit-disposition', label: 'Exit / disposition assumptions' },
    ],
  },
}

export const STRATEGY_ORDER: UnderwritingStrategyId[] = ['new-construction', 'value-add']

export const DEFAULT_STRATEGY: UnderwritingStrategyId = 'new-construction'

/** Coerce any (possibly legacy/undefined) value to a known strategy id. */
export function coerceStrategy(id: string | undefined): UnderwritingStrategyId {
  return id === 'value-add' || id === 'new-construction' ? id : DEFAULT_STRATEGY
}

export function checksFor(id: UnderwritingStrategyId): UnderwritingCheck[] {
  return UNDERWRITING_STRATEGIES[id].checks
}

export function strategyLabel(id: UnderwritingStrategyId): string {
  return UNDERWRITING_STRATEGIES[id].label
}

/** The default depth: every check in the strategy turned on. */
export function defaultSelectionFor(id: UnderwritingStrategyId): Set<number> {
  return new Set(checksFor(id).map((_, i) => i))
}

/** Convert a strategy + selected check indices into a persistable record. */
export function underwritingFromSelection(
  id: UnderwritingStrategyId,
  sel: Set<number>,
): DealUnderwriting {
  return {
    strategy: id,
    tier: strategyLabel(id),
    selectedChecks: [...sel].sort((a, b) => a - b),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test -- strategies`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/underwriting/strategies.ts src/components/deals/underwriting/strategies.test.ts
git commit -m "feat(underwriting): add strategy catalog + selection helpers"
```

---

## Task 2: Data model — `strategy` on `DealUnderwriting`

**Files:**
- Modify: `src/data/types.ts:269-283`
- Modify: `src/data/store.ts:164`

**Interfaces:**
- Consumes: `UnderwritingStrategyId`, `DEFAULT_STRATEGY`, `strategyLabel` from `../components/deals/underwriting/strategies` (in store.ts).
- Produces: `DealUnderwriting.strategy: UnderwritingStrategyId`.

- [ ] **Step 1: Add the field to the type**

In `src/data/types.ts`, add the import at the top of the file (near the other imports) and update the interface. Replace lines 269-283:

```ts
/** The underwriting scope chosen for a deal — which strategy, its checks, and progress. */
export interface DealUnderwriting {
  /** Which underwriting strategy this deal uses. Drives the check list end to end. */
  strategy: UnderwritingStrategyId
  /** Display label for the depth badge / document subtitle — the strategy's label. */
  tier: string
  /** Indices into THIS strategy's checks list (see `checksFor`). Read with `strategy`. */
  selectedChecks: number[]
  /**
   * Where the underwriting is in the Cactus generation flow. Absent is treated
   * as 'not-started'. 'generating' is the auto-start signal the deal-overview
   * planner reads on mount (set when a deal is created with underwriting on).
   */
  status?: 'not-started' | 'generating' | 'ready'
  /** Once generated, where the underwriting page was filed. */
  placement?: { documentId?: string; documentName: string }
}
```

Add this import near the top of `src/data/types.ts` (with the other imports, or create one if none):

```ts
import type { UnderwritingStrategyId } from '#/components/deals/underwriting/strategies'
```

- [ ] **Step 2: Update the store default**

In `src/data/store.ts`, add the import near the top:

```ts
import { DEFAULT_STRATEGY, strategyLabel } from '#/components/deals/underwriting/strategies'
```

Replace line 164:

```ts
  const base: DealUnderwriting =
    existing.underwriting ?? {
      strategy: DEFAULT_STRATEGY,
      tier: strategyLabel(DEFAULT_STRATEGY),
      selectedChecks: [],
    }
```

- [ ] **Step 3: Verify the build type-checks**

Run: `bun --bun run test -- strategies` (sanity) then `bun --bun run build`
Expected: build succeeds. If tsc reports call sites of `underwritingFromSelection` / `DEFAULT_UNDERWRITING_SELECTION` — those are fixed in Tasks 4–5; note them but do not fix here yet. If the build fails ONLY on those known call sites, that's expected at this checkpoint; if it fails elsewhere, fix it.

> Note: `types.ts` and `strategies.ts` now import from each other's packages but not circularly at the type level (strategies imports a type from types; types imports a type from strategies). TypeScript resolves type-only cycles fine. If a runtime circular-import warning appears, keep both imports `type`-only (they are).

- [ ] **Step 4: Commit**

```bash
git add src/data/types.ts src/data/store.ts
git commit -m "feat(underwriting): add strategy field to DealUnderwriting"
```

---

## Task 3: Strategy-aware document generation

**Files:**
- Modify: `src/features/editor/underwritingPages.ts` (whole rework of section registry + assembly)
- Test: `src/features/editor/underwritingPages.test.ts`

**Interfaces:**
- Consumes: `checksFor`, `coerceStrategy`, `strategyLabel` from `#/components/deals/underwriting/strategies`; `DealUnderwriting`, `Property` from `#/data/types`.
- Produces: unchanged public signature `buildUnderwritingSection(property, underwriting): Page[]`.

- [ ] **Step 1: Write the failing test**

Create `src/features/editor/underwritingPages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildUnderwritingSection } from './underwritingPages'
import type { DealUnderwriting } from '#/data/types'

const READY = (over: Partial<DealUnderwriting>): DealUnderwriting => ({
  strategy: 'new-construction',
  tier: 'New Construction Strategy',
  selectedChecks: [0, 1, 2, 3, 4, 5, 6],
  status: 'ready',
  ...over,
})

describe('buildUnderwritingSection', () => {
  it('returns nothing until the underwriting is ready', () => {
    expect(buildUnderwritingSection(undefined, READY({ status: 'generating' }))).toEqual([])
    expect(buildUnderwritingSection(undefined, undefined)).toEqual([])
  })

  it('builds a summary page plus content pages for the selected new-construction checks', () => {
    const pages = buildUnderwritingSection(undefined, READY({}))
    expect(pages[0].name).toBe('Underwriting')
    // Summary subtitle carries the strategy label.
    const subtitle = pages[0].blocks.find(
      (b) => b.type === 'text' && String((b as { text?: string }).text).includes('Generated by Cactus'),
    ) as { text: string }
    expect(subtitle.text).toContain('New Construction Strategy')
    // 7 checks → summary + ceil(7/2) content pages = 1 + 4.
    expect(pages).toHaveLength(5)
  })

  it('builds value-add sections when that strategy is chosen', () => {
    const pages = buildUnderwritingSection(
      undefined,
      READY({ strategy: 'value-add', tier: 'Value-Add Strategy', selectedChecks: [1, 3] }),
    )
    const names = pages.map((p) => p.name).join(' | ')
    expect(names).toContain('Current Rent Roll')
    expect(names).toContain('Renovation')
  })

  it('falls back to the default strategy when the record has none (legacy)', () => {
    const legacy = { tier: 'x', selectedChecks: [0], status: 'ready' } as unknown as DealUnderwriting
    const pages = buildUnderwritingSection(undefined, legacy)
    expect(pages.length).toBeGreaterThan(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- underwritingPages`
Expected: FAIL — the current builder is index-based against a removed 12-list; assertions on names/subtitle/strategy fail (or the file still references the old `CHECK_LABELS`/`SECTIONS`).

- [ ] **Step 3: Rework the builders and assembly**

In `src/features/editor/underwritingPages.ts`:

**3a.** Remove the local `CHECK_LABELS` constant (lines ~31-44) and add this import near the top (after the existing imports):

```ts
import {
  checksFor,
  coerceStrategy,
  strategyLabel,
} from '#/components/deals/underwriting/strategies'
```

**3b.** Keep all existing helpers (`hcell`, `vcell`, `table`, `heading`, `text`, `spacer`, styles, `money`, `pct`, `perSf`, `Ctx`, `buildCtx`, `section`, `TENANTS`). Keep `rentRollSection`, `noiSection`, `capDscrSection` (they are reused/adapted below). **Delete** the now-unreferenced builders: `t12Section`, `salesCompsSection`, `rentCompsSection`, `cashFlowSection`, `tenantCreditSection`, `leaseAbstractionSection`, `demographicsSection`, `environmentalSection`, `sensitivitySection`, and the `SECTIONS` array (lines ~389-403).

**3c.** Update `buildCtx`'s signature is unchanged. Add the new section builders. Place them after `capDscrSection`:

```ts
function projectInfoSection(c: Ctx, property: Property | undefined): Section {
  const type = property?.propertyType ?? 'Multifamily'
  const year = property?.yearBuilt && property.yearBuilt > 0 ? String(property.yearBuilt) : '—'
  const zoning = property?.zoning || 'Mixed-use (MU-2)'
  const lot = property?.lotSqFt && property.lotSqFt > 0 ? property.lotSqFt : Math.round(c.sqft * 1.8)
  const submarket = property?.submarket || 'Central Business District'
  return section(
    'Project Information',
    table([
      [hcell('Property Type'), vcell(type, { align: 'left' })],
      [hcell('Submarket'), vcell(submarket, { align: 'left' })],
      [hcell('Year Built'), vcell(year)],
      [hcell('Building Size'), vcell(`${c.sqft.toLocaleString()} SF`)],
      [hcell('Lot Size'), vcell(`${lot.toLocaleString()} SF`)],
      [hcell('Zoning'), vcell(zoning, { align: 'left' })],
    ]),
  )
}

function unitMixSection(c: Ctx): Section {
  const units = Math.max(4, Math.round(c.sqft / 850))
  const studio = Math.round(units * 0.2)
  const one = Math.round(units * 0.45)
  const two = units - studio - one
  const baseRent = Math.max(1200, Math.round((c.rentPerSf * 850) / 12))
  return section(
    'Unit Mix',
    table([
      [hcell('Unit Type'), hcell('Units', 'right'), hcell('Avg SF', 'right'), hcell('Proj. Rent / mo', 'right')],
      [vcell('Studio', { align: 'left' }), vcell(String(studio)), vcell('520'), vcell(money(baseRent * 0.8))],
      [vcell('1 Bed / 1 Bath', { align: 'left' }), vcell(String(one)), vcell('780'), vcell(money(baseRent))],
      [vcell('2 Bed / 2 Bath', { align: 'left' }), vcell(String(two)), vcell('1,150'), vcell(money(baseRent * 1.45))],
      [hcell('Total'), hcell(String(units), 'right'), hcell('—', 'right'), hcell('—', 'right')],
    ]),
  )
}

function incomeExpensesSection(c: Ctx, label: string): Section {
  return section(
    label,
    table([
      [hcell('Potential Gross Income'), vcell(money(c.pgi))],
      [hcell('Vacancy & Credit Loss'), vcell(`(${money(c.vacancy)})`)],
      [hcell('Effective Gross Income'), vcell(money(c.egi))],
      [hcell('Operating Expenses'), vcell(`(${money(c.opex)})`)],
      [hcell('Net Operating Income'), vcell(money(c.noi))],
    ]),
  )
}

function investmentCostSection(c: Ctx): Section {
  const land = Math.round(c.price * 0.35)
  const hard = Math.round(c.sqft * 185)
  const soft = Math.round(hard * 0.18)
  const contingency = Math.round((hard + soft) * 0.05)
  const total = land + hard + soft + contingency
  return section(
    'Investment Cost Assumptions',
    table([
      [hcell('Land / Acquisition'), vcell(money(land))],
      [hcell('Hard Costs'), vcell(money(hard))],
      [hcell('Soft Costs'), vcell(money(soft))],
      [hcell('Contingency (5%)'), vcell(money(contingency))],
      [hcell('Total Project Cost'), vcell(money(total))],
    ]),
  )
}

function exitDispositionSection(c: Ctx): Section {
  const exitCap = c.cap - 0.005
  const exitValue = Math.round(c.noi / exitCap / 10_000) * 10_000
  return section(
    'Exit / Disposition Assumptions',
    table([
      [hcell('Hold Period'), vcell('5 years')],
      [hcell('Exit Cap Rate'), vcell(pct(exitCap))],
      [hcell('Projected Reversion Value'), vcell(money(exitValue))],
      [hcell('Cost of Sale'), vcell('2.0%')],
    ]),
  )
}

function financingSection(c: Ctx): Section {
  const dscr = c.noi / c.debtService
  return section(
    'Financing Assumptions',
    table([
      [hcell('Loan Amount (65% LTV)'), vcell(money(c.loan))],
      [hcell('Interest Rate'), vcell('7.5%')],
      [hcell('Amortization'), vcell('30 years')],
      [hcell('Debt Service Coverage'), vcell(`${dscr.toFixed(2)}x`)],
      [hcell('Debt Yield'), vcell(pct(c.noi / c.loan))],
    ]),
  )
}

function gpLpTermsSection(c: Ctx): Section {
  const equity = Math.round(c.price * 0.35)
  return section(
    'GP / LP Terms',
    table([
      [hcell('Total Equity'), vcell(money(equity))],
      [hcell('LP / GP Split'), vcell('90% / 10%', { align: 'left' })],
      [hcell('Preferred Return'), vcell('8.0%')],
      [hcell('Promote (above pref)'), vcell('20%')],
      [hcell('Target Equity Multiple'), vcell('1.9x')],
    ]),
  )
}

function renovationBudgetSection(c: Ctx): Section {
  const units = Math.max(4, Math.round(c.sqft / 850))
  const perUnit = 22_500
  const interior = units * perUnit
  const common = Math.round(interior * 0.3)
  const exterior = Math.round(c.sqft * 6)
  const total = interior + common + exterior
  return section(
    'Renovation & Capex Budget',
    table([
      [hcell('Scope'), hcell('Basis', 'right'), hcell('Cost', 'right')],
      [vcell('Interior units', { align: 'left' }), vcell(`${units} × ${money(perUnit)}`), vcell(money(interior))],
      [vcell('Common areas', { align: 'left' }), vcell('Lump sum'), vcell(money(common))],
      [vcell('Exterior / systems', { align: 'left' }), vcell(`${c.sqft.toLocaleString()} SF`), vcell(money(exterior))],
      [hcell('Total Capex'), hcell('', 'right'), vcell(money(total))],
    ]),
  )
}

function stabilizedProformaSection(c: Ctx): Section {
  const stabilizedNoi = Math.round(c.noi * 1.28)
  const stabilizedValue = Math.round(stabilizedNoi / c.cap / 10_000) * 10_000
  return section(
    'Stabilized (Post-Reno) Pro-Forma',
    table([
      [hcell('Metric'), hcell('In-Place', 'right'), hcell('Stabilized', 'right')],
      [vcell('Effective Gross Income', { align: 'left' }), vcell(money(c.egi)), vcell(money(Math.round(c.egi * 1.22)))],
      [vcell('Net Operating Income', { align: 'left' }), vcell(money(c.noi)), vcell(money(stabilizedNoi))],
      [vcell('Value @ Going-In Cap', { align: 'left' }), vcell(money(Math.round(c.noi / c.cap / 10_000) * 10_000)), vcell(money(stabilizedValue))],
    ]),
  )
}
```

**3d.** Replace the `SECTIONS` array with a key-keyed builder map. Add after the builders:

```ts
type SectionBuilder = (c: Ctx, property: Property | undefined) => Section

/** Resolves each strategy check `key` to its document section builder. */
const SECTION_BUILDERS: Record<string, SectionBuilder> = {
  'project-info': (c, p) => projectInfoSection(c, p),
  'unit-mix': (c) => unitMixSection(c),
  'income-expenses': (c) => incomeExpensesSection(c, 'Pro-Forma Income & Expenses'),
  'income-expenses-inplace': (c) => incomeExpensesSection(c, 'In-Place Income & Expenses'),
  'investment-cost': (c) => investmentCostSection(c),
  'exit-disposition': (c) => exitDispositionSection(c),
  'financing': (c) => financingSection(c),
  'gp-lp-terms': (c) => gpLpTermsSection(c),
  'rent-roll': (c) => renameSection(rentRollSection(c), 'Current Rent Roll'),
  'renovation-budget': (c) => renovationBudgetSection(c),
  'stabilized-proforma': (c) => stabilizedProformaSection(c),
}

/** Rename a section (and its heading block) without rebuilding it. */
function renameSection(s: Section, name: string): Section {
  const blocks = [...s.blocks]
  if (blocks[0]?.type === 'heading' || blocks[0]?.type === 'text') {
    blocks[0] = { ...blocks[0], text: name } as ContentBlock
  }
  return { name, blocks }
}
```

> Note: `section()` builds its heading via `text(name, sectionHeadingStyle)` as `blocks[0]`. `renameSection` swaps that first block's `text`. Keep `rentRollSection` and `noiSection`/`capDscrSection` present even though only `rentRollSection` is referenced by a key — delete `noiSection`/`capDscrSection` too if unreferenced after this wiring (the new `incomeExpensesSection`/`financingSection` replace them). Verify no remaining references before deleting.

**3e.** Rewrite `buildSummaryPage` scope + subtitle to be strategy-driven. Replace the body of `buildSummaryPage` (lines ~414-455) so it takes the resolved checks:

```ts
function buildSummaryPage(
  property: Property | undefined,
  uw: DealUnderwriting,
  c: Ctx,
): Page {
  const strategy = coerceStrategy(uw.strategy)
  const checks = checksFor(strategy)
  const selected = new Set(uw.selectedChecks)
  const scopeRows: Cell[][] = [
    [hcell('Analysis'), hcell('Status', 'right')],
    ...checks.map((check, i): Cell[] => [
      vcell(check.label, { align: 'left' }),
      vcell(selected.has(i) ? '✓ Included' : '—'),
    ]),
  ]

  const metricsTable: TableBlock = table([
    [hcell('Asking Price'), vcell(money(c.price))],
    [hcell('Cap Rate'), vcell(pct(c.cap))],
    [hcell('Net Operating Income'), vcell(money(c.noi))],
    [hcell('Building Size'), vcell(`${c.sqft.toLocaleString()} SF`)],
  ])

  const includedCount = checks.filter((_, i) => selected.has(i)).length
  return {
    id: uid('page'),
    name: 'Underwriting',
    logoSrc: LOGO_SRC,
    locked: true,
    blocks: [
      heading('Underwriting', headingStyle),
      text(
        `${strategyLabel(strategy)} · ${includedCount} of ${checks.length} analyses · Generated by Cactus · ${addressOf(property)}`,
        subtitleStyle,
      ),
      text(
        'This underwriting was assembled automatically by Cactus from property, market, and ' +
          'financial data. Figures are estimates for review and should be verified before use.',
        introStyle,
      ),
      spacer(8),
      text('Headline Metrics', sectionHeadingStyle),
      metricsTable,
      spacer(16),
      text('Scope', sectionHeadingStyle),
      table(scopeRows),
    ],
  }
}
```

**3f.** Rewrite `buildUnderwritingSection` (lines ~478-496) to resolve sections by key:

```ts
export function buildUnderwritingSection(
  property: Property | undefined,
  underwriting: DealUnderwriting | undefined,
): Page[] {
  if (!underwriting || underwriting.status !== 'ready') return []

  const ctx = buildCtx(property)
  const strategy = coerceStrategy(underwriting.strategy)
  const checks = checksFor(strategy)
  const selected = [...underwriting.selectedChecks]
    .filter((i) => i >= 0 && i < checks.length)
    .sort((a, b) => a - b)
  const sections = selected
    .map((i) => SECTION_BUILDERS[checks[i].key])
    .filter((b): b is SectionBuilder => Boolean(b))
    .map((build) => build(ctx, property))

  const pages: Page[] = [buildSummaryPage(property, underwriting, ctx)]
  const PER_PAGE = 2
  for (let i = 0; i < sections.length; i += PER_PAGE) {
    pages.push(buildContentPage(sections.slice(i, i + PER_PAGE)))
  }
  return pages
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test -- underwritingPages`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/underwritingPages.ts src/features/editor/underwritingPages.test.ts
git commit -m "feat(underwriting): generate strategy-specific document sections"
```

---

## Task 4: Strategy-aware generation progress

**Files:**
- Modify: `src/components/deals/underwriting/UnderwritingProgress.tsx`

**Interfaces:**
- Consumes: `checksFor`, `coerceStrategy`, `UnderwritingStrategyId` from `../strategies`.
- Produces: `UnderwritingProgress` now accepts `strategy?: UnderwritingStrategyId` (defaults to `DEFAULT_STRATEGY` via `coerceStrategy`).

- [ ] **Step 1: Update imports and props**

In `src/components/deals/underwriting/UnderwritingProgress.tsx`, replace the import on line 6:

```ts
import { checksFor, coerceStrategy } from '../strategies'
import type { UnderwritingStrategyId } from '../strategies'
```

Update the props (lines 21-27):

```ts
export function UnderwritingProgress({
  strategy,
  selectedChecks,
  onComplete,
}: {
  strategy?: UnderwritingStrategyId
  selectedChecks: number[]
  onComplete: () => void
}) {
```

- [ ] **Step 2: Resolve steps from the strategy and label them "Building …"**

Replace the `steps` derivation (lines 30-33):

```ts
  const checks = checksFor(coerceStrategy(strategy))
  const steps =
    selectedChecks.length > 0
      ? [...selectedChecks]
          .sort((a, b) => a - b)
          .filter((i) => i >= 0 && i < checks.length)
          .map((i) => `Building ${checks[i].label.toLowerCase()}`)
      : ['Assembling underwriting']
```

- [ ] **Step 3: Verify the build type-checks**

Run: `bun --bun run build`
Expected: succeeds (callers pass no `strategy` yet — it defaults; wired in Task 5). Known-failing call sites from Task 2 (`underwritingFromSelection`, `DEFAULT_UNDERWRITING_SELECTION`) may still error here — they are fixed in Task 5. If the only failures are those, proceed; otherwise fix.

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/underwriting/UnderwritingProgress.tsx
git commit -m "feat(underwriting): drive progress steps from the strategy"
```

---

## Task 5: Strategy chooser in the depth control + wire both call sites

This is one cohesive change: the depth control's contract becomes strategy-aware, and its two consumers (Create Deal modal, planner setup modal) are updated to match. Ends with a green build and no remaining references to the old global exports.

**Files:**
- Modify: `src/components/deals/UnderwritingDepth.tsx` (rework)
- Modify: `src/components/deals/CreateDealModal.tsx` (state + wiring)
- Modify: `src/components/deals/underwriting/UnderwritingPlannerRow.tsx` (state + wiring)

**Interfaces:**
- Consumes: `strategies.ts` catalog + helpers; `Select`, `Badge`, `Separator` from Blueprint.
- Produces: `UnderwritingDepth` props `{ strategy?, value?, onStrategyChange?, onChange? }` — controlled when `strategy`+`onStrategyChange`+`value`+`onChange` are supplied, self-managed otherwise. Removes exports `UNDERWRITING_CHECKS`, `UNDERWRITING_TOTAL`, `tierForCount`, `DEFAULT_UNDERWRITING_SELECTION`, `underwritingFromSelection`.

- [ ] **Step 1: Rework `UnderwritingDepth.tsx`**

Replace the entire file `src/components/deals/UnderwritingDepth.tsx` with:

```tsx
import { useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";
import {
  faCircle,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import {
  UNDERWRITING_STRATEGIES,
  STRATEGY_ORDER,
  DEFAULT_STRATEGY,
  checksFor,
  strategyLabel,
  defaultSelectionFor,
  type UnderwritingStrategyId,
} from "./underwriting/strategies";
import "./UnderwritingDepth.scss";

/**
 * Underwriting control — pick a strategy (New Construction / Value-Add), then set
 * how thorough the analysis is. The strategy chooses which checks exist; the
 * slider selects the first N of them, and individual checks can be toggled.
 * Controlled when `strategy`/`value`/`onStrategyChange`/`onChange` are supplied,
 * otherwise fully self-managed.
 */
export function UnderwritingDepth({
  strategy,
  value,
  onStrategyChange,
  onChange,
}: {
  strategy?: UnderwritingStrategyId;
  value?: Set<number>;
  onStrategyChange?: (next: UnderwritingStrategyId) => void;
  onChange?: (next: Set<number>) => void;
} = {}) {
  const [internalStrategy, setInternalStrategy] =
    useState<UnderwritingStrategyId>(DEFAULT_STRATEGY);
  const [internalSel, setInternalSel] = useState<Set<number>>(() =>
    defaultSelectionFor(DEFAULT_STRATEGY),
  );
  const [checksOpen, setChecksOpen] = useState(false);

  const activeStrategy = strategy ?? internalStrategy;
  const selectedSet = value ?? internalSel;
  const checks = checksFor(activeStrategy);
  const total = checks.length;
  const count = selectedSet.size;
  const fillPct = (count / total) * 100;

  const setStrategy = (next: UnderwritingStrategyId) => {
    // Switching strategy resets the depth to that strategy's full check list.
    const resetSel = defaultSelectionFor(next);
    if (onStrategyChange) onStrategyChange(next);
    else setInternalStrategy(next);
    if (onChange) onChange(resetSel);
    else setInternalSel(resetSel);
  };

  const updateSel = (next: Set<number>) =>
    onChange ? onChange(next) : setInternalSel(next);

  // Dragging the slider selects the first N checks in order.
  const setDepth = (n: number) =>
    updateSel(new Set(Array.from({ length: n }, (_, i) => i)));

  // Clicking a check toggles just that one (selection may be non-contiguous).
  const toggleCheck = (i: number) => {
    const next = new Set(selectedSet);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    updateSel(next);
  };

  return (
    <div className="underwriting-depth border rounded p-3">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
        <span className="fw-semibold">Underwriting strategy</span>
        <Badge variant="secondary" appearance="accent" className="underwriting-depth__badge">
          {strategyLabel(activeStrategy)}
        </Badge>
      </div>

      <Select
        value={activeStrategy}
        onValueChange={(v) => v && setStrategy(v as UnderwritingStrategyId)}
      >
        <Select.Trigger>
          <Select.Value>
            {(v) => strategyLabel(v as UnderwritingStrategyId)}
          </Select.Value>
        </Select.Trigger>
        <Select.Content>
          {STRATEGY_ORDER.map((id) => (
            <Select.Item key={id} value={id}>
              <div className="d-flex flex-column">
                <span className="fw-medium">{UNDERWRITING_STRATEGIES[id].label}</span>
                <span className="fs-small text-muted">
                  {UNDERWRITING_STRATEGIES[id].description}
                </span>
              </div>
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      <p className="fs-small text-muted mt-2 mb-3">
        {UNDERWRITING_STRATEGIES[activeStrategy].description} Set how thorough the
        analysis is below.
      </p>

      <div className="d-flex justify-content-between fs-small text-muted mb-1">
        <span>Fast</span>
        <span>Thorough</span>
      </div>
      <input
        type="range"
        className="underwriting-depth__slider"
        min={0}
        max={total}
        step={1}
        value={count}
        onChange={(e) => setDepth(Number(e.target.value))}
        aria-label="Underwriting depth"
        style={{ "--fill": `${fillPct}%` } as React.CSSProperties}
      />

      <Separator className="my-3" />

      <div className="d-flex align-items-center justify-content-between gap-2">
        <button
          type="button"
          className="underwriting-depth__toggle"
          onClick={() => setChecksOpen((o) => !o)}
        >
          <FontAwesomeIcon icon={checksOpen ? faChevronDown : faChevronRight} />
          {checksOpen ? "Hide checks" : "Show checks"}
        </button>
        <span className="fs-small text-muted">
          <span className="fw-semibold text-body">{count}</span> of {total} checks
        </span>
      </div>

      {checksOpen && (
        <div className="underwriting-depth__checks mt-3">
          {checks.map((check, i) => {
            const on = selectedSet.has(i);
            return (
              <button
                type="button"
                key={check.key}
                className={`underwriting-depth__check${on ? " is-on" : ""}`}
                onClick={() => toggleCheck(i)}
                aria-pressed={on}
              >
                <span className="underwriting-depth__check-icon">
                  <FontAwesomeIcon icon={faCircle} className="uw-icon uw-icon--off" />
                  <FontAwesomeIcon icon={faCircleCheck} className="uw-icon uw-icon--on" />
                </span>
                <span>{check.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire `CreateDealModal.tsx`**

**2a.** Replace the import block (lines 56-60) that pulls from `./UnderwritingDepth`:

```tsx
import { UnderwritingDepth } from "./UnderwritingDepth";
import {
  DEFAULT_STRATEGY,
  defaultSelectionFor,
  underwritingFromSelection,
  type UnderwritingStrategyId,
} from "./underwriting/strategies";
```

**2b.** Add strategy state next to `underwritingSel` (replace lines 222-226):

```tsx
  const [underwritingStrategy, setUnderwritingStrategy] =
    useState<UnderwritingStrategyId>(DEFAULT_STRATEGY);
  // The underwriting depth selection — indices into the chosen strategy's checks.
  const [underwritingSel, setUnderwritingSel] = useState<Set<number>>(() =>
    defaultSelectionFor(DEFAULT_STRATEGY),
  );
```

**2c.** Update the reset (line 335) to reset both:

```tsx
    setUnderwritingStrategy(DEFAULT_STRATEGY);
    setUnderwritingSel(defaultSelectionFor(DEFAULT_STRATEGY));
```

**2d.** Update the draft build (lines 439-442):

```tsx
      underwriting:
        withDocuments && underwritingOn
          ? underwritingFromSelection(underwritingStrategy, underwritingSel)
          : undefined,
```

**2e.** Update the JSX usage (lines 984-987):

```tsx
                          <UnderwritingDepth
                            strategy={underwritingStrategy}
                            value={underwritingSel}
                            onStrategyChange={setUnderwritingStrategy}
                            onChange={setUnderwritingSel}
                          />
```

- [ ] **Step 3: Wire `UnderwritingPlannerRow.tsx`**

**3a.** Replace the import block (lines 10-14):

```tsx
import { UnderwritingDepth } from "../UnderwritingDepth";
import {
  DEFAULT_STRATEGY,
  defaultSelectionFor,
  underwritingFromSelection,
  coerceStrategy,
  type UnderwritingStrategyId,
} from "./strategies";
```

**3b.** Replace the initial-selection helper + state (lines 34-52) with strategy-aware versions:

```tsx
  const initialStrategy = (): UnderwritingStrategyId =>
    coerceStrategy(listing.underwriting?.strategy);
  const initialSelection = (strat: UnderwritingStrategyId) =>
    new Set(
      listing.underwriting?.selectedChecks?.length
        ? listing.underwriting.selectedChecks
        : defaultSelectionFor(strat),
    );

  const [phase, setPhase] = useState<Phase>(
    listing.underwriting?.status === "ready"
      ? "ready"
      : listing.underwriting?.status === "generating"
        ? "generating"
        : "idle",
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [runStrategy, setRunStrategy] = useState<UnderwritingStrategyId>(initialStrategy);
  const [runSelection, setRunSelection] = useState<Set<number>>(() =>
    initialSelection(initialStrategy()),
  );
  const [setupStrategy, setSetupStrategy] =
    useState<UnderwritingStrategyId>(initialStrategy);
  const [setupSelection, setSetupSelection] = useState<Set<number>>(() =>
    initialSelection(initialStrategy()),
  );
```

**3c.** Update `openSetup` (lines 58-61):

```tsx
  function openSetup() {
    const strat = initialStrategy();
    setSetupStrategy(strat);
    setSetupSelection(initialSelection(strat));
    setSetupOpen(true);
  }
```

**3d.** Update `startGeneration` (lines 63-72):

```tsx
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
```

**3e.** Pass `strategy` into `UnderwritingProgress` (lines 122-128):

```tsx
            <UnderwritingProgress
              strategy={runStrategy}
              selectedChecks={[...runSelection]}
              onComplete={() => {
                setPhase("generated");
                setPlacementOpen(true);
              }}
            />
```

**3f.** Pass `strategy`/`onStrategyChange` into the setup modal's `UnderwritingDepth` (line 157):

```tsx
            <UnderwritingDepth
              strategy={setupStrategy}
              value={setupSelection}
              onStrategyChange={setSetupStrategy}
              onChange={setSetupSelection}
            />
```

- [ ] **Step 4: Verify the whole build type-checks and tests pass**

Run: `bun --bun run build && bun --bun run test`
Expected: build succeeds with no references to `UNDERWRITING_CHECKS`, `UNDERWRITING_TOTAL`, `tierForCount`, or `DEFAULT_UNDERWRITING_SELECTION`; all tests pass. If tsc reports any lingering import of a removed export, grep and fix:

```bash
grep -rn "UNDERWRITING_CHECKS\|UNDERWRITING_TOTAL\|tierForCount\|DEFAULT_UNDERWRITING_SELECTION" src
```
Expected: no matches.

- [ ] **Step 5: Manual verification (ask the user)**

Start the dev server (`bun --bun run dev`) and ask the user to confirm:
1. Create Deal → enable underwriting → a strategy dropdown shows above the slider, defaulting to **New Construction Strategy**; the badge shows the strategy name.
2. The slider maxes at 7; the readout reads "N of 7 checks"; "Show checks" lists the strategy's 7 checks.
3. Switching to **Value-Add** resets all 7 checks on and swaps the check labels.
4. Creating the deal auto-starts generation; the progress row shows "Building …" steps matching the chosen strategy.
5. Opening the generated document (Review) shows a section per selected check and the strategy label in the subtitle.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/UnderwritingDepth.tsx src/components/deals/CreateDealModal.tsx src/components/deals/underwriting/UnderwritingPlannerRow.tsx
git commit -m "feat(underwriting): choose a strategy above the depth slider"
```

---

## Self-Review Notes

- **Spec coverage:** strategy Select on top of slider (Task 5) · per-strategy check lists as single source of truth (Task 1) · check list drives slider + progress + document (Tasks 3–5) · `DealUnderwriting.strategy` field (Task 2) · Full per-check document sections (Task 3) · badge shows strategy name, "N of 7 checks", tier names retired (Tasks 1, 5) · default New Construction (Task 1). All covered.
- **Backward compatibility:** `coerceStrategy` guards legacy/undefined records everywhere they're read (store default, progress, document builder, planner row).
- **Green-at-each-commit:** Tasks 1–4 are additive or default-guarded; Task 5 removes the old exports and updates all consumers in one commit, keeping the build green. The Task 2/4 build checkpoints explicitly tolerate the known call-site errors that Task 5 resolves.
```
