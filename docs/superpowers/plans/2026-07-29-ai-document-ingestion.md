# AI Document Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant, synchronous AI field-fill on "Create deal with AI" with a background document-ingestion run that lands either clean (all fields filled, deal publishable) or in a needs-review state where the broker arbitrates conflicting values in the edit form before the deal can publish.

**Architecture:** A `DealIngestion` record is stored on the `Listing` (Zustand + IndexedDB, mirroring `DealUnderwriting.status`). Pure logic lives in `src/data/ingestion.ts` with no React or timers. A shell-mounted `IngestionWatcher` — following the existing `BovWatcher` / `RosaLeadsWatcher` pattern — advances the run on timers so it keeps going if the broker navigates away. A three-state banner on the deal overview reads that state without driving it. Conflict arbitration happens inside the real edit form via a React context read by the shared field wrappers.

**Tech Stack:** React 19 · TypeScript · TanStack Start/Router · Zustand · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest · Bun

**Spec:** `docs/superpowers/specs/2026-07-29-ai-document-ingestion-design.md`

## Global Constraints

- Package manager is Bun. Always `bun --bun run <script>`.
- Type-check gate is `bunx tsc --noEmit` — `vite build` does NOT type-check. Test gate is `bun --bun run test`.
- A React/module `ReferenceError: module is not defined` line on stderr during tests is pre-existing noise, not a failure. Judge by the `Test Files`/`Tests` summary lines.
- All UI uses Blueprint React components imported from the `ui` subpath, e.g. `import { Alert } from "@buildoutinc/blueprint-react/ui/Alert"`. Use Bootstrap 5 utility classes for spacing/layout, never Tailwind.
- Icons come from `@fortawesome/pro-regular-svg-icons` by default; `@fortawesome/pro-duotone-svg-icons` for Alert and Banner icons only.
- Never pass `fixedWidth` to `FontAwesomeIcon` — it is deprecated in this codebase.
- Never add margin utility classes to icons inside a Blueprint `Badge` — Badge already applies a flex gap.
- Blueprint `Field.Label` / `Field.Description` MUST be inside a `Field` (or `Field.Root`) — a standalone one crashes at runtime and `tsc` will not catch it. For detached helper text use a `<span className="form-text">`.
- Do not edit `src/routes/routeTree.gen.ts` — it is generated.
- Do not restructure or redesign any existing component's visuals beyond what a task explicitly specifies.
- Do not merge, push, or open PRs. Leave the branch as-is when done.
- Do not use Playwright. Run `tsc` and the test suite; ask the user to verify anything visual.
- Current branch: `joel/polish-5`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/data/types.ts` | Add `DealIngestion`, `IngestionConflict`, `IngestionFieldKey`; `ingestion?` on `Listing` |
| `src/data/ingestion.ts` | **New.** All pure ingestion logic: conflict derivation, stage advance, resolution, patch building |
| `src/data/ingestion.test.ts` | **New.** Unit tests for the above |
| `src/data/actions.ts` | Store-mutating ingestion actions |
| `src/data/createListing.ts` | `NewListingDraft.ingestion` passthrough into the created listing |
| `src/components/deals/CreateDealModal.tsx` | Seed the run instead of applying the patch synchronously |
| `src/components/deals/IngestionWatcher.tsx` | **New.** Background timer runner |
| `src/components/deals/IngestionBanner.tsx` | **New.** Three-state banner |
| `src/components/layout/AppShell.tsx` | Mount the watcher |
| `src/routes/_shell/listings/$listingId/overview.tsx` | Render the banner; suppress the setup banner while processing |
| `src/routes/_shell/listings/$listingId/edit.tsx` | Read the `review` search param |
| `src/components/deals/ingestionConflictContext.tsx` | **New.** Context + hook consumed by the field wrappers |
| `src/components/listings/edit/fieldWidgets.tsx` | Optional `fieldKey`; render the arbitration row |
| `src/components/deals/DealMarketingEditor.tsx` | Provide context, tab badges, tab selection, `fieldKey` on price + NOI |
| `src/components/listings/edit/sections/BuildingSection.tsx` | `fieldKey` on occupancy |
| `src/main.scss` | Conflict ring + arbitration row styling |

---

### Task 1: Ingestion types and pure logic

**Files:**
- Modify: `src/data/types.ts` (add interfaces near `DealUnderwriting`, ~line 434; add `ingestion?` to `Listing` near `underwriting?`, ~line 414)
- Create: `src/data/ingestion.ts`
- Test: `src/data/ingestion.test.ts`

**Interfaces:**
- Consumes: `Listing`, `Property`, `DealMarketing`, `DealPitchFinancials`, `DealTransaction` from `#/data/types`; `buildPublishReadyPatch` and `PublishReadyPatch` from `#/data/uploadIntelligence`.
- Produces:
  - `DealIngestion`, `IngestionConflict`, `IngestionFieldKey` types (see code below)
  - `INGESTION_STAGES: readonly { label: string; detail: string }[]` — length 3
  - `startIngestionState(documents: string[]): DealIngestion`
  - `deriveConflicts(deal: Listing, property: Property | undefined): IngestionConflict[]`
  - `advanceStage(ing: DealIngestion): DealIngestion`
  - `resolveConflict(ing: DealIngestion, fieldKey: IngestionFieldKey, side: 'doc' | 'current'): DealIngestion`
  - `allResolved(ing: DealIngestion): boolean`
  - `unresolvedCount(ing: DealIngestion): number`
  - `ingestionPatch(deal: Listing, property: Property | undefined, ing: DealIngestion): PublishReadyPatch`
  - `resolvedPropertyPatch(ing: DealIngestion): { occupancyPct?: number }`
  - `countFilledFields(patch: PublishReadyPatch): number`

- [ ] **Step 1: Add the types to `src/data/types.ts`**

Add `ingestion?: DealIngestion` to the `Listing` interface, directly after the existing `underwriting?: DealUnderwriting` line:

```ts
  /** An AI document-ingestion run started at deal creation. Absent means no run. */
  ingestion?: DealIngestion
```

Then add these interfaces immediately after the `DealUnderwriting` interface block:

```ts
/** Which editable field an ingestion conflict lands on. */
export type IngestionFieldKey = 'askingPrice' | 'noi' | 'occupancyPct'

/**
 * One value the ingestion run could not settle on its own. Always two-sided:
 * `docValue` vs `currentValue`. Unresolved conflicts are NOT written to the deal,
 * so a gate-required one (asking price on a Sale) genuinely blocks publishing.
 */
export interface IngestionConflict {
  fieldKey: IngestionFieldKey
  label: string
  /** Display-formatted value from the documents (e.g. "$8,400,000"). */
  docValue: string
  /** Display-formatted value on the record today. */
  currentValue: string
  /** Where each side came from, e.g. "T-12.pdf" / "Property record". */
  docSource: string
  currentSource: string
  /** The raw numbers to write when a side is picked. */
  docRaw: number
  currentRaw: number
  /** Set once the broker picks a side. */
  resolution?: 'doc' | 'current'
}

/** An AI document-ingestion run on a deal. */
export interface DealIngestion {
  status: 'processing' | 'needs-review' | 'complete'
  /** File names being read — shown in the banner while processing. */
  documents: string[]
  /** Which stage the run is on: 0 scanning, 1 extracting, 2 filling. */
  stage: 0 | 1 | 2
  /** How many fields were filled without disagreement. Shown on completion. */
  filledCount: number
  /** Values needing broker arbitration. Empty on the clean path. */
  conflicts: IngestionConflict[]
  startedAt: string
}
```

