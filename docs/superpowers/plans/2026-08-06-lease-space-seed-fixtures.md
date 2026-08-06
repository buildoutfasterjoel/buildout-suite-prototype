# Lease-with-Spaces Seed Fixtures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seed two existing lease deals as umbrella shells with 7 child space deals, so the Spaces tab, availability table, Vouchers index, and space-card surfaces have data on first load.

**Architecture:** One new hand-authored, `faker`-free pass (`src/data/leaseSpaceFixtures.ts`) invoked from `generateDataset()` right after `applyHeroes(...)`. It re-slices two seeded properties into more suites, then splits their lease deals into shell + child space deals following `addSpaceToDeal()` semantics exactly. No workflow code changes — fixture data only.

**Tech Stack:** TypeScript, Vitest, `@faker-js/faker` (deliberately *not* used in the new module).

## Global Constraints

- **Zero `faker` calls in `leaseSpaceFixtures.ts`.** `generateDataset()` makes further faker draws after the insertion point (inquiry details, comps, demo property). Any draw here shifts that sequence and breaks `seed.test.ts`, `seed.rosaHero.test.ts`, `seed.delgado.test.ts`.
- **No `crypto.randomUUID()` in the new module.** Use deterministic ids: `space-107-300`, `unit-107-300`, `rent-107-300`.
- **No imports from `./createListing` or `#/components/**`.** `seed.ts` is loaded at module init from `dataStore.ts`; `createListing.ts` imports `store.ts` → `dataStore.ts` → `seed.ts` and would close the cycle (documented at `src/data/seed.ts:2078`). Replicate the small amount of needed logic inline.
- **Never throw.** `generateDataset()` runs at module load. If a shell lookup misses or fails its expected shape, no-op that shell. Tests enforce the invariant instead.
- **Shell deal ids are `'107'` (Meridian Business Park) and `'104'` (Patriot Commerce Park)**, matched on `Listing.dealId`.
- Package manager is Bun. Test command: `bun --bun run test`. Type-check: `bunx tsc --noEmit` (`vite build` does NOT type-check).
- A `react`/`module is not defined` line on Vitest stderr is a pre-existing non-gate — ignore it. Judge by the pass/fail summary.

---

## File Structure

**Create:**
- `src/data/leaseSpaceFixtures.ts` — the whole pass. Shell specs, unit re-slicing, child construction, stage detail. One responsibility: turn two seeded lease deals into shells with children.
- `src/data/leaseSpaceFixtures.test.ts` — invariants for the fixture.

**Modify:**
- `src/data/seed.ts` — one import, one call after `applyHeroes(...)` (around line 2007).

---

### Task 1: Shell preparation — re-slice units, rebuild rent roll, fix deal side

Prepares the two properties and their lease deals so they *can* be split. No children yet: after this task both deals are still flat leases, but with more suites and a terms row per suite, so the intermediate state is coherent.

**Files:**
- Create: `src/data/leaseSpaceFixtures.ts`
- Create: `src/data/leaseSpaceFixtures.test.ts`
- Modify: `src/data/seed.ts` (import + call site after `applyHeroes`)

**Interfaces:**
- Consumes: `Listing`, `Property`, `PropertyUnit`, `Contact`, `PropertyStatus`, `SpaceLeaseTerms`, `RentRollRow` from `./types`.
- Produces:
  - `export function applyLeaseSpaces(listings: Listing[], properties: Property[], contacts: Contact[], dealIdRef: { n: number }): void`
  - `export const SHELL_SPECS: ShellSpec[]` where `interface ShellSpec { dealId: string; suiteProportions: number[]; childStages: PropertyStatus[] }`

- [ ] **Step 1: Write the failing test**

