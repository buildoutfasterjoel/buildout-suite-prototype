# Lease Space Marketing Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a lease representation deal a marketing-only shell and each of its spaces a transacting child deal, so marketing lives on the building while space terms and their commissions live on the space.

**Architecture:** A new pure module `src/data/dealShape.ts` classifies any listing as `sale | flat-lease | shell | space` and derives everything shape-dependent from it — which stages are offered, how `proposal` is labelled, and what a space contributes to the building's availability table. Existing modules take the shape as an explicit parameter rather than reaching into the store, keeping `stageGates.ts` pure and its 30+ existing tests passing unchanged. The per-unit lease-terms editor is extracted from the parent's edit form into a standalone `SpaceTermsSection` mounted in two places, both writing to the child deal's record.

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routing) · Zustand store (`src/data/store.ts`, `src/data/dataStore.ts`) · Vitest · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro

**Spec:** `docs/superpowers/specs/2026-07-31-lease-space-marketing-scope-design.md`

## Global Constraints

- Package manager is Bun. Always `bun --bun run <script>`. Single test file: `bunx vitest run <path>`.
- `vite build` does **not** type-check. The type gate is `bunx tsc --noEmit` — run it before every commit.
- Biome warnings and a `react/module` Vitest stderr line are pre-existing non-gates. Ignore them.
- All UI uses Blueprint React components imported from the `ui` subpath. Bootstrap 5 utility classes for spacing/layout. Never Tailwind.
- FontAwesome Pro, `pro-regular` weight by default. **Never** pass `fixedWidth` to `FontAwesomeIcon` — it is deprecated in this codebase.
- Never add margin utilities to icons inside a Blueprint `Badge` — Badge already applies flex gap.
- Do **not** restructure the visual design of any component beyond what a task explicitly states.
- Do **not** edit `src/routes/routeTree.gen.ts` — it regenerates on dev/build.
- Do **not** use Playwright. Run unit tests; leave in-app verification to the user.
- No new values may be added to the `PropertyStatus` union. Every ladder change is a matter of which values are *offered* and how `proposal` is *labelled*.
- Do not push, merge, or open PRs. Commit to the current branch only.

---

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `src/data/dealShape.ts` | Classify a listing's shape; derive offered stages, contextual stage label, and a space's availability status. Pure except for one store read to count children. |
| `src/data/dealShape.test.ts` | Tests for the above. |
| `src/data/buildingAvailability.ts` | Build the building's availability table from a shell's child deals. |
| `src/data/buildingAvailability.test.ts` | Tests for the above. |
| `src/components/listings/edit/sections/SpaceTermsSection.tsx` | Edit exactly one unit's `SpaceLeaseTerms` on one listing. Extracted from `LeaseSpacesSection`'s `UnitLeaseCard`. Mounted on the Spaces tab and on a space deal's edit form. |
| `src/components/deals/PropertyMarketingHub.tsx` | The read-only scope hub shown on a space deal. |
| `src/components/deals/MarketingScopeBar.tsx` | The `?from=<childId>` return bar shown on a shell's marketing tabs. |
| `src/routes/_shell/listings/$listingId/property-marketing.tsx` | Route hosting the hub. |

**Modified**

| File | Change |
|---|---|
| `src/data/leaseSpaces.ts` | Delete `TEMPLATE_KEYS`, `applyTemplate`, `resyncChildFromParent`. `addSpaceToDeal` moves the parent's terms row to the child. |
| `src/data/leaseSpaces.test.ts` | Drop the snapshot/re-sync test; assert the row moves. |
| `src/data/stageGates.ts` | Optional `shape` parameter on `resolveGate`; `shellActive` required field; space-specific Approve & Publish gate. |
| `src/data/types.ts` | `VisualMediaLink.unitId`; `PropertyLeadRecord.unitId`. |
| `src/components/deals/StageGate.tsx`, `src/components/deals/useStageGate.ts` | Pass the shape and `shellActive` through. |
| `src/components/listings/edit/ListingFormEditor.tsx` | Remove `LeaseSpacesSection`; render `SpaceTermsSection` for space deals only. |
| `src/components/listings/edit/sections/LeaseSpacesSection.tsx` | Deleted — its card becomes `SpaceTermsSection`. |
| `src/components/deals/DealMarketingEditor.tsx` | Suppress Transaction Terms + Financials for a shell. |
| `src/components/properties/PropertyDetailSidebar.tsx` | Shape-aware nav groups. |
| `src/components/properties/PropertyDetailHeader.tsx` | Shape-aware stage options and labels; guard Add space past Active. |
| `src/routes/_shell/listings/$listingId/spaces.tsx` | Inline `SpaceTermsSection` per row; availability rollup. |
| Deal-facing label sites | Use `dealStageLabel` instead of `STATUS_LABELS`. |

---

## Task 1: Deal shape module

**Files:**
- Create: `src/data/dealShape.ts`
- Test: `src/data/dealShape.test.ts`

**Interfaces:**
- Consumes: `Listing`, `PropertyStatus` from `./types`; `getChildDeals` from `./leaseSpaces`; `STAGE_LABEL` from `./stageGates`. **Not** `propertyDisplay` — `STAGE_LABEL` (`stageGates.ts:104`) already holds identical labels inside the data layer, so this stays a data-layer module with no import into `src/components`.
- Produces:
  - `type DealShape = 'sale' | 'flat-lease' | 'shell' | 'space'`
  - `function dealShape(deal: Listing): DealShape`
  - `function availableStages(shape: DealShape): PropertyStatus[]`
  - `function dealStageLabel(status: PropertyStatus, shape: DealShape): string`
  - `type SpaceAvailability = 'Not advertised' | 'Available' | 'Under Contract' | 'Leased'`
  - `function spaceAvailability(childStatus: PropertyStatus): SpaceAvailability`
  - `function gateContext(deal: Listing): { shape: DealShape; shellActive: boolean }` — consumed by Task 5
  - `function canAddSpaces(deal: Listing): boolean` — consumed by Task 8

- [ ] **Step 1: Write the failing test**