- [ ] **Step 2: Write the failing test file**

Create `src/data/ingestion.test.ts`. Note this repo's test convention: look at `src/data/uploadIntelligence` usage in `src/components/deals/setupIncompleteBanner.test.ts` for how listings/properties are built in tests. Use the same fixture approach — import `createRosaProposalDeal`-style helpers only if already used there; otherwise hand-build minimal objects with `as unknown as Listing` casts kept out of production code.

```ts
import { describe, expect, it } from 'vitest'
import type { Listing, Property } from './types'
import {
  INGESTION_STAGES,
  advanceStage,
  allResolved,
  countFilledFields,
  deriveConflicts,
  ingestionPatch,
  resolveConflict,
  resolvedPropertyPatch,
  startIngestionState,
  unresolvedCount,
} from './ingestion'

/** A minimal Sale deal with an asking price and NOI on record. */
function saleDeal(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'deal-1',
    propertyId: 'prop-1',
    name: 'The Delgado Building',
    dealType: 'Sale',
    dealSide: 'seller',
    status: 'proposal',
    financials: { askingPrice: 7_900_000, noi: 520_000 },
    marketing: {},
    transaction: {},
    ...overrides,
  } as unknown as Listing
}

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    name: 'The Delgado Building',
    street: '1200 W Fulton',
    city: 'Chicago',
    state: 'IL',
    propertyType: 'multiFamily',
    buildingSqFt: 52_000,
    askingPrice: 7_900_000,
    occupancyPct: 96,
    units: [],
    ...overrides,
  } as unknown as Property
}

describe('startIngestionState', () => {
  it('starts processing at stage 0 with the given documents', () => {
    const ing = startIngestionState(['T-12.pdf', 'Rent Roll.xlsx'])
    expect(ing.status).toBe('processing')
    expect(ing.stage).toBe(0)
    expect(ing.documents).toEqual(['T-12.pdf', 'Rent Roll.xlsx'])
    expect(ing.conflicts).toEqual([])
    expect(ing.filledCount).toBe(0)
  })
})

describe('advanceStage', () => {
  it('walks 0 → 1 → 2 and clamps at the last stage', () => {
    let ing = startIngestionState(['T-12.pdf'])
    ing = advanceStage(ing)
    expect(ing.stage).toBe(1)
    ing = advanceStage(ing)
    expect(ing.stage).toBe(2)
    ing = advanceStage(ing)
    expect(ing.stage).toBe(2)
  })

  it('has a label and detail for every stage', () => {
    expect(INGESTION_STAGES).toHaveLength(3)
    for (const s of INGESTION_STAGES) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('deriveConflicts', () => {
  it('derives three doc-vs-record conflicts when a property record exists', () => {
    const conflicts = deriveConflicts(saleDeal(), property())
    expect(conflicts.map((c) => c.fieldKey)).toEqual(['askingPrice', 'noi', 'occupancyPct'])
    for (const c of conflicts) {
      expect(c.currentSource).toBe('Property record')
      expect(c.resolution).toBeUndefined()
    }
  })

  it('derives doc-vs-doc conflicts when there is no property record', () => {
    const conflicts = deriveConflicts(saleDeal(), undefined)
    expect(conflicts).toHaveLength(3)
    for (const c of conflicts) {
      expect(c.currentSource).not.toBe('Property record')
    }
  })

  it('gives every conflict a non-empty value and differing sides', () => {
    for (const prop of [property(), undefined]) {
      for (const c of deriveConflicts(saleDeal(), prop)) {
        expect(c.docValue).not.toBe('')
        expect(c.currentValue).not.toBe('')
        expect(c.docRaw).not.toBe(c.currentRaw)
        expect(c.label.length).toBeGreaterThan(0)
        expect(c.docSource.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resolveConflict / allResolved / unresolvedCount', () => {
  it('is not all-resolved until every conflict has a resolution', () => {
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    expect(allResolved(ing)).toBe(false)
    expect(unresolvedCount(ing)).toBe(3)

    ing = resolveConflict(ing, 'askingPrice', 'doc')
    expect(allResolved(ing)).toBe(false)
    expect(unresolvedCount(ing)).toBe(2)

    ing = resolveConflict(ing, 'noi', 'current')
    ing = resolveConflict(ing, 'occupancyPct', 'doc')
    expect(allResolved(ing)).toBe(true)
    expect(unresolvedCount(ing)).toBe(0)
  })

  it('records which side was picked and leaves other conflicts untouched', () => {
    const base = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    const next = resolveConflict(base, 'noi', 'doc')
    expect(next.conflicts.find((c) => c.fieldKey === 'noi')?.resolution).toBe('doc')
    expect(next.conflicts.find((c) => c.fieldKey === 'askingPrice')?.resolution).toBeUndefined()
    // Pure — the input is not mutated.
    expect(base.conflicts.find((c) => c.fieldKey === 'noi')?.resolution).toBeUndefined()
  })

  it('is a no-op for a field key that has no conflict', () => {
    const base = startIngestionState(['T-12.pdf'])
    expect(resolveConflict(base, 'askingPrice', 'doc').conflicts).toEqual([])
  })
})

describe('ingestionPatch', () => {
  it('omits an unresolved asking-price conflict from the financials patch', () => {
    const deal = saleDeal()
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, property()) }
    const patch = ingestionPatch(deal, property(), ing)
    expect(patch.financials.askingPrice).toBeUndefined()
    expect(patch.financials.noi).toBeUndefined()
    // Non-conflicting fields still land.
    expect(patch.marketing.saleTitle).toBeTruthy()
    expect(patch.transaction.listedOnDate).toBeTruthy()
  })

  it('includes a resolved conflict using the picked side value', () => {
    const deal = saleDeal()
    const prop = property()
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, prop) }
    const priceConflict = ing.conflicts.find((c) => c.fieldKey === 'askingPrice')!

    ing = resolveConflict(ing, 'askingPrice', 'doc')
    expect(ingestionPatch(deal, prop, ing).financials.askingPrice).toBe(priceConflict.docRaw)

    ing = resolveConflict(ing, 'askingPrice', 'current')
    expect(ingestionPatch(deal, prop, ing).financials.askingPrice).toBe(priceConflict.currentRaw)
  })

  it('writes every conflict field once all are resolved', () => {
    const deal = saleDeal()
    const prop = property()
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, prop) }
    ing = resolveConflict(ing, 'askingPrice', 'doc')
    ing = resolveConflict(ing, 'noi', 'doc')
    ing = resolveConflict(ing, 'occupancyPct', 'doc')
    const patch = ingestionPatch(deal, prop, ing)
    expect(patch.financials.askingPrice).toBeDefined()
    expect(patch.financials.noi).toBeDefined()
    expect(resolvedPropertyPatch(ing).occupancyPct).toBeDefined()
  })

  it('leaves the property patch empty while occupancy is unresolved', () => {
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    expect(resolvedPropertyPatch(ing).occupancyPct).toBeUndefined()
  })
})

describe('countFilledFields', () => {
  it('counts defined keys across all three patch sections', () => {
    const n = countFilledFields({
      marketing: { saleTitle: 'x', saleDescription: 'y' },
      transaction: { listedOnDate: '2026-07-29' },
      financials: { askingPrice: 1 },
    })
    expect(n).toBe(4)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun --bun run test src/data/ingestion.test.ts`