Create `src/data/leaseSpaceFixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getProperty, getStore } from './store'
import { SHELL_SPECS } from './leaseSpaceFixtures'

/**
 * Read through the live store, not a fresh `generateDataset()` call. The Zustand
 * store self-seeds at import (`dataStore.ts:145`), so this is the same data the
 * app sees — and it is what the derived selectors below read anyway.
 */
function shellFor(dealId: string) {
  const shell = [...getStore().listings.values()].find((l) => l.dealId === dealId)
  if (!shell) throw new Error(`no seeded deal ${dealId}`)
  const property = getProperty(shell.propertyId)
  if (!property) throw new Error(`no property for deal ${dealId}`)
  return { shell, property }
}

describe('shell preparation', () => {
  it('re-slices each shell property into one suite per child stage', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      expect(property.units).toHaveLength(spec.childStages.length)
    }
  })

  it('keeps the suites summing to the building', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      const total = property.units.reduce((sum, u) => sum + u.sqft, 0)
      expect(total).toBe(property.buildingSqFt)
    }
  })

  it('leaves every rent roll row pointing at a live unit', () => {
    for (const spec of SHELL_SPECS) {
      const { shell, property } = shellFor(spec.dealId)
      const unitIds = new Set(property.units.map((u) => u.id))
      for (const row of shell.financials.rentRoll) {
        expect(unitIds.has(row.unitId ?? '')).toBe(true)
      }
    }
  })

  it('gives every suite its own lease terms row', () => {
    for (const spec of SHELL_SPECS) {
      const { shell, property } = shellFor(spec.dealId)
      const termUnitIds = (shell.marketing.spaceLeaseTerms ?? []).map((t) => t.unitId).sort()
      expect(termUnitIds).toEqual(property.units.map((u) => u.id).sort())
    }
  })

  it('puts both shells on the landlord side so spaces can be added', () => {
    for (const spec of SHELL_SPECS) {
      const { shell } = shellFor(spec.dealId)
      expect(shell.dealType).toBe('Lease')
      expect(shell.dealSide).toBe('seller')
      expect(shell.buyerContactIds).toEqual([])
    }
  })

  it('never puts a shell on residential units', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      for (const unit of property.units) {
        expect(unit.unitType).not.toBe('residential')
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: FAIL — `Failed to resolve import "./leaseSpaceFixtures"`.

- [ ] **Step 3: Write the implementation**

Create `src/data/leaseSpaceFixtures.ts`:

```ts
import type {
  Contact,
  Listing,
  Property,
  PropertyStatus,
  PropertyUnit,
  RentRollRow,
  SpaceLeaseTerms,
} from './types'

/**
 * A seeded lease deal to turn into an umbrella shell, and the suites to split it
 * across. `childStages` is the whole point: one entry per suite, in order, giving
 * the availability table a row in each state a broker actually sees.
 *
 * `suiteProportions` holds one fewer entry than `childStages` — the final suite
 * takes the remainder, so the suites always sum back to `buildingSqFt` no matter
 * what the seed produced.
 */
export interface ShellSpec {
  dealId: string
  suiteProportions: number[]
  childStages: PropertyStatus[]
}

export const SHELL_SPECS: ShellSpec[] = [
  // Meridian Business Park — an active office building mid-lease-up. One suite in
  // each of the four states `spaceAvailability` can report.
  {
    dealId: '107',
    suiteProportions: [0.32, 0.25, 0.23],
    childStages: ['closed', 'under-contract', 'active', 'proposal'],
  },
  // Patriot Commerce Park — just split, nothing marketed yet. Every suite reads
  // "Not advertised", which is what a broker sees the moment they break a
  // building out.
  {
    dealId: '104',
    suiteProportions: [0.4, 0.33],
    childStages: ['proposal', 'proposal', 'proposal'],
  },
]

/** Suite sqft per unit index: proportions of the building, last one taking the remainder. */
function suiteSizes(buildingSqFt: number, proportions: number[]): number[] {
  const sizes = proportions.map((p) => Math.round(buildingSqFt * p))
  sizes.push(buildingSqFt - sizes.reduce((sum, n) => sum + n, 0))
  return sizes
}

/**
 * Re-slice a property into `sizes.length` suites. Existing unit objects are
 * resized in place rather than replaced: their ids are already referenced by
 * `financials.rentRoll[].unitId`, and swapping the array would leave those rows
 * dangling. Suites beyond the seeded ones are appended.
 */
function resliceUnits(property: Property, spec: ShellSpec, sizes: number[]): void {
  const template = property.units[0]
  const units: PropertyUnit[] = []

  for (let i = 0; i < sizes.length; i += 1) {
    const suiteNumber = (i + 1) * 100
    const existing = property.units[i]
    if (existing) {
      existing.sqft = sizes[i]
      units.push(existing)
      continue
    }
    units.push({
      id: `unit-${spec.dealId}-${suiteNumber}`,
      label: `Suite ${suiteNumber}`,
      unitType: template?.unitType ?? 'office',
      sqft: sizes[i],
      beds: null,
      baths: null,
      suite: String(suiteNumber),
      floor: i + 1,
      ceilingHeight: template?.ceilingHeight ?? 12,
      offices: template?.offices ?? 2,
      conferenceRooms: template?.conferenceRooms ?? 1,
      furnished: false,
      saleHistory: [],
    })
  }

  property.units = units
}