Create `src/data/dealShape.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { dealShape, availableStages, dealStageLabel, spaceAvailability } from './dealShape'

function makeLeaseParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('dealShape', () => {
  it('classifies a sale deal as sale', () => {
    const sale = createProposalListing({ ...emptyDraft(), name: 'Tower Sale', dealType: 'Sale' })
    expect(dealShape(sale)).toBe('sale')
  })

  it('classifies a childless lease deal as flat-lease and a parented one as space', () => {
    const parent = makeLeaseParent()
    expect(dealShape(parent)).toBe('flat-lease')
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 2400, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(dealShape(child)).toBe('space')
  })

  it('promotes the parent to shell once a child exists', () => {
    const parent = makeLeaseParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 200', sqft: 1200, unitType: 'retail' })!
    addSpaceToDeal(parent.id, unit.id)
    expect(dealShape(parent)).toBe('shell')
  })
})

describe('availableStages', () => {
  it('caps a shell at Pitching, Active, Lost', () => {
    expect(availableStages('shell')).toEqual(['proposal', 'active', 'inactive'])
  })

  it('gives a space deal the full ladder', () => {
    expect(availableStages('space')).toEqual([
      'proposal', 'active', 'under-contract', 'closed', 'inactive',
    ])
  })

  it('leaves sale and flat-lease on the full ladder', () => {
    expect(availableStages('sale')).toEqual(availableStages('space'))
    expect(availableStages('flat-lease')).toEqual(availableStages('space'))
  })
})

describe('dealStageLabel', () => {
  it('labels proposal Draft on a space deal', () => {
    expect(dealStageLabel('proposal', 'space')).toBe('Draft')
  })

  it('labels proposal Pitching everywhere else', () => {
    expect(dealStageLabel('proposal', 'shell')).toBe('Pitching')
    expect(dealStageLabel('proposal', 'sale')).toBe('Pitching')
    expect(dealStageLabel('proposal', 'flat-lease')).toBe('Pitching')
  })

  it('leaves every other stage untouched', () => {
    expect(dealStageLabel('active', 'space')).toBe('Active')
    expect(dealStageLabel('under-contract', 'space')).toBe('Under Contract')
    expect(dealStageLabel('closed', 'space')).toBe('Closed')
    expect(dealStageLabel('inactive', 'space')).toBe('Lost')
  })
})

describe('spaceAvailability', () => {
  it('maps a child stage to what the building advertises', () => {
    expect(spaceAvailability('proposal')).toBe('Not advertised')
    expect(spaceAvailability('active')).toBe('Available')
    expect(spaceAvailability('under-contract')).toBe('Under Contract')
    expect(spaceAvailability('closed')).toBe('Leased')
    expect(spaceAvailability('inactive')).toBe('Not advertised')
  })
})

describe('gateContext', () => {
  it('reports the shell as inactive until the building is live', () => {
    const parent = makeLeaseParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 500', sqft: 700, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(gateContext(child)).toEqual({ shape: 'space', shellActive: false })

    commitStageTransition({ dealId: parent.id, targetStage: 'active', actor: 'T' })
    expect(gateContext(child).shellActive).toBe(true)
  })
})

describe('canAddSpaces', () => {
  it('allows Pitching and Active lease parents', () => {
    const parent = makeLeaseParent()
    expect(canAddSpaces(parent)).toBe(true)
    expect(canAddSpaces({ ...parent, status: 'active' })).toBe(true)
  })

  it('blocks a deal already past Active, a space deal, and a sale deal', () => {
    const parent = makeLeaseParent()
    expect(canAddSpaces({ ...parent, status: 'under-contract' })).toBe(false)
    expect(canAddSpaces({ ...parent, status: 'closed' })).toBe(false)
    expect(canAddSpaces({ ...parent, parentDealId: 'p1' })).toBe(false)
    expect(canAddSpaces({ ...parent, dealType: 'Sale' })).toBe(false)
  })
})
```

Add `gateContext` and `canAddSpaces` to the `./dealShape` import, and add
`import { commitStageTransition } from './actions'` at the top.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/data/dealShape.test.ts`
Expected: FAIL — cannot resolve `./dealShape`.

- [ ] **Step 3: Write the implementation**

Create `src/data/dealShape.ts`:

```ts
import type { Listing, PropertyStatus } from './types'
import { getChildDeals } from './leaseSpaces'
import { getListing } from './store'
import { STAGE_LABEL } from './stageGates'

/** The full ladder, in display order. Stated explicitly rather than derived from
 *  an object's key order, because the order is load-bearing for the stage select. */
const FULL_LADDER: PropertyStatus[] = [
  'proposal', 'active', 'under-contract', 'closed', 'inactive',
]

/**
 * How a listing behaves, which is not the same as what it is. A lease deal is a
 * `shell` only once it has children — before that it is a normal whole-building
 * lease listing and must keep behaving like one.
 */
export type DealShape = 'sale' | 'flat-lease' | 'shell' | 'space'

export function dealShape(deal: Listing): DealShape {
  if (deal.dealType !== 'Lease') return 'sale'
  if (deal.parentDealId != null) return 'space'
  return getChildDeals(deal.id).length > 0 ? 'shell' : 'flat-lease'
}

/**
 * A shell never advances past Active: its spaces carry the transactions, so it
 * has no tenant, no commission, and nothing to close. Every other shape keeps
 * the full ladder — a space deal's difference is in labelling, not in reach.
 */
export function availableStages(shape: DealShape): PropertyStatus[] {
  if (shape === 'shell') return ['proposal', 'active', 'inactive']
  return [...FULL_LADDER]
}

/**
 * A suite is never "pitched" — the assignment was already won on the shell — but
 * it does need a pre-market state, so `proposal` reads as Draft there.
 */
export function dealStageLabel(status: PropertyStatus, shape: DealShape): string {
  if (shape === 'space' && status === 'proposal') return 'Draft'
  return STAGE_LABEL[status]
}

/** The shape + shell state a gate needs, resolved from the store in one place. */
export function gateContext(deal: Listing): { shape: DealShape; shellActive: boolean } {
  const shape = dealShape(deal)
  const shell = deal.parentDealId ? getListing(deal.parentDealId) : undefined
  return { shape, shellActive: shell?.status === 'active' }
}

/** Spaces may only be added while the deal can still become a shell. */
export function canAddSpaces(deal: Listing): boolean {
  return (
    deal.dealType === 'Lease' &&
    deal.parentDealId == null &&
    (deal.status === 'proposal' || deal.status === 'active')
  )
}

export type SpaceAvailability = 'Not advertised' | 'Available' | 'Under Contract' | 'Leased'