Expected: FAIL — `Failed to resolve import "./ingestion"`.

- [ ] **Step 4: Implement `src/data/ingestion.ts`**

Note the module conventions in `src/data/`: no semicolons, single quotes (see `uploadIntelligence.ts`). Match them.

```ts
import type {
  DealIngestion,
  IngestionConflict,
  IngestionFieldKey,
  Listing,
  Property,
} from './types'
import { buildPublishReadyPatch, type PublishReadyPatch } from './uploadIntelligence'

/** The three stages the banner walks through while a run is processing. */
export const INGESTION_STAGES = [
  { label: 'Scanning documents', detail: 'Reading the files you attached' },
  { label: 'Extracting details', detail: 'Price, size, income, and property facts' },
  { label: 'Filling deal fields', detail: 'Writing what we found to the deal' },
] as const

/** A fresh run: processing, nothing filled, no conflicts yet. */
export function startIngestionState(documents: string[]): DealIngestion {
  return {
    status: 'processing',
    documents,
    stage: 0,
    filledCount: 0,
    conflicts: [],
    startedAt: new Date().toISOString(),
  }
}

/** Bump to the next stage, clamped to the last. Pure. */
export function advanceStage(ing: DealIngestion): DealIngestion {
  const last = (INGESTION_STAGES.length - 1) as DealIngestion['stage']
  return { ...ing, stage: (ing.stage < last ? ing.stage + 1 : last) as DealIngestion['stage'] }
}

const money = (n: number) => `$${Math.round(n).toLocaleString()}`
const percent = (n: number) => `${Math.round(n)}%`

/**
 * The faked extraction: derive three two-sided conflicts a T-12 and rent roll
 * would plausibly raise. When a property record exists the comparison is
 * doc-vs-record; without one (a typed-in address) it is doc-vs-doc — the rent
 * roll disagreeing with the T-12 — so both sides always carry a value and
 * whichever the broker picks leaves the field populated.
 */
export function deriveConflicts(
  deal: Listing,
  property: Property | undefined,
): IngestionConflict[] {
  const recordPrice = property && property.askingPrice > 0 ? property.askingPrice : deal.financials.askingPrice
  const basePrice = recordPrice > 0 ? recordPrice : 7_900_000
  const recordNoi = deal.financials.noi > 0 ? deal.financials.noi : 520_000
  const recordOcc = property && property.occupancyPct > 0 ? property.occupancyPct : 96

  // The documents read higher on price/NOI and lower on occupancy — the classic
  // "the T-12 doesn't support the pitch" shape.
  const docPrice = Math.round((basePrice * 1.063) / 10_000) * 10_000
  const docNoi = Math.round((recordNoi * 1.085) / 1_000) * 1_000
  const docOcc = Math.max(1, recordOcc - 8)

  const hasRecord = property !== undefined
  const currentSource = hasRecord ? 'Property record' : 'Rent Roll.xlsx'
  const priceCurrentSource = hasRecord ? 'Property record' : 'Listing Agreement.pdf'

  return [
    {
      fieldKey: 'askingPrice',
      label: 'Asking price',
      docValue: money(docPrice),
      currentValue: money(basePrice),
      docSource: 'T-12.pdf',
      currentSource: priceCurrentSource,
      docRaw: docPrice,
      currentRaw: basePrice,
    },
    {
      fieldKey: 'noi',
      label: 'NOI',
      docValue: money(docNoi),
      currentValue: money(recordNoi),
      docSource: 'T-12.pdf',
      currentSource,
      docRaw: docNoi,
      currentRaw: recordNoi,
    },
    {
      fieldKey: 'occupancyPct',
      label: 'Occupancy',
      docValue: percent(docOcc),
      currentValue: percent(recordOcc),
      docSource: 'Rent Roll.xlsx',
      currentSource: hasRecord ? 'Property record' : 'T-12.pdf',
      docRaw: docOcc,
      currentRaw: recordOcc,
    },
  ]
}

/** Record which side the broker picked for one conflict. Pure. */
export function resolveConflict(
  ing: DealIngestion,
  fieldKey: IngestionFieldKey,
  side: 'doc' | 'current',
): DealIngestion {
  return {
    ...ing,
    conflicts: ing.conflicts.map((c) =>
      c.fieldKey === fieldKey ? { ...c, resolution: side } : c,
    ),
  }
}

export function unresolvedCount(ing: DealIngestion): number {
  return ing.conflicts.filter((c) => !c.resolution).length
}

export function allResolved(ing: DealIngestion): boolean {
  return unresolvedCount(ing) === 0
}

/** The value a resolved conflict commits — the side the broker picked. */
function resolvedRaw(c: IngestionConflict): number | undefined {
  if (!c.resolution) return undefined
  return c.resolution === 'doc' ? c.docRaw : c.currentRaw
}

function conflictFor(
  ing: DealIngestion,
  fieldKey: IngestionFieldKey,
): IngestionConflict | undefined {
  return ing.conflicts.find((c) => c.fieldKey === fieldKey)
}

/**
 * The deal-side field values to commit: everything `buildPublishReadyPatch`
 * produces, minus any field still in conflict, plus resolved conflicts at the
 * picked value. Withholding a gate-required field (asking price on a Sale) is
 * what makes an unresolved conflict block publishing — no separate gate logic.
 */
export function ingestionPatch(
  deal: Listing,
  property: Property | undefined,
  ing: DealIngestion,
): PublishReadyPatch {
  const base = buildPublishReadyPatch(deal, property)
  const financials = { ...base.financials }

  const price = conflictFor(ing, 'askingPrice')
  if (price) {
    const raw = resolvedRaw(price)
    if (raw === undefined) {
      delete financials.askingPrice
      delete financials.pricePerSqFt
    } else {
      financials.askingPrice = raw
    }
  }

  const noi = conflictFor(ing, 'noi')
  if (noi) {
    const raw = resolvedRaw(noi)
    if (raw === undefined) delete financials.noi
    else financials.noi = raw
  }

  return { marketing: base.marketing, transaction: base.transaction, financials }
}

/** Property-side values to commit — occupancy is a Property field, not a deal one. */
export function resolvedPropertyPatch(ing: DealIngestion): { occupancyPct?: number } {
  const occ = conflictFor(ing, 'occupancyPct')
  const raw = occ ? resolvedRaw(occ) : undefined
  return raw === undefined ? {} : { occupancyPct: raw }
}

/** How many fields a patch actually sets — the banner's "filled N fields" count. */
export function countFilledFields(patch: PublishReadyPatch): number {
  const sections = [patch.marketing, patch.transaction, patch.financials]
  return sections.reduce(
    (n, section) => n + Object.values(section).filter((v) => v !== undefined).length,
    0,
  )
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun --bun run test src/data/ingestion.test.ts`
Expected: PASS, all tests in the file.