/**
 * Rebuild the shell's rent roll from the resized suites, so rent and rent-per-sf
 * stay consistent with the new sizes. Each row keeps its seeded tenant and dates
 * where one existed; new suites take a fixed name from the pool.
 */
const FIXTURE_TENANTS = ['Northline Logistics', 'Vertex Systems', 'Harbor & Co.', 'Ridgeway Dental']

function rebuildRentRoll(shell: Listing, property: Property, spec: ShellSpec): void {
  const original = shell.financials.rentRoll
  const ratePerSf = original[0]?.rentPerSf && original[0].rentPerSf > 0 ? original[0].rentPerSf : 2

  shell.financials.rentRoll = property.units.map((unit, i): RentRollRow => {
    const prior = original[i]
    const actualRent = Math.round(unit.sqft * ratePerSf)
    return {
      id: `rent-${spec.dealId}-${unit.id}`,
      unitId: unit.id,
      tenant: prior?.tenant ?? FIXTURE_TENANTS[i % FIXTURE_TENANTS.length],
      actualRent,
      marketRent: Math.round(actualRent * 1.08),
      rentPerSf: ratePerSf,
      securityDeposit: actualRent,
      leaseStart: prior?.leaseStart ?? isoDate(-540),
      leaseEnd: prior?.leaseEnd ?? isoDate(540),
    }
  })
}

/** `YYYY-MM-DD`, `days` from today (negative = past). Mirrors how the hero pass handles time. */
export function isoDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Lease terms for a suite that has none yet, cloned from a sibling row so the
 * fixture inherits realistic seeded values rather than a blank record. Mirrors
 * `spaceTermsFromUnit` in createListing.ts, which cannot be imported here without
 * closing the store → dataStore → seed cycle.
 */
function termsForUnit(template: SpaceLeaseTerms, unit: PropertyUnit): SpaceLeaseTerms {
  return {
    ...template,
    unitId: unit.id,
    spaceName: unit.label,
    suite: unit.suite ?? undefined,
    floor: unit.floor,
    ceilingHeight: unit.ceilingHeight,
    offices: unit.offices,
    conferenceRooms: unit.conferenceRooms,
    minDivisibleSqFt: Math.round(unit.sqft / 2),
    maxContiguousSqFt: unit.sqft,
  }
}

/** Extend the shell's terms so every suite — seeded or newly sliced — has exactly one row. */
function fillTermsForUnits(shell: Listing, property: Property): void {
  const existing = shell.marketing.spaceLeaseTerms ?? []
  const template = existing[0]
  if (!template) return
  shell.marketing.spaceLeaseTerms = property.units.map(
    (unit) => existing.find((t) => t.unitId === unit.id) ?? termsForUnit(template, unit),
  )
}

/**
 * Turn the seeded lease deals named in {@link SHELL_SPECS} into umbrella shells
 * with child space deals.
 *
 * Called from `generateDataset` after `applyHeroes` — by then the heroes have
 * claimed their listings, so the two passes cannot contend for the same deal —
 * and before `reconcileContactDealFields`, so tenants the children take on get
 * reconciled exactly as a live store mutation would.
 *
 * Deliberately takes no `faker` draws: `generateDataset` keeps drawing after this
 * point, and a draw here would shift every downstream value the seed tests pin.
 */
export function applyLeaseSpaces(
  listings: Listing[],
  properties: Property[],
  _contacts: Contact[],
  _dealIdRef: { n: number },
): void {
  for (const spec of SHELL_SPECS) {
    const shell = listings.find((l) => l.dealId === spec.dealId)
    const property = properties.find((p) => p.id === shell?.propertyId)
    // generateDataset runs at module load — a missed lookup must skip, not throw.
    if (!shell || !property || shell.dealType !== 'Lease' || property.units.length === 0) continue

    // A tenant-rep deal does not own a building's spaces, so a shell is always
    // landlord-side. `104` is seeded buyer-side; its (currently empty) buyer
    // contacts move to the landlord side so the flip stays correct either way.
    shell.dealSide = 'seller'
    shell.sellerContactIds = [...shell.sellerContactIds, ...shell.buyerContactIds]
    shell.buyerContactIds = []

    resliceUnits(property, spec, suiteSizes(property.buildingSqFt, spec.suiteProportions))
    rebuildRentRoll(shell, property, spec)
    fillTermsForUnits(shell, property)
  }
}
```

- [ ] **Step 4: Wire it into the seed**

In `src/data/seed.ts`, add to the imports near the other `./` imports:

```ts
import { applyLeaseSpaces } from './leaseSpaceFixtures'
```

Then in `generateDataset()`, immediately after the `applyHeroes(contacts, listings, properties)` call (around line 2007), add:

```ts
  // Turn two seeded lease deals into umbrella shells with child space deals.
  // After applyHeroes so the heroes have already claimed their listings; before
  // reconciliation so the children's tenants get their contact fields resolved.
  applyLeaseSpaces(listings, properties, contacts, dealIdRef)