/** What the building's marketing advertises for a space, derived from its deal stage. */
export function spaceAvailability(childStatus: PropertyStatus): SpaceAvailability {
  switch (childStatus) {
    case 'active':
      return 'Available'
    case 'under-contract':
      return 'Under Contract'
    case 'closed':
      return 'Leased'
    case 'proposal':
    case 'inactive':
      return 'Not advertised'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/data/dealShape.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Type-check and commit**

```bash
bunx tsc --noEmit
git add src/data/dealShape.ts src/data/dealShape.test.ts
git commit -m "feat(lease): classify deal shape and derive stage ladder, labels, availability"
```

---

## Task 2: Promotion moves the terms row instead of forking it

**Files:**
- Modify: `src/data/leaseSpaces.ts:9-23` (delete), `:46-97` (`addSpaceToDeal`), `:99-112` (delete)
- Test: `src/data/leaseSpaces.test.ts`

**Interfaces:**
- Consumes: `dealShape` is not needed here. Uses `getListing`, `getProperty`, `addListing`, `updateDealMarketing`.
- Produces: `addSpaceToDeal(parentDealId, unitId)` unchanged in signature; `resyncChildFromParent` and the internal template helpers no longer exist.

Today `addSpaceToDeal` writes `emptySpaceLeaseTerms(unitId)` onto the child, forking a blank row away from the parent's array. Because `spaces.tsx:86` reads the child's copy, a suite priced at $28/SF on the parent shows "Rate TBD" the moment it is promoted. The row must move.

- [ ] **Step 1: Update the test file**

In `src/data/leaseSpaces.test.ts`, delete the entire `it('snapshots the parent template and re-syncs on demand', ...)` block and remove `resyncChildFromParent` from the import list. Then add these two tests inside `describe('lease space actions', ...)`:

```ts
  it('moves the parent existing terms row onto the child', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 300', sqft: 3000, unitType: 'retail' })!
    // Broker priced the suite on the parent before promoting it.
    commitStageTransition({
      dealId: parent.id,
      targetStage: 'proposal',
      actor: 'T',
      marketing: {
        spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 28, leaseTermMonths: 60 }],
      },
    })

    const child = addSpaceToDeal(parent.id, unit.id)!.deal

    // The row moved to the child, carrying its numbers.
    expect(child.marketing.spaceLeaseTerms).toHaveLength(1)
    expect(child.marketing.spaceLeaseTerms[0]!.leaseRate).toBe(28)
    expect(child.marketing.spaceLeaseTerms[0]!.leaseTermMonths).toBe(60)
    // And is gone from the parent, so there is one editable home per unit.
    expect(getListing(parent.id)!.marketing.spaceLeaseTerms.some((t) => t.unitId === unit.id)).toBe(false)
  })

  it('seeds a blank row when the parent never priced the unit', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 400', sqft: 900, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(child.marketing.spaceLeaseTerms[0]!.unitId).toBe(unit.id)
    expect(child.marketing.spaceLeaseTerms[0]!.leaseRate).toBeNull()
  })
```

Add `emptySpaceLeaseTerms` to the existing `./createListing` import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/data/leaseSpaces.test.ts`
Expected: FAIL — `leaseRate` is `null` instead of `28`, and the parent still holds the row.

- [ ] **Step 3: Rewrite `leaseSpaces.ts`**

Delete lines 9–23 (`TEMPLATE_KEYS` and `applyTemplate`) and lines 99–112 (`resyncChildFromParent`). Remove the now-unused `updateDealMarketing` import only if nothing else uses it — it **is** still needed, see below. Replace the `marketing:` field of the child in `addSpaceToDeal` and add the parent cleanup:

```ts
  // The parent's row for this unit — if the broker already priced it, that row
  // moves to the child rather than forking a blank copy. One editable home per unit.
  const existingRow = parent.marketing.spaceLeaseTerms?.find((t) => t.unitId === unitId)

  const child: Listing = {
    ...parent,
    // ...all existing fields unchanged...
    marketing: {
      ...parent.marketing,
      availableSqFt: unit.sqft,
      spaceLeaseTerms: [existingRow ? { ...existingRow } : { ...emptySpaceLeaseTerms(unitId) }],
    },
    createdAt: now,
    updatedAt: now,
  }

  addListing(child)

  // Drop the moved row from the parent so the shell holds no space terms of its own.
  if (existingRow) {
    updateDealMarketing(parentDealId, {
      spaceLeaseTerms: (parent.marketing.spaceLeaseTerms ?? []).filter((t) => t.unitId !== unitId),
    })
  }

  return { deal: child }
```

Keep the `applyTemplate` call removed entirely — the child now inherits `parent.marketing` wholesale via the spread, which is correct: property-level marketing fields are read through, not owned, and the child's copies are never edited.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run src/data/leaseSpaces.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Verify nothing else referenced the deleted exports**

Run: `grep -rn "resyncChildFromParent\|applyTemplate\|TEMPLATE_KEYS" src`
Expected: no output. If a UI component references "Re-sync from parent", delete that action and its button.

- [ ] **Step 6: Type-check and commit**

```bash
bunx tsc --noEmit
git add src/data/leaseSpaces.ts src/data/leaseSpaces.test.ts
git commit -m "fix(lease): move a unit's terms row to its space deal instead of forking a blank one"
```

---

## Task 3: Building availability derived from children

**Files:**
- Create: `src/data/buildingAvailability.ts`
- Test: `src/data/buildingAvailability.test.ts`

**Interfaces:**
- Consumes: `getChildDeals` from `#/data/leaseSpaces`; `spaceAvailability` from `#/data/dealShape`; `getListing`, `getProperty` from `#/data/store`.
- Produces:
  - `interface AvailabilityRow { dealId: string; unitId: string; label: string; sqft: number; leaseRate: number | null; leaseRateUnits: LeaseRateUnits; leaseTermMonths: number | null; availability: SpaceAvailability; advertised: boolean }`
  - `function buildingAvailability(shellDealId: string): AvailabilityRow[]` — **every** child, for the Spaces tab's manager view
  - `function advertisedAvailability(shellDealId: string): AvailabilityRow[]` — only rows the building actually advertises, for public marketing surfaces

The spec requires a Draft space to be "absent from the availability table entirely." That is true of the *public* table only — the Spaces tab must still show Draft spaces so the broker can find and publish them. Hence two functions, not one with a flag.

- [ ] **Step 1: Write the failing test**

Create `src/data/buildingAvailability.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition } from './actions'
import { buildingAvailability } from './buildingAvailability'

function makeParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('buildingAvailability', () => {
  it('returns one row per child, carrying the child stage as availability', () => {
    const parent = makeParent()
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite A', sqft: 1000, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite B', sqft: 2000, unitType: 'retail' })!
    const childA = addSpaceToDeal(parent.id, a.id)!.deal
    addSpaceToDeal(parent.id, b.id)

    commitStageTransition({
      dealId: childA.id,
      targetStage: 'active',
      actor: 'T',
      marketing: { spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(a.id), leaseRate: 28, leaseTermMonths: 60 }] },
    })

    const rows = buildingAvailability(parent.id)
    expect(rows).toHaveLength(2)

    const rowA = rows.find((r) => r.unitId === a.id)!
    expect(rowA.label).toBe('Suite A')
    expect(rowA.leaseRate).toBe(28)
    expect(rowA.availability).toBe('Available')
    expect(rowA.advertised).toBe(true)

    const rowB = rows.find((r) => r.unitId === b.id)!
    expect(rowB.availability).toBe('Not advertised')
    expect(rowB.advertised).toBe(false)
  })

  it('follows a child into Under Contract with no sync step', () => {
    const parent = makeParent()
    const u = addPropertyUnit(parent.propertyId, { label: 'Suite C', sqft: 800, unitType: 'retail' })!
    const child = addSpaceToDeal(parent.id, u.id)!.deal
    commitStageTransition({ dealId: child.id, targetStage: 'active', actor: 'T' })
    commitStageTransition({ dealId: child.id, targetStage: 'under-contract', actor: 'T' })
    expect(buildingAvailability(parent.id)[0]!.availability).toBe('Under Contract')
  })

  it('returns nothing for a deal with no children', () => {
    expect(buildingAvailability(makeParent().id)).toEqual([])
  })

  it('hides Draft spaces from the advertised table but keeps them in the manager view', () => {
    const parent = makeParent()
    const a = addPropertyUnit(parent.propertyId, { label: 'Suite D', sqft: 100, unitType: 'retail' })!
    const b = addPropertyUnit(parent.propertyId, { label: 'Suite E', sqft: 200, unitType: 'retail' })!
    const live = addSpaceToDeal(parent.id, a.id)!.deal
    addSpaceToDeal(parent.id, b.id) // stays Draft
    commitStageTransition({ dealId: live.id, targetStage: 'active', actor: 'T' })

    expect(buildingAvailability(parent.id)).toHaveLength(2)
    const advertised = advertisedAvailability(parent.id)
    expect(advertised).toHaveLength(1)
    expect(advertised[0]!.label).toBe('Suite D')
  })
})
```

Add `advertisedAvailability` to the `./buildingAvailability` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/data/buildingAvailability.test.ts`
Expected: FAIL — cannot resolve `./buildingAvailability`.

- [ ] **Step 3: Write the implementation**

Create `src/data/buildingAvailability.ts`:

```ts
import type { LeaseRateUnits } from './types'
import { getListing, getProperty } from './store'
import { getChildDeals } from './leaseSpaces'
import { spaceAvailability, type SpaceAvailability } from './dealShape'

export interface AvailabilityRow {
  dealId: string
  unitId: string
  label: string
  sqft: number
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  leaseTermMonths: number | null
  availability: SpaceAvailability
  /** False for a space the building is not currently advertising (Draft or Lost). */
  advertised: boolean
}

/**
 * The building's availability table. Sourced entirely from the shell's child
 * deals — each space owns its own terms, and its deal stage IS its advertised
 * status, so there is nothing to keep in sync.
 */
export function buildingAvailability(shellDealId: string): AvailabilityRow[] {
  const shell = getListing(shellDealId)
  if (!shell) return []
  const property = getProperty(shell.propertyId)

  return getChildDeals(shellDealId).flatMap((child) => {
    if (!child.unitId) return []
    const unit = property?.units.find((u) => u.id === child.unitId)
    const terms = child.marketing.spaceLeaseTerms?.[0]
    const availability = spaceAvailability(child.status)
    return [{
      dealId: child.id,
      unitId: child.unitId,
      label: unit?.label ?? child.name,
      sqft: unit?.sqft ?? 0,
      leaseRate: terms?.leaseRate ?? null,
      leaseRateUnits: terms?.leaseRateUnits ?? 'SF/Yr',
      leaseTermMonths: terms?.leaseTermMonths ?? null,
      availability,
      advertised: availability !== 'Not advertised',
    }]
  })
}

/** The rows the building actually advertises — what a public marketing surface renders. */
export function advertisedAvailability(shellDealId: string): AvailabilityRow[] {
  return buildingAvailability(shellDealId).filter((r) => r.advertised)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/data/buildingAvailability.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Type-check and commit**

```bash
bunx tsc --noEmit
git add src/data/buildingAvailability.ts src/data/buildingAvailability.test.ts
git commit -m "feat(lease): derive the building's availability table from its space deals"
```

---

## Task 4: Shape-aware stage gates

**Files:**
- Modify: `src/data/stageGates.ts` — `RequiredField` (`:16-31`), `GateFormState` (`:34-64`), `seedGateForm` (`:188`), `publishReadiness` (`:242`), `resolveGate` (`:251`), `fieldSatisfied` (`:347`)
- Test: `src/data/stageGates.space.test.ts` (create)

**Interfaces:**
- Consumes: `DealShape` from `#/data/dealShape`.
- Produces:
  - `resolveGate(from, target, dealType, shape?: DealShape)` — `shape` defaults to `dealType === 'Lease' ? 'flat-lease' : 'sale'`, so all existing callers and their 30+ tests are unaffected.
  - `seedGateForm(deal: Listing, ctx?: { shellActive?: boolean })`
  - `publishReadiness(deal: Listing, ctx?: { shape?: DealShape; shellActive?: boolean })`
  - New `RequiredField` member `'shellActive'`; new `GateFormState` member `shellActive: boolean`.

`stageGates.ts` must stay pure — it imports only from `./types` today, and adding a store import risks a cycle. The shape and the shell's status are therefore passed in by callers.

- [ ] **Step 1: Write the failing test**

Create `src/data/stageGates.space.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveGate, fieldSatisfied, canConfirm, type GateFormState } from './stageGates'

const EMPTY: GateFormState = {
  buyerLinked: false, listedOnDate: null, listingExpirationDate: null,
  contractExecutedDate: null, closeDate: null, salePrice: null,
  commissionAmount: null, commissionPct: null, deadReason: null,
  aiDocsAllReviewed: false, unpublishOnExit: true, buyerContactId: null,
  saleTitle: '', saleDescription: '', askingPrice: null,
  tenantLinked: false, tenantContactId: null,
  leaseRate: null, leaseRateUnits: 'SF/Yr', availableSqFt: null,
  leaseTermMonths: null, leaseCommencementDate: null, shellActive: false,
}

describe('space deal Approve & Publish gate', () => {
  const gate = resolveGate('proposal', 'active', 'Lease', 'space')

  it('gates on the space own numbers plus a live building', () => {
    expect(gate.required).toEqual(['leaseRate', 'availableSqFt', 'leaseTermMonths', 'shellActive'])
  })

  it('does not require property-level fields the space cannot own', () => {
    for (const f of ['saleTitle', 'saleDescription', 'aiDocsReviewed', 'listedOnDate', 'listingExpirationDate']) {
      expect(gate.required).not.toContain(f)
    }
  })

  it('blocks until the shell is Active', () => {
    const priced = { ...EMPTY, leaseRate: 28, availableSqFt: 4200, leaseTermMonths: 60 }
    expect(canConfirm(gate, priced)).toBe(false)
    expect(canConfirm(gate, { ...priced, shellActive: true })).toBe(true)
  })

  it('satisfies shellActive only when true', () => {
    expect(fieldSatisfied('shellActive', EMPTY)).toBe(false)
    expect(fieldSatisfied('shellActive', { ...EMPTY, shellActive: true })).toBe(true)
  })
})

describe('other shapes are unchanged', () => {
  it('leaves a flat lease deal on the original publish gate', () => {
    const g = resolveGate('proposal', 'active', 'Lease', 'flat-lease')
    expect(g.required).toContain('saleTitle')
    expect(g.required).toContain('aiDocsReviewed')
    expect(g.required).toContain('leaseRate')
  })

  it('defaults the shape from dealType when the argument is omitted', () => {
    expect(resolveGate('proposal', 'active', 'Lease').required)
      .toEqual(resolveGate('proposal', 'active', 'Lease', 'flat-lease').required)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/data/stageGates.space.test.ts`
Expected: FAIL — `resolveGate` takes 3 arguments, `shellActive` is not a known field.

- [ ] **Step 3: Implement**

In `src/data/stageGates.ts`:

Add the import at the top:
```ts
import type { DealShape } from './dealShape'
```

Add `'shellActive'` to the `RequiredField` union.

Add to `GateFormState`, next to the other lease fields:
```ts
  /** Approve & Publish (space deal): the building's marketing is live. */
  shellActive: boolean
```

In `seedGateForm`, add the parameter and the field. The shell's status is not reachable from a pure module, so it is supplied by the caller:
```ts
export function seedGateForm(deal: Listing, ctx?: { shellActive?: boolean }): GateFormState {
  // ...existing body unchanged...
  return {
    // ...existing fields unchanged...
    shellActive: ctx?.shellActive ?? false,
  }
}
```

In `resolveGate`, add the fourth parameter and the space branch:
```ts
export function resolveGate(
  from: PropertyStatus,
  target: PropertyStatus,
  dealType: DealType,
  shape: DealShape = dealType === 'Lease' ? 'flat-lease' : 'sale',
): GateConfig {
  const isLease = dealType === 'Lease'
  // ...existing fi/ti/forward/base unchanged...
```

Inside `switch (target)`, at the top of `case 'active':`, insert the space branch before the existing return:
```ts
    case 'active':
      // A space deal's publish gate is the moment the suite enters the building's
      // marketing. It gates on the space's own numbers only — title, description,
      // doc review, and the listing-agreement dates are property-level and belong
      // to the shell, which must itself already be live.
      if (shape === 'space') {
        return {
          ...base,
          kind: 'field',
          title: 'Publish space to the building listing',
          required: ['leaseRate', 'availableSqFt', 'leaseTermMonths', 'shellActive'],
          publishes: true,
        }
      }
      return {
        // ...existing return unchanged...
      }
```

In `fieldSatisfied`, add the case:
```ts
    case 'shellActive':
      return form.shellActive
```

Update `publishReadiness` to thread the context through:
```ts
export function publishReadiness(
  deal: Listing,
  ctx?: { shape?: DealShape; shellActive?: boolean },
): { ready: boolean; missing: RequiredField[] } {
  const config = resolveGate('proposal', 'active', deal.dealType, ctx?.shape)
  const form = seedGateForm(deal, { shellActive: ctx?.shellActive })
  const missing = config.required.filter((f) => !fieldSatisfied(f, form))
  return { ready: missing.length === 0, missing }
}
```

Add the label to `REQUIRED_FIELD_LABEL` (`stageGates.ts:113`):
```ts
  shellActive: 'Building marketing published',
```

Add the field to `EMPTY_GATE_FORM` (`stageGates.ts:133`):
```ts
  shellActive: false,
```

- [ ] **Step 4: Run the full stageGates suite**

Run: `bunx vitest run src/data/stageGates.space.test.ts src/data/stageGates.test.ts src/data/stageGates.lease.test.ts src/data/stageGates.leaseCommit.test.ts`
Expected: PASS. The pre-existing suites must be **unmodified** — if any fails, the default-parameter fallback is wrong; fix the default rather than the old tests.

- [ ] **Step 5: Fix any remaining `GateFormState` literal**

Run: `bunx tsc --noEmit`
Add `shellActive: false` to any other object literal the compiler flags (fixtures in `stageGates.test.ts`, `publishPreview.test.ts`).

- [ ] **Step 6: Commit**

```bash
bunx tsc --noEmit && bunx vitest run src/data
git add src/data
git commit -m "feat(lease): gate a space deal's publish on its own numbers and a live building"
```

---

## Task 5: Wire the shape into the live gate path

**Files:**
- Modify: `src/components/deals/useStageGate.ts:81,93`, `src/components/deals/StageGate.tsx:222,227`

**Interfaces:**
- Consumes: `dealShape` from `#/data/dealShape`; `getListing` from `#/data/store`.
- Produces: no new exports. Runtime behaviour only.

`gateContext` already exists and is already tested — Task 1 built it. This task only wires it in.

- [ ] **Step 1: Thread it through both call sites**

In `src/components/deals/useStageGate.ts`, replace line 81 and line 93:
```ts
  const ctx = gateContext(deal);
  const config = resolveGate(deal.status, targetStage, deal.dealType, ctx.shape);
  // ...
    const form = seedGateForm(deal, { shellActive: ctx.shellActive });
```

In `src/components/deals/StageGate.tsx`, replace line 222 and line 227:
```ts
    return resolveGate(deal.status, targetStage, deal.dealType, dealShape(deal));
  // ...
    () => (deal ? seedGateForm(deal, { shellActive: gateContext(deal).shellActive }) : EMPTY_GATE_FORM),
```

Import `dealShape` and `gateContext` from `#/data/dealShape` in both files.

- [ ] **Step 2: Verify**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: all suites pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/deals/useStageGate.ts src/components/deals/StageGate.tsx
git commit -m "feat(lease): resolve gates against deal shape and shell state"
```

---

## Task 6: Extract `SpaceTermsSection`

**Files:**
- Create: `src/components/listings/edit/sections/SpaceTermsSection.tsx`
- Modify: `src/components/listings/edit/sections/LeaseSpacesSection.tsx` (becomes a thin re-export, deleted in Task 7)

**Interfaces:**
- Consumes: `Property`, `PropertyUnit`, `SpaceLeaseTerms` from `#/data/types`; the field widgets from `#/components/listings/edit/fieldWidgets`; `CollapsibleCard` from `#/components/listings/edit/ReorderableAccordion`; `ALL_SUBTYPES` from `#/components/listings/edit/sections/PropertySection`.
- Produces:
  ```ts
  export function SpaceTermsSection(props: {
    unit: PropertyUnit
    property: Property
    terms: SpaceLeaseTerms
    onChange: (patch: Partial<SpaceLeaseTerms>) => void
    /** Render bare, without the collapsible card wrapper. Used on a space deal's own edit form. */
    bare?: boolean
  }): JSX.Element
  ```

This is a pure move. **Do not change any field, label, layout, or ordering** — the existing `UnitLeaseCard` body is copied verbatim.

- [ ] **Step 1: Create the new file**

Create `src/components/listings/edit/sections/SpaceTermsSection.tsx`. Copy the **entire** `UnitLeaseCard` function from `LeaseSpacesSection.tsx:102-690`, plus the option-list constants from `:27-44` (`LEASE_RATE_UNITS`, `LEASE_TYPES`, `SPACE_STATUSES`, `LEASE_RATE_MODES`, `SPACE_SIZE_UNITS`) and the imports it needs. Rename the function to `SpaceTermsSection`, add the `bare` prop, and split the body out so it can render with or without the card:

```tsx
export function SpaceTermsSection({ unit, property, terms, onChange, bare = false }: {
  unit: PropertyUnit
  property: Property
  terms: SpaceLeaseTerms
  onChange: (patch: Partial<SpaceLeaseTerms>) => void
  bare?: boolean
}) {
  const isIndustrial = property.propertyType === "industrial";
  const addressRequired = property.tenancy !== "Single";

  const body = (
    <>
      {/* ...the entire existing renderContent body, verbatim... */}
    </>
  );

  if (bare) return body;

  return (
    <CollapsibleCard
      item={unit}
      renderTrigger={() => (
        <span className="fw-semibold d-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
          {unit.label}
          <span className="text-muted fw-normal ms-1">
            {unit.sqft.toLocaleString()} SF
          </span>
        </span>
      )}
      renderContent={() => body}
    />
  );
}
```

**Important:** the `Status` `SelectField` at the top of the body (`LeaseSpacesSection.tsx:132-150`) must be **removed** — a promoted space's availability is now derived from its deal stage (`spaceAvailability`), not hand-set. Replace it with a read-only line:

```tsx
{/* Availability is the space deal's stage — see spaceAvailability() — not a field. */}
<p className="form-text mb-0">
  Availability follows this space&apos;s deal stage.
</p>
```

Note the `Close Date` field was conditional on `terms.status === "Closed"`; remove it along with the Status select.

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit`
Expected: clean. Unused imports in the new file (e.g. `DateField` if the only use was Close Date — it is also used by `Date Available` and `Sublease Expiration`, so keep it) must be removed if the compiler flags them.

- [ ] **Step 3: Commit**

```bash
git add src/components/listings/edit/sections/SpaceTermsSection.tsx
git commit -m "refactor(lease): extract SpaceTermsSection from the per-unit lease card"
```

---

## Task 7: Remove Lease Spaces from the edit form; mount space terms on the space deal

**Files:**
- Modify: `src/components/listings/edit/ListingFormEditor.tsx:106-117`
- Delete: `src/components/listings/edit/sections/LeaseSpacesSection.tsx`
- Modify: `src/components/deals/DealMarketingEditor.tsx` (pass the listing through if not already available)

**Interfaces:**
- Consumes: `SpaceTermsSection` from Task 6; `dealShape` from `#/data/dealShape`.
- Produces: `ListingFormEditor` renders `SpaceTermsSection` only when the listing is a space deal.

- [ ] **Step 1: Replace the lease block in `ListingFormEditor.tsx`**

`ListingFormEditor` already receives the full `listing` prop (declared at `:45`, currently unused). Replace lines 106–117:

```tsx
			{dealType === "Lease" && (
				<>
					<Separator />
					<LeaseSection marketing={marketing} patchMarketing={patchMarketing} />
					{/* Space terms belong to the space deal that owns the unit. A shell or
					    flat lease deal manages its spaces from the Spaces tab instead. */}
					{spaceUnit && (
						<>
							<Separator />
							<Section title="Space Terms" icon={faVectorSquare}>
								<SpaceTermsSection
									bare
									unit={spaceUnit}
									property={property}
									terms={
										marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(spaceUnit.id)
									}
									onChange={(patch) =>
										patchMarketing({
											spaceLeaseTerms: [
												{
													...(marketing.spaceLeaseTerms?.[0] ??
														emptySpaceLeaseTerms(spaceUnit.id)),
													...patch,
												},
											],
										})
									}
								/>
							</Section>
						</>
					)}
				</>
			)}
```

Add above the `return`:

```tsx
	// A space deal edits exactly one unit's terms — its own. Every other listing
	// shape manages spaces from the Spaces tab.
	const spaceUnit =
		listing.parentDealId != null && listing.unitId
			? property.units.find((u) => u.id === listing.unitId)
			: undefined;
```

Add the imports: `SpaceTermsSection`, `Section` from `#/components/listings/listingWidgets`, `faVectorSquare` from `@fortawesome/pro-regular-svg-icons`, `emptySpaceLeaseTerms` from `#/data/createListing`. Remove the `LeaseSpacesSection` import. Remove `listing` from the eslint-unused list if one exists.

- [ ] **Step 2: Delete the old section**

```bash
git rm src/components/listings/edit/sections/LeaseSpacesSection.tsx
grep -rn "LeaseSpacesSection" src
```
Expected: no output.

- [ ] **Step 3: Verify**

Run: `bunx tsc --noEmit && bunx vitest run`
Expected: clean; all suites pass.

- [ ] **Step 4: Commit**

```bash
git add -A src/components/listings/edit
git commit -m "feat(lease): move space terms off the building edit form onto the space deal"
```

---

## Task 8: Spaces tab becomes the space manager

**Files:**
- Modify: `src/routes/_shell/listings/$listingId/spaces.tsx`
- Modify: `src/components/properties/PropertyDetailHeader.tsx:196-200` (Add space guard)

**Interfaces:**
- Consumes: `buildingAvailability` (Task 3), `SpaceTermsSection` (Task 6), `dealStageLabel`/`dealShape` (Task 1), `updateDealMarketing` from `#/data/actions`.
- Produces: no new exports.

`canAddSpaces` already exists and is already tested — Task 1 built it. This task consumes it.

- [ ] **Step 1: Swap the eligibility check**

In `spaces.tsx`, replace the local `canAddSpace` expression (`:23-24`) with the shared rule, and do the same at `PropertyDetailHeader.tsx:196`:

```tsx
const canAddSpace = listing ? canAddSpaces(listing) : false;
```

Import `canAddSpaces` from `#/data/dealShape` in both files. Note this changes the Spaces **tab's** visibility condition too, which is correct: a shell past Active should not be offering to add spaces. The sidebar's own `spaces` filter is handled in Task 9.

- [ ] **Step 2: Replace the row list with the availability rollup**

Replace the `children.map(...)` block (`spaces.tsx:73-93`) with rows built from `buildingAvailability`:

```tsx
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => {
            const child = getListing(row.dealId);
            const unit = property?.units.find((u) => u.id === row.unitId);
            if (!child || !unit || !property) return null;
            const terms =
              child.marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(row.unitId);
            return (
              <Collapsible key={row.dealId} className="border rounded">
                <div className="d-flex align-items-center justify-content-between gap-3 p-3">
                  <Collapsible.Trigger className="d-flex align-items-center gap-2 border-0 bg-transparent p-0 fw-semibold text-body">
                    <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
                    {unit.label}
                    <span className="text-muted fw-normal">
                      {row.sqft.toLocaleString()} SF
                    </span>
                  </Collapsible.Trigger>
                  <span className="d-flex align-items-center gap-3">
                    <span className="text-muted">
                      {row.leaseRate != null
                        ? `$${row.leaseRate} ${row.leaseRateUnits}`
                        : "Rate TBD"}
                    </span>
                    <span className="text-muted">{row.availability}</span>
                    <DealStageBadge stage={child.status} shape="space" />
                    <Link
                      to="/listings/$listingId"
                      params={{ listingId: row.dealId }}
                      className="text-decoration-none"
                    >
                      Open deal
                    </Link>
                  </span>
                </div>
                <Collapsible.Content className="border-top p-3">
                  <SpaceTermsSection
                    bare
                    unit={unit}
                    property={property}
                    terms={terms}
                    onChange={(patch) =>
                      updateDealMarketing(row.dealId, {
                        spaceLeaseTerms: [{ ...terms, ...patch }],
                      })
                    }
                  />
                </Collapsible.Content>
              </Collapsible>
            );
          })}
        </div>
```

Above the return, add:

```tsx
  const rows = buildingAvailability(listingId);
  const property = listing ? getProperty(listing.propertyId) : undefined;
```

Replace the `children.length === 0` condition with `rows.length === 0`, and drop the now-unused `getChildDeals` import. Add imports: `Collapsible` from `@buildoutinc/blueprint-react/ui/Collapsible`, `buildingAvailability` from `#/data/buildingAvailability`, `SpaceTermsSection`, `updateDealMarketing` from `#/data/actions`, `emptySpaceLeaseTerms` from `#/data/createListing`, `getProperty` from `#/data/store`, `canAddSpaces` from `#/data/dealShape`.

`DealStageBadge`'s `shape` prop arrives in Task 10 — until then, omit it and add it when Task 10 lands.

- [ ] **Step 3: Correct the empty-state copy**

The current text says a space "inherits this deal's marketing template" (`spaces.tsx:62-63`), which is no longer true. Replace with:

```tsx
            Add a space to spin an individual unit into its own deal. The
            building&apos;s marketing is shared by every space.
```

- [ ] **Step 4: Verify and commit**

```bash
bunx tsc --noEmit && bunx vitest run
git add src/routes/_shell/listings/\$listingId/spaces.tsx src/components/properties/PropertyDetailHeader.tsx
git commit -m "feat(lease): make the Spaces tab the space manager with inline terms editing"
```

---

## Task 9: Shape-aware navigation and financial suppression

**Files:**
- Modify: `src/components/properties/PropertyDetailSidebar.tsx:38-129`
- Modify: `src/components/deals/DealMarketingEditor.tsx:659,714`

**Interfaces:**
- Consumes: `dealShape` from `#/data/dealShape`.
- Produces: no new exports.

- [ ] **Step 1: Make the sidebar groups shape-aware**

In `PropertyDetailSidebar.tsx`, add `"property-marketing"` to the Marketing group's items (label `Property Marketing`, icon `faBuildingFlag` from `@fortawesome/pro-regular-svg-icons`), then replace the `navGroups` filter (`:122-129`) with a shape-driven rule:

```tsx
  const shape = listing ? dealShape(listing) : "sale";

  /** Property-level marketing surfaces — a space deal has none of these. */
  const PROPERTY_ONLY = new Set([
    "documents", "website", "email", "demographics", "grids", "plans",
  ]);
  /** Surfaces that only make sense on the building's own assignment. */
  const SHELL_ONLY = new Set(["spaces", "underwriting", "client-report"]);

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "property-marketing") return shape === "space";
      if (shape === "space") {
        if (PROPERTY_ONLY.has(item.href)) return false;
        if (SHELL_ONLY.has(item.href)) return false;
        return true;
      }
      // Money is earned per space, so a shell has no voucher and no invoices.
      if (shape === "shell" && (item.href === "financials" || item.href === "financial-documents")) {
        return false;
      }
      if (item.href === "spaces") return canAddSpaces(listing!) || shape === "shell";
      if (item.href === "underwriting") return showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
```

Import `dealShape` and `canAddSpaces` from `#/data/dealShape`. The trailing `.filter` prevents an empty Back Office group rendering a bare collapsible header on a shell — Back Office still holds `Notes`, so it will not trigger, but the guard is cheap and correct.

- [ ] **Step 2: Suppress the shell's money sections in the edit shell**

In `DealMarketingEditor.tsx`, wrap the `Transaction Terms` section (`:659`) and the `Financials` section (`:714`) — together with the `<Separator />` that precedes each — in a shape check:

```tsx
{dealShape(listing) !== "shell" && (
  <>
    <Separator />
    <Section title="Transaction Terms" icon={faFileContract}>
      {/* ...unchanged... */}
    </Section>
    <Separator />
    <Section title="Financials" icon={faChartLine}>
      {/* ...unchanged... */}
    </Section>
  </>
)}
```

Import `dealShape` from `#/data/dealShape`.

- [ ] **Step 3: Verify and commit**

```bash
bunx tsc --noEmit && bunx vitest run
git add src/components/properties/PropertyDetailSidebar.tsx src/components/deals/DealMarketingEditor.tsx
git commit -m "feat(lease): scope nav by deal shape and strip money surfaces from a shell"
```

- [ ] **Step 4: Ask the user to verify in-app**

State plainly: a lease deal with no spaces must look exactly as it does today; adding one space must remove Voucher, Invoices, Transaction Terms, and Financials from the parent, and deleting the last child must bring them back.

---

## Task 10: Contextual stage labels and offered stages

**Files:**
- Modify: `src/components/properties/PropertyDetailHeader.tsx:174,179,190`
- Modify: `src/components/deals/DealStageBadge.tsx:22`, `src/components/deals/DealStageChip.tsx:71,84`, `src/components/deals/NewDealStageChip.tsx:35,42,58`, `src/components/deals/DealMarketingEditor.tsx:620-621`

**Interfaces:**
- Consumes: `dealStageLabel`, `availableStages`, `dealShape` from `#/data/dealShape`.
- Produces: no new exports.

`STATUS_LABELS` itself stays a flat `Record` — roughly 25 call sites use it, and most describe a **property**, not a deal. Only deal-facing sites become shape-aware. Board columns (`DealBoardColumn.tsx`) and global filters (`listings/index.tsx`, `properties/index.tsx`) are cross-deal and keep the generic labels.

- [ ] **Step 1: Stage select on the deal header**

In `PropertyDetailHeader.tsx`, compute `const shape = dealShape(listing);` and replace:
- `:174` → `{(v) => dealStageLabel(v as ListingStage, shape)}`
- `:179` → `{availableStages(shape).map((s) => (`
- `:190` → `{dealStageLabel(s, shape)}`

- [ ] **Step 2: Badges and chips**

`DealStageBadge`, `DealStageChip`, and `NewDealStageChip` each render a stage for a specific deal. Add an optional `shape?: DealShape` prop to each, defaulting to `'sale'`, and use `dealStageLabel(value, shape)` in place of `STATUS_LABELS[value]`. Where a chip renders a list of selectable stages (`DealStageChip.tsx:84`, `NewDealStageChip.tsx:58`), iterate `availableStages(shape)` instead of `PROPERTY_STATUSES`.

Then pass `shape={dealShape(child)}` from `spaces.tsx` (the space rows) and `shape={dealShape(listing)}` from any deal-detail caller. Callers that do not pass it keep today's labels.

- [ ] **Step 3: Status select in the edit shell**

In `DealMarketingEditor.tsx:620-621`, replace `options={PROPERTY_STATUSES}` with `options={availableStages(dealShape(listing))}` and `labels={STATUS_LABELS}` with a shape-aware map built inline:

```tsx
labels={Object.fromEntries(
  availableStages(dealShape(listing)).map((s) => [s, dealStageLabel(s, dealShape(listing))]),
)}
```

- [ ] **Step 4: Verify and commit**

```bash
bunx tsc --noEmit && bunx vitest run
git add src/components/properties/PropertyDetailHeader.tsx src/components/deals/DealStageBadge.tsx src/components/deals/DealStageChip.tsx src/components/deals/NewDealStageChip.tsx src/components/deals/DealMarketingEditor.tsx src/routes/_shell/listings/\$listingId/spaces.tsx
git commit -m "feat(lease): label proposal as Draft on space deals and cap the shell's ladder"
```

---

## Task 11: Property Marketing hub and the return bar

**Files:**
- Create: `src/components/deals/PropertyMarketingHub.tsx`
- Create: `src/components/deals/MarketingScopeBar.tsx`
- Create: `src/routes/_shell/listings/$listingId/property-marketing.tsx`
- Modify: `src/routes/_shell/listings/$listingId.tsx` (render the scope bar above the `Outlet`)

**Interfaces:**
- Consumes: `getListing`, `getProperty` from `#/data/store`; `getChildDeals` from `#/data/leaseSpaces`; `spaceAvailability`, `dealStageLabel`, `dealShape` from `#/data/dealShape`.
- Produces:
  - `export function PropertyMarketingHub({ listing }: { listing: Listing }): JSX.Element`
  - `export function MarketingScopeBar(): JSX.Element | null`

- [ ] **Step 1: The hub**

Create `PropertyMarketingHub.tsx`. It is **read-only** — no inputs anywhere on the page.

```tsx
import { Link } from "@tanstack/react-router";
import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import {
  faFileLines, faGlobe, faEnvelope, faMapLocationDot,
  faTableCells, faRulerCombined, faArrowUpRightFromSquare,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { getListing, getProperty } from "#/data/store";
import { getChildDeals } from "#/data/leaseSpaces";
import { spaceAvailability } from "#/data/dealShape";
import type { Listing } from "#/data/types";

/** The six surfaces that exist only on the building. Same order as the sidebar. */
const SHARED: { label: string; href: string; icon: IconDefinition }[] = [
  { label: "Documents", href: "documents", icon: faFileLines },
  { label: "Website", href: "website", icon: faGlobe },
  { label: "Email", href: "email", icon: faEnvelope },
  { label: "Demographics", href: "demographics", icon: faMapLocationDot },
  { label: "Grids", href: "grids", icon: faTableCells },
  { label: "Plans", href: "plans", icon: faRulerCombined },
];

export function PropertyMarketingHub({ listing }: { listing: Listing }) {
  const shellId = listing.parentDealId;
  const shell = shellId ? getListing(shellId) : undefined;
  const property = getProperty(listing.propertyId);
  if (!shellId || !shell || !property) return null;

  const spaceCount = getChildDeals(shellId).length;
  const terms = listing.marketing.spaceLeaseTerms?.[0];
  const unit = property.units.find((u) => u.id === listing.unitId);

  const facts: [string, string][] = [
    ["Lease rate", terms?.leaseRate != null ? `$${terms.leaseRate} ${terms.leaseRateUnits}` : "—"],
    ["Available", listing.marketing.availableSqFt ? `${listing.marketing.availableSqFt.toLocaleString()} SF` : "—"],
    ["Term", terms?.leaseTermMonths != null ? `${terms.leaseTermMonths} months` : "—"],
    ["Availability", spaceAvailability(listing.status)],
  ];

  return (
    <div className="p-4 d-flex flex-column gap-4">
      <Alert severity="info" withIcon>
        <FontAwesomeIcon icon={faCircleInfo} />
        <Alert.Title>Marketing lives on the building</Alert.Title>
        Marketing for {property.name} is shared across all {spaceCount}{" "}
        {spaceCount === 1 ? "space" : "spaces"}. Changes affect every space.
      </Alert>

      <section>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h2 className="fs-6 fw-semibold mb-0">
            How {unit?.label ?? "this space"} appears
          </h2>
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link to="/listings/$listingId/edit" params={{ listingId: listing.id }} />}
          >
            Edit space terms
          </Button>
        </div>
        <dl className="row mb-0">
          {facts.map(([label, value]) => (
            <div key={label} className="col-6 col-md-3 mb-2">
              <dt className="text-muted fw-normal">{label}</dt>
              <dd className="fw-semibold mb-0">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="fs-6 fw-semibold mb-2">Shared property marketing</h2>
        <div className="d-flex flex-column gap-1">
          {SHARED.map((s) => (
            <Link
              key={s.href}
              to={`/listings/${shellId}/${s.href}`}
              search={{ from: listing.id }}
              className="d-flex align-items-center justify-content-between gap-3 border rounded p-3 text-decoration-none text-body"
            >
              <span className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={s.icon} className="text-muted" />
                {s.label}
              </span>
              <span className="text-muted d-flex align-items-center gap-2">
                Open <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
```

No last-updated stamps: these records carry no timestamp today, and inventing one would put fake data on the page.

- [ ] **Step 2: The return bar**

Create `MarketingScopeBar.tsx`:

```tsx
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { getListing, getProperty } from "#/data/store";
import { getChildDeals } from "#/data/leaseSpaces";

/**
 * Shown on a shell's marketing tabs when the broker arrived from one of its
 * spaces. Renders nothing otherwise, so it is safe to mount unconditionally.
 */
export function MarketingScopeBar() {
  const { listingId } = useParams({ from: "/_shell/listings/$listingId" });
  // Loose read: most routes under this layout declare no `from` param at all.
  const search = useSearch({ strict: false }) as { from?: string };
  const from = search.from;
  if (!from) return null;

  const child = getListing(from);
  if (!child || child.parentDealId !== listingId) return null;

  const property = getProperty(child.propertyId);
  const unit = property?.units.find((u) => u.id === child.unitId);
  const spaceCount = getChildDeals(listingId).length;

  return (
    <div className="d-flex align-items-center justify-content-between gap-3 border-bottom px-4 py-2">
      <span className="text-muted">
        Property marketing · shared by {spaceCount}{" "}
        {spaceCount === 1 ? "space" : "spaces"}
      </span>
      <Link
        to="/listings/$listingId/property-marketing"
        params={{ listingId: from }}
        className="d-flex align-items-center gap-2 text-decoration-none"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
        Back to {unit?.label ?? "the space"}
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: The route and the search param**

Create `property-marketing.tsx` mirroring the shape of `spaces.tsx` — `createFileRoute`, reactive `useDataStore` selector, render `<PropertyMarketingHub listing={listing} />`, and an `Empty` state when the listing is not a space deal.

The `from` param must be declared on every shell marketing route that can receive it (`documents`, `website`, `email`, `demographics`, `grids`, `plans`). Add to each:

```ts
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === "string" && search.from ? { from: search.from } : {},
```

`email.tsx` and `leads.tsx` already declare a `q` param — extend their existing return type rather than replacing it.

- [ ] **Step 4: Mount the bar and preserve the param across tabs**

In `$listingId.tsx`, render `<MarketingScopeBar />` directly above the `<Outlet />` inside the content `Card`.

In `PropertyDetailSidebar.tsx`'s `handleTabChange`, carry the param when moving between Marketing-group items on a shell, and drop it otherwise:

```tsx
    const inMarketing = navGroups.find((g) => g.label === "Marketing")?.items.some((i) => i.href === item.href);
    void navigate({
      to: `/listings/${listingId}/${item.href}`,
      search: inMarketing && from ? { from } : {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
```

Read `from` with `useSearch({ strict: false })`.

- [ ] **Step 5: Verify**

Run: `bunx tsc --noEmit && bunx vitest run && bun --bun run build`
Expected: clean. The build regenerates `routeTree.gen.ts` with the new route — commit that regeneration, but never hand-edit it.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/deals src/routes
git commit -m "feat(lease): add the Property Marketing hub and its return-context bar"
```

- [ ] **Step 7: Ask the user to verify in-app**

From a space deal: open Property Marketing, jump to the shell's Documents, hop to Website, confirm the "← Back to …" bar survives the hop and disappears on any non-marketing tab.

---

## Task 12: Unit-filtered Media and Leads

**Files:**
- Modify: `src/data/types.ts:120-124` (`VisualMediaLink`), and the property lead record
- Modify: `src/components/listings/edit/sections/VisualMediaSection.tsx`
- Modify: `src/components/properties/PropertyDetailLeads.tsx`
- Test: `src/data/unitScopedMarketing.test.ts` (create)

**Interfaces:**
- Consumes: `dealShape` from `#/data/dealShape`.
- Produces:
  - `VisualMediaLink.unitId: string | null`
  - `function mediaForUnit(links: VisualMediaLink[], unitId: string | null): VisualMediaLink[]`
  - `function leadsForUnit<T extends { unitId: string | null }>(leads: T[], unitId: string | null): T[]` — generic, because the lead row type is declared locally in `PropertyDetailLeads.tsx:62` and is not exported
  - Both exported from a new `src/data/unitScopedMarketing.ts`.

Media and Leads are the only two surfaces that survive on a space deal as *filtered views of the property's library*. There is exactly one store; the space renders a subset.

- [ ] **Step 1: Add the unit dimension to the types**

In `src/data/types.ts`, add to `VisualMediaLink`:
```ts
  /** The space this asset depicts, when it depicts one. Null = whole building. */
  unitId: string | null
```
Locate the lead record consumed by `getLeadsForProperty` (grep for its definition in `src/data/`) and add the same field with the comment *"The space deal this inquiry arrived on, when known."*

Run `bunx tsc --noEmit` and add `unitId: null` to every literal the compiler flags, including seed data.

- [ ] **Step 2: Write the failing test**

Create `src/data/unitScopedMarketing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mediaForUnit, leadsForUnit } from './unitScopedMarketing'

const links = [
  { id: 'a', url: 'http://x/1', mediaType: 'photo', unitId: null },
  { id: 'b', url: 'http://x/2', mediaType: 'photo', unitId: 'u1' },
  { id: 'c', url: 'http://x/3', mediaType: 'photo', unitId: 'u2' },
] as never[]

describe('mediaForUnit', () => {
  it('returns the whole library when no unit is given', () => {
    expect(mediaForUnit(links, null)).toHaveLength(3)
  })

  it('returns a unit its own assets plus the building-wide ones', () => {
    expect(mediaForUnit(links, 'u1').map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('leadsForUnit', () => {
  const leads = [{ id: '1', unitId: null }, { id: '2', unitId: 'u1' }] as never[]

  it('returns every lead when no unit is given', () => {
    expect(leadsForUnit(leads, null)).toHaveLength(2)
  })

  it('returns only that unit inquiries when one is given', () => {
    expect(leadsForUnit(leads, 'u1').map((l) => l.id)).toEqual(['2'])
  })
})
```

Note the deliberate asymmetry: **media** falls back to building-wide assets because a suite with no photos of its own should still show the building's; **leads** do not, because an inquiry about the building is not an inquiry about Suite 200.

- [ ] **Step 3: Run it**

Run: `bunx vitest run src/data/unitScopedMarketing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/data/unitScopedMarketing.ts`:

```ts
import type { VisualMediaLink } from './types'

/**
 * A space shows its own assets plus the building-wide ones — a suite with no
 * photos of its own should still show the building's.
 */
export function mediaForUnit(
  links: VisualMediaLink[],
  unitId: string | null,
): VisualMediaLink[] {
  if (!unitId) return links
  return links.filter((l) => l.unitId === unitId || l.unitId == null)
}

/**
 * Leads do NOT fall back: an inquiry about the building is not an inquiry about
 * Suite 200, and showing it as one would misattribute the broker's pipeline.
 */
export function leadsForUnit<T extends { unitId: string | null }>(
  leads: T[],
  unitId: string | null,
): T[] {
  if (!unitId) return leads
  return leads.filter((l) => l.unitId === unitId)
}
```

- [ ] **Step 5: Run it**

Run: `bunx vitest run src/data/unitScopedMarketing.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Apply the filters in the two views**

In `PropertyDetailLeads.tsx`, accept an optional `unitId?: string | null` prop and wrap the `getLeadsForProperty(property.id).map(toLead)` result in `leadsForUnit(..., unitId ?? null)`. Pass `listing.unitId` from `leads.tsx` when the listing is a space deal.

In `VisualMediaSection.tsx`, accept the same optional `unitId` prop, filter the rendered list with `mediaForUnit`, and stamp `unitId` onto any link the section creates while scoped to a unit.

Add an `Alert` (severity `info`, `pro-duotone` icon) at the top of each when scoped: *"Showing {n} of {total} — filtered to this space. The full library lives on the building."*

- [ ] **Step 7: Verify and commit**

```bash
bunx tsc --noEmit && bunx vitest run
git add -A src/data src/components
git commit -m "feat(lease): filter Media and Leads to a space deal's unit"
```

- [ ] **Step 8: Ask the user to verify in-app**

Media and Leads on a space deal show the filtered view with the scope alert; on the shell they show the full library with no alert.

---

## Final verification

- [ ] Run the full gate: `bunx tsc --noEmit && bunx vitest run && bun --bun run build`
- [ ] Confirm `grep -rn "resyncChildFromParent\|LeaseSpacesSection\|applyTemplate" src` returns nothing.
- [ ] Hand the user the spec's manual checklist: create a lease deal → win to Active → add three spaces → the shell loses Voucher/Invoices/Transaction Terms/Financials and offers only Pitching/Active/Lost → price one space from the Spaces tab and from its own edit form, confirming both write the same record → Draft → Active it and confirm it enters the availability table → move it to Under Contract and confirm the table follows → from that space, open Property Marketing, jump to Documents, hop to Website, confirm the return bar survives.