If `deriveConflicts` returns equal sides for a field (making `expect(c.docRaw).not.toBe(c.currentRaw)` fail), the multipliers above collided with a fixture value — widen the multiplier, do not weaken the test. The invariant "a conflict has two different values" is the point.

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Full test suite**

Run: `bun --bun run test`
Expected: all files pass (baseline is 86 files / 540 tests, now plus this file).

- [ ] **Step 8: Commit**

```bash
git add src/data/types.ts src/data/ingestion.ts src/data/ingestion.test.ts
git commit -m "feat(deals): add ingestion state types and pure logic"
```

---

### Task 2: Store actions and create-deal seeding

**Files:**
- Modify: `src/data/actions.ts` (add actions after `updateDealFinancials`, ~line 228)
- Modify: `src/data/createListing.ts` (`NewListingDraft` ~line 137; listing construction ~line 591 where `underwriting` is set)
- Modify: `src/components/deals/CreateDealModal.tsx` (`handleCreate`, ~line 470)
- Test: `src/data/ingestion.test.ts` (extend)

**Interfaces:**
- Consumes: everything Task 1 produced, plus `patchListing` (module-private in `actions.ts`), `updateProperty` from `#/data/store`, `getProperty` from `#/data/store`.
- Produces:
  - `startIngestion(dealId: string, documents: string[]): { deal: Listing | null }`
  - `advanceIngestion(dealId: string): { deal: Listing | null }`
  - `finishIngestion(dealId: string): { deal: Listing | null }` — applies the patch, attaches conflicts, sets `needs-review` or `complete`
  - `resolveIngestionConflict(dealId: string, fieldKey: IngestionFieldKey, side: 'doc' | 'current'): { deal: Listing | null }`
  - `dismissIngestion(dealId: string): { deal: Listing | null }` — clears `ingestion` off the deal
  - `NewListingDraft.ingestion?: DealIngestion`

- [ ] **Step 1: Write the failing tests**

Append to `src/data/ingestion.test.ts`. The store harness here is copied from
`src/components/deals/setupIncompleteBanner.test.ts` — `fake-indexeddb/auto` plus a `hydrate()` that
seeds the store from `generateDataset()`. Use exactly that; do not invent a new harness.

```ts
// ── Store actions ───────────────────────────────────────────────────────────
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { useDataStore } from './dataStore'
import { generateDataset } from './seed'
import { publishReadiness } from './stageGates'
import { emptyDraft } from './createListing'
import {
  createDeal,
  finishIngestion,
  resolveIngestionConflict,
  advanceIngestion,
  dismissIngestion,
} from './actions'

function hydrate() {
  const ds = generateDataset()
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never)
}

/** A Sale deal created the way the modal creates one with files attached. */
function createDealWithFiles() {
  const property = [...useDataStore.getState().properties.values()][0]
  const { deal } = createDeal({
    ...emptyDraft(),
    dealType: 'Sale',
    dealSide: 'seller',
    propertyId: property.id,
    initialStage: 'proposal',
    documents: [
      { id: 'f1', name: 'T-12.pdf', uploadedAt: new Date().toISOString() },
      { id: 'f2', name: 'Rent Roll.xlsx', uploadedAt: new Date().toISOString() },
    ],
    ingestion: startIngestionState(['T-12.pdf', 'Rent Roll.xlsx']),
  })
  return deal
}

function current(dealId: string) {
  return useDataStore.getState().listings.get(dealId)!
}

describe('ingestion actions', () => {
  beforeEach(hydrate)

  it('creates the deal already processing at stage 0', () => {
    const deal = createDealWithFiles()
    expect(current(deal.id).ingestion?.status).toBe('processing')
    expect(current(deal.id).ingestion?.stage).toBe(0)
  })

  it('advanceIngestion walks the stages and is a no-op once finished', () => {
    const deal = createDealWithFiles()
    advanceIngestion(deal.id)
    expect(current(deal.id).ingestion?.stage).toBe(1)
    finishIngestion(deal.id)
    const stageAfterFinish = current(deal.id).ingestion?.stage
    advanceIngestion(deal.id)
    expect(current(deal.id).ingestion?.stage).toBe(stageAfterFinish)
  })

  it('finishIngestion lands needs-review with conflicts and a filled count', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const ing = current(deal.id).ingestion!
    expect(ing.status).toBe('needs-review')
    expect(ing.conflicts).toHaveLength(3)
    expect(ing.filledCount).toBeGreaterThan(0)
  })

  it('withholds the disputed asking price so the deal is not publish-ready', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    expect(publishReadiness(current(deal.id)).missing).toContain('askingPrice')
  })

  it('fills the non-disputed gate fields even while conflicts are open', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const missing = publishReadiness(current(deal.id)).missing
    expect(missing).not.toContain('saleTitle')
    expect(missing).not.toContain('saleDescription')
    expect(missing).not.toContain('listedOnDate')
  })

  it('resolveIngestionConflict writes the picked value', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const priceConflict = current(deal.id).ingestion!.conflicts.find(
      (c) => c.fieldKey === 'askingPrice',
    )!

    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')
    expect(current(deal.id).financials.askingPrice).toBe(priceConflict.docRaw)
    expect(current(deal.id).ingestion?.status).toBe('needs-review')
  })

  it('writes an occupancy pick through to the property record', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const occConflict = current(deal.id).ingestion!.conflicts.find(
      (c) => c.fieldKey === 'occupancyPct',
    )!

    resolveIngestionConflict(deal.id, 'occupancyPct', 'doc')
    const property = useDataStore.getState().properties.get(current(deal.id).propertyId)!
    expect(property.occupancyPct).toBe(occConflict.docRaw)
  })

  it('flips to complete on the last resolution, leaving only the doc review outstanding', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')
    resolveIngestionConflict(deal.id, 'noi', 'current')
    resolveIngestionConflict(deal.id, 'occupancyPct', 'doc')

    expect(current(deal.id).ingestion?.status).toBe('complete')
    expect(publishReadiness(current(deal.id)).missing).toEqual(['aiDocsReviewed'])
  })

  it('dismissIngestion clears the run off the deal', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    dismissIngestion(deal.id)
    expect(current(deal.id).ingestion).toBeUndefined()
  })

  it('leaves a deal created without files alone', () => {
    const property = [...useDataStore.getState().properties.values()][0]
    const { deal } = createDeal({
      ...emptyDraft(),
      dealType: 'Sale',
      dealSide: 'seller',
      propertyId: property.id,
      initialStage: 'proposal',
    })
    expect(current(deal.id).ingestion).toBeUndefined()
    finishIngestion(deal.id)
    expect(current(deal.id).ingestion).toBeUndefined()
  })
})
```