```

- [ ] **Step 5: Run the tests**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run the seed regression tests**

Run: `bun --bun run test -- src/data/seed.test.ts src/data/seed.rosaHero.test.ts src/data/seed.delgado.test.ts`
Expected: PASS, unchanged. **If any fail, a `faker` draw leaked into the new module — find and remove it rather than updating the assertions.**

- [ ] **Step 7: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/data/leaseSpaceFixtures.ts src/data/leaseSpaceFixtures.test.ts src/data/seed.ts
git commit -m "feat(seed): re-slice the two shell-candidate lease properties into suites"
```

---

### Task 2: Split the shells into child space deals

Creates the children and moves the terms down onto them, following `addSpaceToDeal()` semantics so the seeded state is indistinguishable from one built by clicking Add Space.

**Files:**
- Modify: `src/data/leaseSpaceFixtures.ts`
- Modify: `src/data/leaseSpaceFixtures.test.ts`

**Interfaces:**
- Consumes: `applyLeaseSpaces`, `SHELL_SPECS`, `isoDate` from Task 1.
- Produces: child `Listing` records appended to the `listings` array, each with `parentDealId` set to its shell's `id` and `unitId` set to its suite. Ids are `space-<shellDealId>-<suiteNumber>`, e.g. `space-107-300`.

- [ ] **Step 1: Write the failing test**

Append to `src/data/leaseSpaceFixtures.test.ts`:

```ts
import { buildingAvailability } from './buildingAvailability'
import { canAddSpaces, dealShape } from './dealShape'
import { getChildDeals } from './leaseSpaces'

function childrenOf(dealId: string) {
  return getChildDeals(shellFor(dealId).shell.id)
}

describe('splitting shells into spaces', () => {
  it('creates one child per declared stage', () => {
    for (const spec of SHELL_SPECS) {
      expect(childrenOf(spec.dealId)).toHaveLength(spec.childStages.length)
    }
  })

  it('leaves the shell holding no space terms of its own', () => {
    for (const spec of SHELL_SPECS) {
      const { shell } = shellFor(spec.dealId)
      expect(shell.marketing.spaceLeaseTerms).toEqual([])
      expect(shell.unitId).toBeNull()
    }
  })

  it('gives each child exactly one terms row, for its own unit', () => {
    for (const spec of SHELL_SPECS) {
      for (const child of childrenOf(spec.dealId)) {
        const terms = child.marketing.spaceLeaseTerms ?? []
        expect(terms).toHaveLength(1)
        expect(terms[0].unitId).toBe(child.unitId)
      }
    }
  })

  it('points every child at a real unit on its parent property', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      const unitIds = new Set(property.units.map((u) => u.id))
      for (const child of childrenOf(spec.dealId)) {
        expect(unitIds.has(child.unitId ?? '')).toBe(true)
      }
    }
  })

  it('sizes each child to its own suite', () => {
    for (const spec of SHELL_SPECS) {
      const { property } = shellFor(spec.dealId)
      for (const child of childrenOf(spec.dealId)) {
        const unit = property.units.find((u) => u.id === child.unitId)
        expect(child.marketing.availableSqFt).toBe(unit?.sqft)
      }
    }
  })

  it('assigns each child a unique deal id continuing the seed counter', () => {
    const ids = [...getStore().listings.values()].map((l) => l.dealId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('derived surfaces', () => {
  it('reads the shells as shells and the children as spaces', () => {
    for (const spec of SHELL_SPECS) {
      const { shell } = shellFor(spec.dealId)
      expect(dealShape(shell)).toBe('shell')
      expect(canAddSpaces(shell)).toBe(true)
      for (const child of childrenOf(spec.dealId)) {
        expect(dealShape(child)).toBe('space')
      }
    }
  })

  it('shows every availability state on the active building', () => {
    const { shell } = shellFor('107')
    const states = buildingAvailability(shell.id).map((r) => r.availability)
    expect(new Set(states)).toEqual(
      new Set(['Leased', 'Under Contract', 'Available', 'Not advertised']),
    )
  })

  it('advertises nothing on the just-split building', () => {
    const { shell } = shellFor('104')
    const rows = buildingAvailability(shell.id)
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.advertised)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: FAIL — "creates one child per declared stage" gets 0, and the shell still holds terms.

- [ ] **Step 3: Write the implementation**

In `src/data/leaseSpaceFixtures.ts`, add the child builder above `applyLeaseSpaces`:

```ts
/**
 * A child space deal for one suite. Matches `addSpaceToDeal` field for field —
 * inherited marketing, own pipeline state, one terms row — so a seeded space and
 * a clicked-through one are the same record.
 */
function buildChild(
  shell: Listing,
  unit: PropertyUnit,
  terms: SpaceLeaseTerms,
  stage: PropertyStatus,
  index: number,
  spec: ShellSpec,
  dealIdRef: { n: number },
): Listing {
  const suiteNumber = (index + 1) * 100
  const createdAt = isoTimestamp(-120)
  return {
    ...shell,
    id: `space-${spec.dealId}-${suiteNumber}`,
    dealId: String(dealIdRef.n++),
    parentDealId: shell.id,
    unitId: unit.id,
    name: `${shell.name} — ${unit.label}`,
    slug: `${shell.slug}-space-${index + 1}`,
    status: stage,
    publishedAt: null,
    // Own pipeline state — a space does not inherit the shell's parties or history.
    sellerContactIds: [...shell.sellerContactIds],
    buyerContactIds: [],
    tenantContactIds: [],
    otherContactIds: [],
    tasks: [],
    messages: [],
    activities: [],
    history: [
      {
        id: `hist-${spec.dealId}-${suiteNumber}-created`,
        label: 'Created under',
        fromStage: null,
        toStage: 'proposal',
        actor: 'You (Listing Broker)',
        timestamp: createdAt,
      },
    ],
    documents: [],
    marketing: {
      ...shell.marketing,
      availableSqFt: unit.sqft,
      spaceLeaseTerms: [{ ...terms }],
    },
    transaction: {
      ...shell.transaction,
      commissionAmount: 0,
      contractExecutedDate: null,
      closeDate: null,
      leaseCommencementDate: null,
      nextCriticalDate: null,
      backOffice: { ...shell.transaction.backOffice, receivables: [], closeDate: null },
    },
    createdAt,
    updatedAt: createdAt,
  }
}

/** Full ISO timestamp, `days` from now (negative = past). */
export function isoTimestamp(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString()
}
```

Then replace the body of the `for (const spec of SHELL_SPECS)` loop's tail in `applyLeaseSpaces` — everything from `resliceUnits(...)` onward — with:

```ts
    resliceUnits(property, spec, suiteSizes(property.buildingSqFt, spec.suiteProportions))
    rebuildRentRoll(shell, property, spec)
    fillTermsForUnits(shell, property)

    // Split: each suite's terms row moves down onto its own child deal.
    const termsByUnit = new Map(
      (shell.marketing.spaceLeaseTerms ?? []).map((t) => [t.unitId, t]),
    )
    property.units.forEach((unit, i) => {
      const terms = termsByUnit.get(unit.id)
      if (!terms) return
      listings.push(
        buildChild(shell, unit, terms, spec.childStages[i], i, spec, dealIdRef),
      )
    })

    // The shell holds no space terms and is scoped to no single unit — its spaces
    // own both. This is `addSpaceToDeal`'s "one editable home per unit" rule.
    shell.marketing.spaceLeaseTerms = []
    shell.unitId = null
    shell.transaction.commissionAmount = 0
    shell.transaction.closeDate = null
    shell.transaction.leaseCommencementDate = null