Two of these assertions are the ones that matter most — `missing` containing `askingPrice` before
resolution and equalling exactly `['aiDocsReviewed']` after. They are the executable form of the
whole publish-readiness requirement. If `publishReadiness` reports something else missing (e.g. the
seed property lacks data `buildPublishReadyPatch` depends on), fix the fixture, not the assertion.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test src/data/ingestion.test.ts`
Expected: FAIL — the action imports do not resolve.

- [ ] **Step 3: Add the actions to `src/data/actions.ts`**

```ts
/** Start a background document-ingestion run on a deal. */
export function startIngestion(dealId: string, documents: string[]): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      ingestion: startIngestionState(documents),
      updatedAt: new Date().toISOString(),
    })),
  }
}

/** Advance the run to its next stage. No-op when there is no processing run. */
export function advanceIngestion(dealId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) =>
      l.ingestion && l.ingestion.status === 'processing'
        ? { ...l, ingestion: advanceStage(l.ingestion), updatedAt: new Date().toISOString() }
        : l,
    ),
  }
}

/**
 * Land the run: commit the non-conflicting field values, attach the conflicts the
 * broker has to arbitrate, and settle on `needs-review` or `complete`. The
 * disputed fields are deliberately NOT written — that is what blocks publishing.
 */
export function finishIngestion(dealId: string): { deal: Listing | null } {
  const listing = useDataStore.getState().listings.get(dealId)
  if (!listing?.ingestion || listing.ingestion.status !== 'processing') {
    return { deal: listing ?? null }
  }
  const property = getProperty(listing.propertyId)
  const conflicts = deriveConflicts(listing, property)
  const settled: DealIngestion = { ...listing.ingestion, conflicts }
  const patch = ingestionPatch(listing, property, settled)

  updateDealMarketing(dealId, patch.marketing)
  updateDealTransaction(dealId, patch.transaction)
  updateDealFinancials(dealId, patch.financials)

  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      ingestion: {
        ...settled,
        filledCount: countFilledFields(patch),
        status: conflicts.length > 0 ? 'needs-review' : 'complete',
      },
      updatedAt: new Date().toISOString(),
    })),
  }
}

/**
 * Record the broker's pick for one conflict and commit its value. Occupancy is a
 * Property field, so it writes through `updateProperty`. Once every conflict is
 * settled the run flips to `complete`.
 */
export function resolveIngestionConflict(
  dealId: string,
  fieldKey: IngestionFieldKey,
  side: 'doc' | 'current',
): { deal: Listing | null } {
  const listing = useDataStore.getState().listings.get(dealId)
  if (!listing?.ingestion) return { deal: listing ?? null }

  const next = resolveConflict(listing.ingestion, fieldKey, side)
  const property = getProperty(listing.propertyId)
  const patch = ingestionPatch(listing, property, next)

  updateDealFinancials(dealId, patch.financials)
  const propPatch = resolvedPropertyPatch(next)
  if (propPatch.occupancyPct !== undefined && listing.propertyId) {
    updateProperty(listing.propertyId, propPatch)
  }

  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      ingestion: { ...next, status: allResolved(next) ? 'complete' : 'needs-review' },
      updatedAt: new Date().toISOString(),
    })),
  }
}

/** Clear the run off the deal — the banner's dismiss on the clean path. */
export function dismissIngestion(dealId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => {
      const { ingestion: _ingestion, ...rest } = l
      return { ...rest, updatedAt: new Date().toISOString() } as Listing
    }),
  }
}
```

Add these imports at the top of `actions.ts`:

```ts
import {
  advanceStage,
  allResolved,
  countFilledFields,
  deriveConflicts,
  ingestionPatch,
  resolveConflict,
  resolvedPropertyPatch,
  startIngestionState,
} from './ingestion'
import { getProperty, updateProperty } from './store'
```

`actions.ts` does not currently import from `./store`, so this is a new import line — and it is
cycle-safe: `store.ts` does not import `actions.ts`. `useDataStore` and `patchListing` are already
available in the file (line 1 and line 38 respectively).

Also extend the existing type import on line 9 with `DealIngestion` and `IngestionFieldKey`.

- [ ] **Step 4: Thread `ingestion` through the draft**

In `src/data/createListing.ts`, add to `NewListingDraft` right after the `underwriting?: DealUnderwriting` field:

```ts
  /** A document-ingestion run to start with the deal (create-with-AI). */
  ingestion?: DealIngestion
```

Then in the listing construction (~line 591, where `underwriting:` is set), add alongside it:

```ts
    ingestion: draft.ingestion,
```

Import the `DealIngestion` type from `./types`.

- [ ] **Step 5: Seed the run from `CreateDealModal` instead of patching synchronously**

In `src/components/deals/CreateDealModal.tsx`, `handleCreate` currently ends with a synchronous patch block. Replace this:

```tsx
    const { deal: listing } = createDeal(draft);
    // A file upload stands in for the AI reading the broker's documents and
    // filling the deal out to publish-ready (all but the AI-doc review).
    if (files.length > 0) {
      const prop = getProperty(listing.propertyId);
      const patch = buildPublishReadyPatch(listing, prop);
      updateDealMarketing(listing.id, patch.marketing);
      updateDealTransaction(listing.id, patch.transaction);
      updateDealFinancials(listing.id, patch.financials);
    }
    onOpenChange(false);
```

with:

```tsx
    const { deal: listing } = createDeal(draft);
    onOpenChange(false);
```

and add `ingestion` to the `draft` object literal, alongside the existing `documents: files` line:

```tsx
      // Attached files kick off a background ingestion run — the IngestionWatcher
      // advances it and commits what it finds. Nothing is filled synchronously.
      ingestion:
        files.length > 0 ? startIngestionState(files.map((f) => f.name)) : undefined,
```

Import `startIngestionState` from `#/data/ingestion`. Then remove the now-unused imports: `buildPublishReadyPatch` from `#/data/uploadIntelligence` (keep `recommendDocsFromUploads`), and `updateDealMarketing` / `updateDealTransaction` / `updateDealFinancials` from `#/data/actions` (keep `createDeal`). Also drop `getProperty` from the `#/data/store` import **only if** nothing else in the file uses it — it is used by `selectedProperty`, so it stays.

- [ ] **Step 6: Run the tests**

Run: `bun --bun run test`
Expected: PASS. If `setupIncompleteBanner.test.ts` or `useCreateDeal.test.ts` fail, read them — they may assert the old synchronous publish-ready behavior. If so, that assertion is now wrong by design: update it to reflect that a freshly created deal with files is NOT yet publish-ready, and note the change in the commit message.

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. Unused-import errors here are the signal you missed a cleanup in Step 5.

- [ ] **Step 8: Commit**

```bash
git add src/data/actions.ts src/data/createListing.ts src/data/ingestion.test.ts src/components/deals/CreateDealModal.tsx
git commit -m "feat(deals): seed a background ingestion run on create-with-AI"
```

---

### Task 3: The background watcher

**Files:**
- Create: `src/components/deals/IngestionWatcher.tsx`
- Modify: `src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `advanceIngestion`, `finishIngestion` from `#/data/actions`; `useDataStore` from `#/data/dataStore`; `INGESTION_STAGES` from `#/data/ingestion`.
- Produces: `IngestionWatcher` — a render-null component.

- [ ] **Step 1: Read the pattern first**

Read `src/components/call/BovWatcher.tsx` in full. It is the house pattern for a shell-mounted, render-null watcher that reacts to stored deal state: a reactive `useDataStore` selector plus a `useRef` guard so the effect fires once per subject. Follow it.

- [ ] **Step 2: Create the watcher**

```tsx
import { useEffect, useRef } from "react";
import { useDataStore } from "#/data/dataStore";
import { advanceIngestion, finishIngestion } from "#/data/actions";
import { INGESTION_STAGES } from "#/data/ingestion";

/** How long each ingestion stage "runs" before the next one starts. */
const STAGE_MS = 1600;

/**
 * Renders nothing. Drives any deal whose ingestion run is still `processing`:
 * walks the stages on a timer, then commits via `finishIngestion`.
 *
 * Mounted in the AppShell rather than on the deal overview on purpose — that is
 * what makes the run genuinely background, so it keeps advancing (and lands)
 * even if the broker navigates away from the deal mid-run.
 */
export function IngestionWatcher() {
  // Reactive selector: the first processing deal's id, or undefined. Only one
  // run is ever in flight in the prototype (a run starts at deal creation).
  const dealId = useDataStore((s) => {
    for (const [id, listing] of s.listings) {
      if (listing.ingestion?.status === "processing") return id;
    }
    return undefined;
  });
  // Guards against re-running for a deal this mount already drove.
  const drivenFor = useRef<string | null>(null);

  useEffect(() => {
    if (!dealId) {
      drivenFor.current = null;
      return;
    }
    if (drivenFor.current === dealId) return;
    drivenFor.current = dealId;

    const timers: ReturnType<typeof setTimeout>[] = [];
    // Stage 0 is already showing; schedule the advance into each later stage,
    // then the commit one stage-length after the last one lands.
    for (let i = 1; i < INGESTION_STAGES.length; i += 1) {
      timers.push(setTimeout(() => advanceIngestion(dealId), STAGE_MS * i));
    }
    timers.push(
      setTimeout(() => finishIngestion(dealId), STAGE_MS * INGESTION_STAGES.length),
    );
    return () => timers.forEach(clearTimeout);
  }, [dealId]);

  return null;
}
```

- [ ] **Step 3: Mount it in the shell**

In `src/components/layout/AppShell.tsx`, add the import alongside the other watcher imports:

```tsx
import { IngestionWatcher } from "#/components/deals/IngestionWatcher";
```

and render it next to the existing watchers, inside `<main>`, following their exact `hydrated &&` form:

```tsx
            {hydrated && <IngestionWatcher />}
```

Place it directly after the `{hydrated && <RosaLeadsWatcher />}` line.

- [ ] **Step 4: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/deals/IngestionWatcher.tsx src/components/layout/AppShell.tsx
git commit -m "feat(deals): drive ingestion runs from a shell-mounted watcher"
```

---

### Task 4: The overview banner

**Files:**
- Create: `src/components/deals/IngestionBanner.tsx`
- Modify: `src/routes/_shell/listings/$listingId/overview.tsx`

**Interfaces:**
- Consumes: `INGESTION_STAGES`, `unresolvedCount` from `#/data/ingestion`; `dismissIngestion` from `#/data/actions`; `Listing` from `#/data/types`.
- Produces: `IngestionBanner({ listing }: { listing: Listing })`.

- [ ] **Step 1: Create the banner**

Three states off `listing.ingestion.status`. Use Blueprint `Alert` with a duotone icon, matching how `SetupIncompleteBanner` in the same route file is built (`severity` + `withIcon` + an icon child + `Alert.Title`), and its `className="m-3 mb-0"` placement so the two banners stack consistently.

```tsx
import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleInfo,
  faCircleCheck,
  faTriangleExclamation,
} from "@fortawesome/pro-duotone-svg-icons";
import { faSpinnerThird } from "@fortawesome/pro-regular-svg-icons";
import { INGESTION_STAGES, unresolvedCount } from "#/data/ingestion";
import { dismissIngestion } from "#/data/actions";
import type { Listing } from "#/data/types";

/**
 * The document-ingestion banner, above the planner on the deal overview. A pure
 * reader of `listing.ingestion` — the IngestionWatcher in the AppShell owns the
 * run, so this stays correct whether the broker watched it or came back later.
 */
export function IngestionBanner({ listing }: { listing: Listing }) {
  const ingestion = listing.ingestion;
  if (!ingestion) return null;

  if (ingestion.status === "processing") {
    const stage = INGESTION_STAGES[ingestion.stage];
    return (
      <Alert severity="info" withIcon className="m-3 mb-0">
        <FontAwesomeIcon icon={faCircleInfo} />
        <Alert.Title className="d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faSpinnerThird} spin />
          {stage.label}
        </Alert.Title>
        <div className="d-flex flex-column gap-1">
          <span>{stage.detail}</span>
          <span className="text-muted fs-small">
            {ingestion.documents.join(" · ")}
          </span>
        </div>
      </Alert>
    );
  }

  if (ingestion.status === "needs-review") {
    const remaining = unresolvedCount(ingestion);
    return (
      <Alert severity="warning" withIcon className="m-3 mb-0">
        <FontAwesomeIcon icon={faTriangleExclamation} />
        <Alert.Title>
          {remaining} {remaining === 1 ? "field needs" : "fields need"} your
          confirmation
        </Alert.Title>
        <div className="d-flex flex-column align-items-start gap-2">
          <span>
            Buildout filled {ingestion.filledCount} fields from your documents.
            These disagree with what&rsquo;s on record — confirm them to finish.
          </span>
          <Button
            variant="primary"
            size="sm"
            render={
              <Link
                to="/listings/$listingId/edit"
                params={{ listingId: listing.id }}
                search={{ review: "ingestion" }}
              />
            }
          >
            Review fields
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Alert severity="success" withIcon className="m-3 mb-0">
      <FontAwesomeIcon icon={faCircleCheck} />
      <Alert.Title>Buildout filled {ingestion.filledCount} fields</Alert.Title>
      <div className="d-flex flex-column align-items-start gap-2">
        <span>
          Everything we found in your documents is on the deal. It&rsquo;s ready
          to publish once you review the generated documents.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => dismissIngestion(listing.id)}
        >
          Dismiss
        </Button>
      </div>
    </Alert>
  );
}
```