```

Change the `applyLeaseSpaces` signature to use the now-live parameter:

```ts
export function applyLeaseSpaces(
  listings: Listing[],
  properties: Property[],
  _contacts: Contact[],
  dealIdRef: { n: number },
): void {
```

- [ ] **Step 4: Run the tests**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Run the full suite**

Run: `bun --bun run test`
Expected: PASS. The seed regression tests must be unchanged.

- [ ] **Step 6: Type-check**

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add src/data/leaseSpaceFixtures.ts src/data/leaseSpaceFixtures.test.ts
git commit -m "feat(seed): split the two lease shells into child space deals"
```

---

### Task 3: Stage-scaled detail on the children

`addSpaceToDeal` creates children clean — no tenant, no commission, no dates. Correct for a just-clicked space, wrong for one that is supposedly Leased. This gives each child what its stage implies.

**Files:**
- Modify: `src/data/leaseSpaceFixtures.ts`
- Modify: `src/data/leaseSpaceFixtures.test.ts`

**Interfaces:**
- Consumes: `buildChild`, `isoDate`, `isoTimestamp` from Task 2.
- Produces: `export function leaseCommissionAmount(annualRent: number, termMonths: number, escalatorPct: number, commissionPct: number): number`

- [ ] **Step 1: Write the failing test**

Append to `src/data/leaseSpaceFixtures.test.ts`:

```ts
import { buildRentSchedule } from '#/components/deals/rentSchedule'
import { spaceVouchers } from './spaceVouchers'

describe('stage-scaled detail', () => {
  const spec = SHELL_SPECS[0]

  function childAtStage(stage: string) {
    const child = childrenOf(spec.dealId).find((c) => c.status === stage)
    if (!child) throw new Error(`no ${stage} child on ${spec.dealId}`)
    return child
  }

  it('gives the leased suite a tenant, commission and commencement date', () => {
    const child = childAtStage('closed')
    expect(child.tenantContactIds).toHaveLength(1)
    expect(child.transaction.commissionAmount).toBeGreaterThan(0)
    expect(child.transaction.leaseCommencementDate).not.toBeNull()
    expect(child.transaction.closeDate).not.toBeNull()
    expect(child.transaction.backOffice.receivables).toHaveLength(1)
  })

  it('gives the under-contract suite a tenant and an executed date, but no commission yet', () => {
    const child = childAtStage('under-contract')
    expect(child.tenantContactIds).toHaveLength(1)
    expect(child.transaction.contractExecutedDate).not.toBeNull()
    expect(child.transaction.commissionAmount).toBe(0)
  })

  it('leaves the not-advertised suite bare', () => {
    const child = childAtStage('proposal')
    expect(child.tenantContactIds).toEqual([])
    expect(child.transaction.commissionAmount).toBe(0)
    expect(child.transaction.listedOnDate).toBeNull()
    expect(child.tasks).toEqual([])
  })

  it('weights each suite by its stage for the commission forecast', () => {
    for (const child of childrenOf(spec.dealId)) {
      if (child.status === 'closed') expect(child.transaction.closeProbability).toBe(100)
    }
  })

  it('computes the leased commission the way the rent schedule does', () => {
    const child = childAtStage('closed')
    const schedule = buildRentSchedule(child)
    expect(schedule).not.toBeNull()
    expect(Math.round(child.transaction.commissionAmount)).toBe(
      Math.round(schedule!.total.commissionAmount),
    )
  })

  it('reports the leased suite in the shell vouchers index', () => {
    const { shell } = shellFor(spec.dealId)
    const rows = spaceVouchers(shell.id)
    expect(rows).toHaveLength(spec.childStages.length)
    const leased = rows.find((r) => r.stage === 'closed')
    expect(leased?.tenantName).toBeTruthy()
    expect(leased?.commissionAmount).toBeGreaterThan(0)
    const bare = rows.find((r) => r.stage === 'proposal')
    expect(bare?.tenantName).toBeNull()
    expect(bare?.commissionAmount).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: FAIL — the closed child has no tenant and `commissionAmount` is 0.

- [ ] **Step 3: Write the commission helper**

Add to `src/data/leaseSpaceFixtures.ts`:

```ts
/**
 * Total lease commission over the term, replicating `buildRentSchedule`: base
 * annual rent split into 12-month periods, escalated each year, commission taken
 * at the deal's rate on each period.
 *
 * The math is inlined rather than imported because `rentSchedule.ts` pulls in
 * `dealDisplay` → `propertyDisplay`, and this module is loaded from `seed.ts` at
 * store-init time. `leaseSpaceFixtures.test.ts` pins the two together so the
 * duplication cannot drift.
 */
export function leaseCommissionAmount(
  annualRent: number,
  termMonths: number,
  escalatorPct: number,
  commissionPct: number,
): number {
  if (annualRent <= 0 || termMonths <= 0) return 0
  const baseMonthly = annualRent / 12
  let remaining = termMonths
  let year = 0
  let total = 0
  while (remaining > 0) {
    const months = Math.min(12, remaining)
    const monthlyRate = baseMonthly * (1 + escalatorPct / 100) ** year
    total += monthlyRate * months * (commissionPct / 100)
    remaining -= months
    year += 1
  }
  return total
}

/** Leading percentage of an escalator string, e.g. "3% annual" → 3. Mirrors `rentSchedule`. */
function parseEscalatorPct(escalators: string | null): number {
  if (!escalators) return 0
  const match = escalators.match(/([\d.]+)\s*%/)
  return match ? Number.parseFloat(match[1]) : 0
}

/** Annual rent for a space, per `dealHeadlineValue`'s lease branch. */
function annualRentFor(terms: SpaceLeaseTerms, sqft: number): number {
  if (terms.leaseRate == null) return 0
  switch (terms.leaseRateUnits) {
    case 'Monthly':
      return terms.leaseRate * 12
    case 'SF/Mo':
      return terms.leaseRate * 12 * sqft
    default:
      return terms.leaseRate * sqft
  }
}
```

- [ ] **Step 4: Write the stage-detail function**

Add to `src/data/leaseSpaceFixtures.ts`:

```ts
/** Terms `status` for a space, matching what its deal stage advertises. */
const TERMS_STATUS: Record<PropertyStatus, SpaceLeaseTerms['status']> = {
  proposal: 'Inactive',
  active: 'Active',
  'under-contract': 'Under Contract',
  closed: 'Closed',
  inactive: 'Inactive',
}

/**
 * Fill in what a space's stage implies. A Leased suite with no tenant and no
 * commission reads as broken, so each stage gets the parties, dates and history a
 * broker would have captured getting it there.
 */
function applyStageDetail(
  child: Listing,
  suiteNumber: number,
  tenantId: string | undefined,
): void {
  const stage = child.status
  const terms = child.marketing.spaceLeaseTerms?.[0]
  if (terms) terms.status = TERMS_STATUS[stage]

  const advance = (toStage: PropertyStatus, fromStage: PropertyStatus, days: number) => {
    child.history.push({
      id: `hist-${child.id}-${toStage}`,
      label: 'Stage updated from',
      fromStage,
      toStage,
      actor: child.internalBrokers[0]?.name ?? 'You (Listing Broker)',
      timestamp: isoTimestamp(-days),
    })
  }

  if (stage === 'proposal') return

  // Everything past proposal was marketed first.
  child.transaction.listedOnDate = isoDate(-90)
  child.publishedAt = isoTimestamp(-90)
  advance('active', 'proposal', 90)

  if (stage === 'active') {
    child.transaction.closeProbability = closeProbabilityForStage('active')
    child.tasks = [
      {
        id: `task-${child.id}-tour`,
        label: 'Follow up on tour request',
        date: isoDate(4),
        relativeDue: null,
        assigneeInitials: 'OW',
        status: 'open',
        hasAttachment: false,
      },
    ]
    child.transaction.nextCriticalDate = child.tasks[0].date
    return
  }

  // Under contract and beyond: a tenant was accepted.
  if (tenantId) child.tenantContactIds = [tenantId]
  child.transaction.contractExecutedDate = isoDate(-30)
  advance('under-contract', 'active', 30)

  if (stage === 'under-contract') {
    child.transaction.closeProbability = closeProbabilityForStage('under-contract')
    child.tasks = [
      {
        id: `task-${child.id}-loi`,
        label: 'Collect countersigned lease',
        date: isoDate(6),
        relativeDue: null,
        assigneeInitials: 'MT',
        status: 'open',
        hasAttachment: true,
      },
    ]
    child.transaction.nextCriticalDate = child.tasks[0].date
    return
  }

  if (stage !== 'closed') return

  // Leased: the space transacted, so it carries money.
  const sqft = child.marketing.availableSqFt || 0
  const commissionPct = child.transaction.commissionPct
  const commissionAmount = terms
    ? Math.round(
        leaseCommissionAmount(
          annualRentFor(terms, sqft),
          terms.leaseTermMonths ?? 0,
          parseEscalatorPct(terms.rentEscalators),
          commissionPct,
        ),
      )
    : 0

  child.transaction.commissionAmount = commissionAmount
  child.transaction.closeDate = isoDate(-10)
  child.transaction.leaseCommencementDate = isoDate(-5)
  child.transaction.closeProbability = closeProbabilityForStage('closed')
  child.transaction.nextCriticalDate = null
  if (terms) terms.closeDate = child.transaction.closeDate
  advance('closed', 'under-contract', 10)

  child.tasks = [
    {
      id: `task-${child.id}-voucher`,
      label: 'Submit commission voucher',
      date: isoDate(-8),
      relativeDue: null,
      assigneeInitials: 'KN',
      status: 'complete',
      hasAttachment: true,
    },
  ]

  child.transaction.backOffice = {
    ...child.transaction.backOffice,
    name: child.name,
    identifier: child.dealId,
    status: 'Approved',
    closeDate: child.transaction.closeDate,
    receivables: [
      {
        id: `recv-${child.id}`,
        payerName: child.transaction.backOffice.relatedContactsLabel,
        payerEmail: 'ap@tenant.example.com',
        dueDate: isoDate(20),
        billingDescription: `Lease commission — Suite ${suiteNumber}`,
        amount: commissionAmount,
        credited: 0,
      },
    ],
  }
}
```

Add the import for the probability helper at the top of the file:

```ts
import { closeProbabilityForStage } from './commission'
```

- [ ] **Step 5: Call it, with tenants**

In `applyLeaseSpaces`, replace the `property.units.forEach(...)` block with:

```ts
    // Tenants for the transacting suites: contacts already linked to this
    // property, minus the landlord side. `107` has exactly two such contacts —
    // one each for the Leased and Under Contract suites. If a seed shift ever
    // shortens the pool, later suites go without a tenant rather than sharing one.
    const tenantPool = contacts.filter(
      (c) => c.propertyIds.includes(property.id) && !shell.sellerContactIds.includes(c.id),
    )
    let tenantIndex = 0

    property.units.forEach((unit, i) => {
      const terms = termsByUnit.get(unit.id)
      if (!terms) return
      const stage = spec.childStages[i]
      const child = buildChild(shell, unit, terms, stage, i, spec, dealIdRef)
      const needsTenant = stage === 'under-contract' || stage === 'closed'
      applyStageDetail(child, (i + 1) * 100, needsTenant ? tenantPool[tenantIndex++]?.id : undefined)
      listings.push(child)
    })
```

Rename the `_contacts` parameter to `contacts` in the `applyLeaseSpaces` signature — the `tenantPool` filter above is now its one use site, so the underscore prefix (which is what exempts it from `noUnusedParameters`) has to go.

- [ ] **Step 6: Run the tests**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: PASS, all tests.

If "computes the leased commission the way the rent schedule does" fails, the two derivations disagree — check that `annualRentFor` matches `dealHeadlineValue`'s lease branch (`src/components/deals/dealDisplay.ts:77`) and that `buildRentSchedule` starts from `terms.dateAvailable`, which does not affect the total.

- [ ] **Step 7: Run the full suite and type-check**

Run: `bun --bun run test`
Expected: PASS, seed regression tests unchanged.

Run: `bunx tsc --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add src/data/leaseSpaceFixtures.ts src/data/leaseSpaceFixtures.test.ts
git commit -m "feat(seed): scale space deal detail to each suite's stage"
```

---

### Task 4: Browser verification

Confirm the fixture renders — Claude verifies breakage only; design judgment stays with Joel.

**Files:** none modified unless a defect turns up.

- [ ] **Step 1: Start the dev server**

Run: `bun --bun run dev` (background). Wait for the port — it should be `http://localhost:3000`.

- [ ] **Step 2: Load the deals board**

Use the `playwright` MCP server. `browser_navigate` to `http://localhost:3000/listings`, then `browser_wait_for` on text unique to the destination — the "Displaying N of N Deals" line. **Never** `waitUntil: "networkidle"` (Vite's HMR socket never closes).

Expected: 25 deal cards, not 20. Seven of them carry the `Space` type chip. Meridian Business Park and Patriot Commerce Park are absent as top-level cards — the board filters umbrellas.

- [ ] **Step 3: Open a shell's Spaces tab**

Click any `Space` card. It routes to `/listings/<parentId>/spaces?space=<childId>`.

Expected on Meridian: four rows — one Leased, one Under Contract, one Available, one Not advertised. Suite labels and sqft populated, no blank rate cells on the advertised rows.

- [ ] **Step 4: Check the console**

Run `browser_console_messages`.
Expected: no errors. Scope any DOM queries to `main.app-shell__main` — TanStack devtools inject their own nodes.

- [ ] **Step 5: Report**

Report what rendered and anything broken. Do **not** make visual adjustments — if something looks wrong rather than broken, describe it and leave it for review.

---

## Verification Summary

Before claiming done, all of these must have been run with their output confirmed:

- `bun --bun run test` — full suite passes
- `bunx tsc --noEmit` — clean
- `seed.test.ts`, `seed.rosaHero.test.ts`, `seed.delgado.test.ts` — passing **unchanged**
- Browser: `/listings` loads with 25 cards, the Spaces tab renders four states, console clean

Leave the branch as-is when done — no merge, no push, no PR.