If `Button`'s `render` prop does not accept a `<Link>` in this Blueprint version, fall back to `useNavigate()` from `@tanstack/react-router` in an `onClick` — check an existing button-that-navigates in the codebase (grep for `render={` alongside `<Link`) and match whichever form is already in use rather than guessing.

- [ ] **Step 2: Render it, and suppress the setup banner while processing**

In `src/routes/_shell/listings/$listingId/overview.tsx`:

Add the import:

```tsx
import { IngestionBanner } from "#/components/deals/IngestionBanner";
```

Render it directly above `<SetupIncompleteBanner …>`:

```tsx
      <IngestionBanner listing={listing} />
      <SetupIncompleteBanner listing={listing} />
```

Then add an early return to `SetupIncompleteBanner`, right at the top of its body before the existing `needsSetup` computation, so a deal started in a live stage does not show "Setup incomplete" next to "Scanning documents" for the ~5s the run takes:

```tsx
  // While documents are still being read, the missing fields are about to be
  // filled — the ingestion banner is the accurate status. Don't stack both.
  if (listing.ingestion?.status === "processing") return null;
```

- [ ] **Step 3: Type-check and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no tsc output; tests pass.

If `src/components/deals/setupIncompleteBanner.test.ts` covers the banner's visibility logic, add a case there for the new suppression: a deal with `ingestion.status === 'processing'` is suppressed even when fields are missing. Read the file's existing style and match it.

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/IngestionBanner.tsx src/routes/_shell/listings/\$listingId/overview.tsx src/components/deals/setupIncompleteBanner.test.ts
git commit -m "feat(deals): add the ingestion status banner to the deal overview"
```

---

### Task 5: Conflict arbitration in the edit form

**Files:**
- Create: `src/components/deals/ingestionConflictContext.tsx`
- Modify: `src/components/listings/edit/fieldWidgets.tsx` (`NumberField`, ~line 62)
- Modify: `src/components/deals/DealMarketingEditor.tsx` (tabs ~line 487, Financials fields ~line 613)
- Modify: `src/components/listings/edit/sections/BuildingSection.tsx` (occupancy, ~line 48)
- Modify: `src/routes/_shell/listings/$listingId/edit.tsx`
- Modify: `src/main.scss`

**Interfaces:**
- Consumes: `IngestionConflict`, `IngestionFieldKey` from `#/data/types`; `resolveIngestionConflict` from `#/data/actions`.
- Produces:
  - `IngestionConflictProvider({ conflicts, onResolve, children })`
  - `useIngestionConflict(fieldKey: IngestionFieldKey | undefined): { conflict: IngestionConflict | undefined; resolve: (side: 'doc' | 'current') => void }`
  - `NumberField` gains an optional `fieldKey?: IngestionFieldKey` prop.

- [ ] **Step 1: Create the context**

```tsx
import { createContext, useContext, useMemo } from "react";
import type { IngestionConflict, IngestionFieldKey } from "#/data/types";

interface ConflictCtx {
  /** Unresolved conflicts only — a resolved field renders as a normal field. */
  conflicts: IngestionConflict[];
  onResolve: (fieldKey: IngestionFieldKey, side: "doc" | "current") => void;
}

const Ctx = createContext<ConflictCtx | null>(null);

/**
 * Supplies the ingestion conflicts to the shared field wrappers, so arbitration
 * renders on the real form field instead of in a parallel review surface. Absent
 * provider (the normal edit route) means every field renders unchanged.
 */
export function IngestionConflictProvider({
  conflicts,
  onResolve,
  children,
}: ConflictCtx & { children: React.ReactNode }) {
  const value = useMemo(() => ({ conflicts, onResolve }), [conflicts, onResolve]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The unresolved conflict for a field, if any, plus its resolver. */
export function useIngestionConflict(fieldKey: IngestionFieldKey | undefined) {
  const ctx = useContext(Ctx);
  const conflict =
    ctx && fieldKey
      ? ctx.conflicts.find((c) => c.fieldKey === fieldKey && !c.resolution)
      : undefined;
  return {
    conflict,
    resolve: (side: "doc" | "current") => {
      if (ctx && fieldKey) ctx.onResolve(fieldKey, side);
    },
  };
}

/** How many unresolved conflicts fall on a given set of field keys — for tab badges. */
export function countConflictsFor(
  conflicts: IngestionConflict[],
  fieldKeys: IngestionFieldKey[],
): number {
  return conflicts.filter(
    (c) => !c.resolution && fieldKeys.includes(c.fieldKey),
  ).length;
}
```

- [ ] **Step 2: Teach `NumberField` to render arbitration**

In `src/components/listings/edit/fieldWidgets.tsx`, replace the whole `NumberField` with:

```tsx
export function NumberField({
  label,
  value,
  onChange,
  fieldKey,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  /** When set and an unresolved ingestion conflict exists for it, the field
   * renders the doc-vs-record arbitration row beneath the input. */
  fieldKey?: IngestionFieldKey;
}) {
  const { conflict, resolve } = useIngestionConflict(fieldKey);
  return (
    <Field>
      <Field.Label className="d-flex align-items-center gap-2">
        {label}
        {conflict && (
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="text-warning"
          />
        )}
      </Field.Label>
      <Input
        type="number"
        className={conflict ? "ingestion-conflict__input" : undefined}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
      {conflict && (
        <div className="ingestion-conflict__row">
          <div className="d-flex flex-column">
            <span className="fs-small">
              <span className="fw-semibold">{conflict.docValue}</span>
              <span className="text-muted"> from {conflict.docSource}</span>
            </span>
            <span className="fs-small">
              <span className="fw-semibold">{conflict.currentValue}</span>
              <span className="text-muted"> from {conflict.currentSource}</span>
            </span>
          </div>
          <div className="d-flex gap-2 flex-shrink-0">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onChange(conflict.docRaw);
                resolve("doc");
              }}
            >
              Use {conflict.docValue}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onChange(conflict.currentRaw);
                resolve("current");
              }}
            >
              Keep {conflict.currentValue}
            </Button>
          </div>
        </div>
      )}
    </Field>
  );
}
```

Add to that file's imports: `faTriangleExclamation` from `@fortawesome/pro-regular-svg-icons` (add to the existing icon import), `FontAwesomeIcon` (already imported), `useIngestionConflict` from `#/components/deals/ingestionConflictContext`, and the `IngestionFieldKey` type from `#/data/types`. `Button` and `Field` are already imported.

Both buttons write through the editor's existing `onChange`, so the picked value lands in the same working copy Save already commits — no second write path.

- [ ] **Step 3: Style the conflict field**

Append to `src/main.scss`, near the `.ai-deal-progress__*` block so the AI-affordance styles stay together:

```scss
// Ingestion conflict arbitration — a warning ring on the field plus the
// doc-vs-record row beneath it. Tokens only, no hardcoded palette.
.ingestion-conflict__input {
  border-color: var(--bs-warning);
  box-shadow: 0 0 0 1px var(--bs-warning);
}

.ingestion-conflict__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
}
```

- [ ] **Step 4: Pass `fieldKey` on the three conflict fields**

In `src/components/deals/DealMarketingEditor.tsx`, add `fieldKey="askingPrice"` to the `NumberField` with `label="Asking Price"` (~line 612) and `fieldKey="noi"` to the one with `label="NOI"` (~line 626). Change nothing else about those fields.

In `src/components/listings/edit/sections/BuildingSection.tsx`, add `fieldKey="occupancyPct"` to the `NumberField` with `label="Occupancy %"` (~line 48).

- [ ] **Step 5: Provide the context and badge the tabs**

In `src/components/deals/DealMarketingEditor.tsx`:

Import what's needed:

```tsx
import {
  IngestionConflictProvider,
  countConflictsFor,
} from "#/components/deals/ingestionConflictContext";
import { resolveIngestionConflict } from "#/data/actions";
```

Wrap the component's returned tree in the provider, sourcing conflicts from the listing:

```tsx
  const conflicts = listing.ingestion?.conflicts ?? [];
```

(The two badge counts are derived further down, from the `CONFLICT_TAB` map.)

Wrap the existing JSX return in:

```tsx
    <IngestionConflictProvider
      conflicts={conflicts}
      onResolve={(fieldKey, side) => resolveIngestionConflict(listing.id, fieldKey, side)}
    >
      {/* existing tree */}
    </IngestionConflictProvider>
```

Add a count badge to each tab label so a conflict can't hide behind an unselected tab. The two `Tabs.Tab`s are at ~line 487 (listing) and ~line 493 (deal). Inside each tab's children, after the existing label text, add:

```tsx
{dealTabConflicts > 0 && (
  <Badge variant="warning" appearance="muted">
    {dealTabConflicts}
  </Badge>
)}
```

using `listingTabConflicts` for the listing tab. Import `Badge` from `@buildoutinc/blueprint-react/ui/Badge` if it isn't already imported. Do **not** add margin utility classes to the Badge — Badge already has a flex gap.

Finally, when the route is in review mode, open the tab that holds the first unresolved conflict.

**First, read the two `Tabs.Tab value=` props** (~lines 487 and 493) and the `Tabs` `value` /
`onValueChange` state pair to get the real tab identifiers. The snippet below assumes `"listing"`
and `"deal"` — substitute whatever is actually there.

Add a single map next to the two count constants, so tab membership is stated once and both the
badges and the initial-tab choice read from it:

```tsx
/** Which editor tab each conflict field lives on. */
const CONFLICT_TAB: Record<IngestionFieldKey, "deal" | "listing"> = {
  askingPrice: "deal",
  noi: "deal",
  occupancyPct: "listing",
};
```

Then derive the initial tab, defaulting to whatever the component already defaults to when not in
review mode:

```tsx
  // In review mode, open on the tab holding the first unresolved conflict so the
  // broker doesn't have to hunt across tabs for it.
  const firstUnresolved = conflicts.find((c) => !c.resolution);
  const initialTab =
    review === "ingestion" && firstUnresolved
      ? CONFLICT_TAB[firstUnresolved.fieldKey]
      : DEFAULT_TAB;
```

Replace `DEFAULT_TAB` with the component's existing initial tab value (read it off the `useState`
call that backs the `Tabs`), and pass `initialTab` as that `useState`'s initial value. This is
initial state only — it must not fight the user's later tab clicks, so do not add an effect that
re-selects the tab on every conflict change.

Derive the two badge counts from the same map rather than hardcoding the key lists:

```tsx
  const dealTabConflicts = countConflictsFor(
    conflicts,
    (Object.keys(CONFLICT_TAB) as IngestionFieldKey[]).filter((k) => CONFLICT_TAB[k] === "deal"),
  );
  const listingTabConflicts = countConflictsFor(
    conflicts,
    (Object.keys(CONFLICT_TAB) as IngestionFieldKey[]).filter((k) => CONFLICT_TAB[k] === "listing"),
  );
```

Import the `IngestionFieldKey` type from `#/data/types`.

- [ ] **Step 6: Read the `review` search param on the edit route**

In `src/routes/_shell/listings/$listingId/edit.tsx`, add a validated search schema and pass it down. TanStack Router needs `validateSearch` for a typed param:

```tsx
export const Route = createFileRoute("/_shell/listings/$listingId/edit")({
  validateSearch: (search: Record<string, unknown>): { review?: "ingestion" } => ({
    review: search.review === "ingestion" ? "ingestion" : undefined,
  }),
  component: EditRoute,
});
```

Then in `EditRoute`, read it and forward it:

```tsx
  const { review } = Route.useSearch();
  ...
  return <DealMarketingEditor listing={listing} property={property} review={review} />;
```

Add the matching optional prop to `DealMarketingEditor`'s props type:

```tsx
  /** When "ingestion", open on the first conflicting field's tab. */
  review?: "ingestion";
```

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output. If the `Link`/`search` call in Task 4's banner now errors because the route's search type changed, that is expected — the typed schema is what makes it check. Fix the call site to match.

- [ ] **Step 8: Run the full suite**

Run: `bun --bun run test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/deals/ingestionConflictContext.tsx src/components/listings/edit/fieldWidgets.tsx src/components/deals/DealMarketingEditor.tsx src/components/listings/edit/sections/BuildingSection.tsx src/routes/_shell/listings/\$listingId/edit.tsx src/main.scss
git commit -m "feat(deals): arbitrate ingestion conflicts on the real edit fields"
```

---

## Final verification

- [ ] `bunx tsc --noEmit` — no output
- [ ] `bun --bun run test` — all files pass
- [ ] `bun --bun run build` — succeeds (does not type-check; catches bundling/import errors)
- [ ] Confirm the Rosa arc is untouched: `git diff main --stat` shows no changes to `src/components/call/`, `src/components/contacts/ContactEngagementPanel.tsx`, or `src/components/deals/AiDealProgressModal.tsx`
- [ ] Ask the user to verify by hand — Playwright is not permitted in this repo:
  1. Create a deal with files attached on a Sale → lands on the overview with the processing banner, no blocking modal
  2. Banner walks its stages (~5s), then flips to "3 fields need your confirmation"
  3. **Review fields** opens the edit form with the Deal tab selected, a badge on both tabs, and asking price + NOI showing the arbitration row
  4. Picking a side writes the value and clears that row; the Listing tab badge leads to occupancy
  5. Resolving all three flips the banner to the green filled-N-fields state
  6. Before resolving, Approve & Publish is blocked on asking price; after, it isn't
  7. The Rosa email arc still shows its original blocking modal and lands a clean deal
