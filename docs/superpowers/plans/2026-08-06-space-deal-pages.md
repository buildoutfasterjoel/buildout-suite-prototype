# Space Deal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a lease space deal its own page nested under its building, and turn the building's Spaces section into a directory of every suite the property has — with or without a deal.

**Architecture:** A new route tree at `src/routes/_shell/listings/$listingId_/spaces/$spaceId/` holds 18 typed section routes. The trailing underscore on `$listingId_` preserves the URL `/listings/{shellId}/spaces/{spaceId}/…` while un-nesting from `$listingId.tsx`'s layout, so the space renders its own header and sidebar instead of inside the building's frame. A new `buildingSuites` derivation walks `property.units` and left-joins child deals, replacing the deal-only `buildingAvailability` on the roster. Occupancy becomes an asset fact on `PropertyUnit`.

**Tech Stack:** React 19 · TypeScript · TanStack Start / Router (file-based routes) · Zustand + IndexedDB (client-owned store) · Vitest · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro

**Design spec:** `docs/superpowers/specs/2026-08-06-space-deal-pages-design.md`

## Global Constraints

- **Package manager is Bun.** Always `bun --bun run <script>`. Tests: `bun --bun run test`.
- **`vite build` does NOT type-check.** The only typecheck gate is `bunx tsc --noEmit`.
- **`src/routeTree.gen.ts` is auto-generated and carries `@ts-nocheck`.** Never hand-edit it. Neither `tsc` nor `vite build` catches a stale route tree — only regeneration does (it regenerates on `dev` and `build`).
- **Blueprint components only** for UI, imported from the `ui` subpath (e.g. `@buildoutinc/blueprint-react/ui/Button`). Bootstrap 5 utility classes for spacing/layout. No Tailwind.
- **FontAwesome Pro, `pro-regular` weight by default.** `pro-duotone` only for Alert and Banner. **Never pass `fixedWidth`** to `FontAwesomeIcon` — it is deprecated.
- **Blueprint `Field` parts require a `Field.Root` ancestor.** A standalone `Field.Description` / `Field.Label` crashes at runtime and `tsc` will not catch it. For detached helper text use `<div className="form-text">`.
- **Blueprint's CSS var prefix is `--bp-`, not `--bs-`.** Any `--bs-*` override silently does nothing.
- **The seed pass must stay faker-free.** `generateDataset` keeps drawing after `applyLeaseSpaces`; a single `faker` draw inside it shifts every downstream value the seed tests pin.
- **`SEED_VERSION` must be bumped when seed output changes** (`src/data/persistence.ts`), or IndexedDB serves the stale snapshot and the browser shows old data — a failure that reads as a code bug.
- **No committed E2E suite.** Do not add `@playwright/test` or `playwright.config.ts`. Browser verification is interactive via the `playwright` MCP server only.
- **No `waitUntil: "networkidle"`** in Playwright — Vite's HMR websocket holds the connection open forever and it always times out. Use `domcontentloaded` plus a wait for a specific element.
- **Scope Playwright selectors to `main.app-shell__main`** — TanStack devtools inject their own DOM (a hidden `<h3>Tanstack Router</h3>` matches bare heading queries and hangs visibility waits).
- **Commit messages carry no attribution trailer.** `.claude/settings.local.json` sets `attribution.commit` to `""`. Do not add `Co-Authored-By:` lines.
- **Never pair `Component.tsx` with `component.ts`** in one directory — macOS resolves the import to the wrong file and rollup fails.

---

## File Structure

**New — data layer (pure, testable without rendering):**
- `src/data/buildingSuites.ts` — `SuiteStatus`, `SuiteRow`, `suiteStatus()`, `buildingSuites()`. The suite directory's derivation. Sits beside `buildingAvailability.ts` and deliberately mirrors its shape.
- `src/data/buildingSuites.test.ts`
- `src/data/spaceRoute.ts` — `resolveSpaceRoute()`. The child-of-shell guard as a pure function so all 18 routes share one implementation and it can be tested without a router.
- `src/data/spaceRoute.test.ts`

**New — components:**
- `src/components/deals/useSpaceRoute.ts` — thin reactive hook wrapping `resolveSpaceRoute`.
- `src/components/deals/SpaceDetailHeader.tsx` — the space page's header: suite title, building link, breadcrumb, stage select.
- `src/components/deals/SpaceDetails.tsx` — `SpaceTermsSection` behind the page frame and a Save/Cancel bar.

**New — routes (18 sections + layout + index):**
- `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx` — layout
- `src/routes/_shell/listings/$listingId_/spaces/$spaceId/index.tsx` — redirect to `overview`
- `src/routes/_shell/listings/$listingId_/spaces/$spaceId/{overview,details,client-report,activities,history,files,underwriting,leads,documents,website,email,media,demographics,grids,plans,financials,financial-documents,notes}.tsx`

**Modified:**
- `src/data/types.ts` — `PropertyUnit` occupancy fields
- `src/data/store.ts`, `src/data/createListing.ts`, `src/data/seed.ts` — default the new fields
- `src/data/leaseSpaceFixtures.ts` — `occupiedSuites`, occupancy, gate child creation
- `src/data/persistence.ts` — `SEED_VERSION` 37 → 38
- `src/components/properties/dealNav.ts` — `Details` item, `details`/`listing` swap, `subsectionLabel`
- `src/components/properties/PropertyDetailSidebar.tsx` — props instead of a hardcoded route `from`
- `src/routes/_shell/listings/$listingId.tsx` — pass the new sidebar props
- `src/routes/_shell/listings/$listingId/spaces.tsx` — roster becomes the directory
- `src/components/deals/AddSpaceModal.tsx` — new-suite form only
- `src/components/deals/dealCardLink.ts` — a space resolves to its page
- `src/ai/tools.ts` — `rewriteSpaceDealPath` targets the space page
- `src/components/deals/StageGate.tsx` — space "Back to editing" → Details
- `src/routes/_shell/listings/$listingId/vouchers.tsx` — index rows link to the space page
- `src/components/deals/DealContextRail.tsx` — restore the parent link
- `src/components/deals/dealCardLink.invariant.test.ts` — premise rewritten

**Deleted:**
- `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx`

---

## Task 1: Occupancy on `PropertyUnit`

Occupancy is an asset fact, so it lives on the unit rather than on a deal. Required (not optional) fields, so every construction site must state a suite's occupancy — `tsc` then enumerates the sites for you.

**Files:**
- Modify: `src/data/types.ts` (interface `PropertyUnit`, ~line 315)
- Modify: `src/data/store.ts` (`addPropertyUnit`, ~line 90)
- Modify: `src/data/createListing.ts` (3 unit-construction sites — find with `grep -n "furnished:" src/data/createListing.ts`)
- Modify: `src/data/seed.ts` (1 site — `grep -n "furnished:" src/data/seed.ts`)
- Modify: `src/data/leaseSpaceFixtures.ts` (`resliceUnits`, the appended-unit branch ~line 82)
- Modify: `src/data/leaseSpaces.test.ts` (1 site)
- Test: `src/data/store.test.ts` (append to the existing file)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  interface PropertyUnit {
    // … existing fields unchanged …
    occupancy: 'vacant' | 'occupied'
    tenantName: string | null
    leaseExpiration: string | null   // ISO YYYY-MM-DD
  }
  ```
  Every factory defaults these to `{ occupancy: 'vacant', tenantName: null, leaseExpiration: null }`.

- [ ] **Step 1: Write the failing test**

Append to `src/data/store.test.ts`:

```ts
describe('addPropertyUnit occupancy defaults', () => {
  it('creates a unit that is vacant with no tenant on record', () => {
    const listing = createProposalListing({ ...emptyDraft(), name: 'Occupancy Fixture', dealType: 'Lease' })
    const unit = addPropertyUnit(listing.propertyId, {
      label: 'Suite 900', sqft: 1200, unitType: 'office',
    })!

    expect(unit.occupancy).toBe('vacant')
    expect(unit.tenantName).toBeNull()
    expect(unit.leaseExpiration).toBeNull()
  })
})
```

Make sure the file's imports cover `createProposalListing`, `emptyDraft` (from `./createListing`) and `addPropertyUnit` (from `./store`); add whichever are missing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test -- src/data/store.test.ts`
Expected: FAIL — TypeScript/assertion error because `occupancy` does not exist on `PropertyUnit`.

- [ ] **Step 3: Add the fields to the type**

In `src/data/types.ts`, inside `interface PropertyUnit`, immediately after `furnished: boolean`:

```ts
  /**
   * Whether a tenant is in place. The asset's own fact — a suite's deal, when it
   * has one, overrides this for display (see `suiteStatus` in buildingSuites.ts).
   */
  occupancy: 'vacant' | 'occupied'
  /**
   * In-place tenant, when occupied. Marketing may override this per deal via
   * `SpaceLeaseTerms.tenantName`.
   */
  tenantName: string | null
  /** ISO date (YYYY-MM-DD) the in-place lease ends. */
  leaseExpiration: string | null
```

- [ ] **Step 4: Default the fields at every construction site**

Run `bunx tsc --noEmit` and add this triple to each `PropertyUnit` literal it flags:

```ts
    occupancy: 'vacant',
    tenantName: null,
    leaseExpiration: null,
```

Expected sites: `store.ts` `addPropertyUnit`, three in `createListing.ts`, one in `seed.ts`, the appended-unit branch of `resliceUnits` in `leaseSpaceFixtures.ts`, and one in `leaseSpaces.test.ts`. Use `'vacant'` everywhere — Task 3 sets real occupancy on seeded suites.

- [ ] **Step 5: Run the typecheck and the full suite**

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bun --bun run test`
Expected: all pass, including the new one.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/store.ts src/data/createListing.ts src/data/seed.ts src/data/leaseSpaceFixtures.ts src/data/leaseSpaces.test.ts src/data/store.test.ts
git commit -m "feat(properties): record a suite's occupancy on the unit"
```

---

## Task 2: `buildingSuites` — the suite directory's derivation

`buildingAvailability` walks child deals, so a suite with no deal is invisible to it. This walks `property.units` and left-joins the deal.

**Files:**
- Create: `src/data/buildingSuites.ts`
- Create: `src/data/buildingSuites.test.ts`

**Interfaces:**
- Consumes: `PropertyUnit.occupancy` / `.tenantName` / `.leaseExpiration` (Task 1); existing `spaceAvailability(status)` and `SpaceAvailability` from `./dealShape`; `getChildDeals` from `./leaseSpaces`; `getListing` / `getProperty` from `./store`.
- Produces:
  ```ts
  export type SuiteStatus = SpaceAvailability | 'Occupied' | 'Vacant'
  export interface SuiteRow {
    unitId: string
    label: string
    sqft: number
    dealId: string | null
    stage: PropertyStatus | null
    status: SuiteStatus
    leaseRate: number | null
    leaseRateUnits: LeaseRateUnits
    tenantName: string | null
    leaseExpiration: string | null
  }
  export function suiteStatus(deal: Listing | null, unit: PropertyUnit): SuiteStatus
  export function buildingSuites(shellDealId: string): SuiteRow[]
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/data/buildingSuites.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { commitStageTransition } from './actions'
import { updateDealMarketing } from './actions'
import { getProperty, updateProperty } from './store'
import { buildingSuites, suiteStatus } from './buildingSuites'

function makeShell() {
  return createProposalListing({ ...emptyDraft(), name: 'Tower Assignment', dealType: 'Lease' })
}

/** Mark a unit occupied on the property record — the asset fact, no deal involved. */
function occupy(propertyId: string, unitId: string, tenant: string, expires: string) {
  const property = getProperty(propertyId)!
  updateProperty(propertyId, {
    units: property.units.map((u) =>
      u.id === unitId
        ? { ...u, occupancy: 'occupied' as const, tenantName: tenant, leaseExpiration: expires }
        : u,
    ),
  })
}

describe('buildingSuites', () => {
  it('returns a row for every unit, whether or not it has a deal', () => {
    const shell = makeShell()
    const withDeal = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const noDeal = addPropertyUnit(shell.propertyId, { label: 'Suite 200', sqft: 2000, unitType: 'office' })!
    addSpaceToDeal(shell.id, withDeal.id)

    const rows = buildingSuites(shell.id)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.unitId === withDeal.id)!.dealId).not.toBeNull()
    expect(rows.find((r) => r.unitId === noDeal.id)!.dealId).toBeNull()
  })

  it('reports a suite with no deal as Vacant or Occupied from the unit', () => {
    const shell = makeShell()
    const vacant = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const taken = addPropertyUnit(shell.propertyId, { label: 'Suite 200', sqft: 2000, unitType: 'office' })!
    occupy(shell.propertyId, taken.id, 'Acme Holdings', '2027-03-31')

    const rows = buildingSuites(shell.id)
    const vacantRow = rows.find((r) => r.unitId === vacant.id)!
    const takenRow = rows.find((r) => r.unitId === taken.id)!

    expect(vacantRow.status).toBe('Vacant')
    expect(vacantRow.tenantName).toBeNull()
    expect(takenRow.status).toBe('Occupied')
    expect(takenRow.tenantName).toBe('Acme Holdings')
    expect(takenRow.leaseExpiration).toBe('2027-03-31')
  })

  it("lets a deal's stage outrank the unit's occupancy", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    // Occupied on the asset record AND worked as a deal — the deal wins.
    occupy(shell.propertyId, unit.id, 'Old Tenant', '2026-12-31')
    const child = addSpaceToDeal(shell.id, unit.id)!.deal
    commitStageTransition({ dealId: child.id, targetStage: 'active', actor: 'T' })

    expect(buildingSuites(shell.id)[0].status).toBe('Available')
  })

  it("carries the deal's rate onto the row", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    const child = addSpaceToDeal(shell.id, unit.id)!.deal
    updateDealMarketing(child.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 34, leaseRateUnits: 'SF/Yr' }],
    })

    const row = buildingSuites(shell.id)[0]
    expect(row.leaseRate).toBe(34)
    expect(row.leaseRateUnits).toBe('SF/Yr')
  })

  it("prefers the shell's tenant-name override over the unit's own for a suite with no deal", () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    occupy(shell.propertyId, unit.id, 'Acme Corp', '2027-03-31')
    updateDealMarketing(shell.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), tenantName: 'Acme Holdings LLC' }],
    })

    expect(buildingSuites(shell.id)[0].tenantName).toBe('Acme Holdings LLC')
  })

  it('falls back to the unit when the override is blank rather than showing nothing', () => {
    const shell = makeShell()
    const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 1000, unitType: 'office' })!
    occupy(shell.propertyId, unit.id, 'Acme Corp', '2027-03-31')
    updateDealMarketing(shell.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), tenantName: '   ' }],
    })

    expect(buildingSuites(shell.id)[0].tenantName).toBe('Acme Corp')
  })

  it('orders suites by label with numeric collation, so Suite 100 precedes Suite 20', () => {
    const shell = makeShell()
    addPropertyUnit(shell.propertyId, { label: 'Suite 100', sqft: 100, unitType: 'office' })
    addPropertyUnit(shell.propertyId, { label: 'Suite 20', sqft: 100, unitType: 'office' })
    addPropertyUnit(shell.propertyId, { label: 'Suite 3', sqft: 100, unitType: 'office' })

    expect(buildingSuites(shell.id).map((r) => r.label)).toEqual(['Suite 3', 'Suite 20', 'Suite 100'])
  })

  it('returns nothing for a listing that does not exist', () => {
    expect(buildingSuites('no-such-deal')).toEqual([])
  })
})

describe('suiteStatus', () => {
  const unit = (occupancy: 'vacant' | 'occupied') =>
    ({ occupancy, tenantName: null, leaseExpiration: null }) as never

  it('answers from the unit only when there is no deal', () => {
    expect(suiteStatus(null, unit('vacant'))).toBe('Vacant')
    expect(suiteStatus(null, unit('occupied'))).toBe('Occupied')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- src/data/buildingSuites.test.ts`
Expected: FAIL — `Cannot find module './buildingSuites'`.

- [ ] **Step 3: Write the implementation**

Create `src/data/buildingSuites.ts`:

```ts
import type { LeaseRateUnits, Listing, PropertyStatus, PropertyUnit } from './types'
import { getListing, getProperty } from './store'
import { getChildDeals } from './leaseSpaces'
import { spaceAvailability, type SpaceAvailability } from './dealShape'

/**
 * What a directory row reports. The deal-derived states come from
 * `spaceAvailability`; `Occupied` and `Vacant` are the asset's own answer for a
 * suite nobody is working.
 */
export type SuiteStatus = SpaceAvailability | 'Occupied' | 'Vacant'

export interface SuiteRow {
  unitId: string
  label: string
  sqft: number
  /** The child deal working this suite, or null when nobody has started one. */
  dealId: string | null
  stage: PropertyStatus | null
  status: SuiteStatus
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  /** Marketing-facing tenant name: the override when set, else the asset fact. */
  tenantName: string | null
  leaseExpiration: string | null
}

/**
 * Two facts could disagree about a suite — its deal's stage and the unit's
 * occupancy — so the rule is stated once here rather than at each render site:
 *
 * **A deal, when one exists, is the truth. Occupancy answers only for a suite
 * nobody is working.**
 *
 * This is why occupancy on a suite that has a deal is never read. The seed still
 * sets it truthfully so the asset record holds no lie, but the directory does not
 * consult it.
 */
export function suiteStatus(deal: Listing | null, unit: PropertyUnit): SuiteStatus {
  if (deal) return spaceAvailability(deal.status)
  return unit.occupancy === 'occupied' ? 'Occupied' : 'Vacant'
}

/**
 * Every suite the building has, with its deal joined on when one exists.
 *
 * Distinct from `buildingAvailability`, which is sourced from child deals and
 * answers "what does this building advertise" — a question a suite with no deal
 * has no place in. This one answers "what suites exist", which is what a broker
 * deciding where to start a deal needs.
 */
export function buildingSuites(shellDealId: string): SuiteRow[] {
  const shell = getListing(shellDealId)
  if (!shell) return []
  const property = getProperty(shell.propertyId)
  if (!property) return []

  const dealByUnit = new Map<string, Listing>()
  for (const child of getChildDeals(shellDealId)) {
    if (child.unitId) dealByUnit.set(child.unitId, child)
  }

  return property.units
    .map((unit): SuiteRow => {
      const deal = dealByUnit.get(unit.id) ?? null
      // Terms live on the child once a deal exists. Before that the shell may
      // still hold a row for the unit — the tenant-name override, or a rate the
      // broker set before splitting. `addSpaceToDeal` migrates that row down.
      const terms = deal
        ? deal.marketing.spaceLeaseTerms?.[0]
        : shell.marketing.spaceLeaseTerms?.find((t) => t.unitId === unit.id)
      return {
        unitId: unit.id,
        label: unit.label,
        sqft: unit.sqft,
        dealId: deal?.id ?? null,
        stage: deal?.status ?? null,
        status: suiteStatus(deal, unit),
        leaseRate: terms?.leaseRate ?? null,
        leaseRateUnits: terms?.leaseRateUnits ?? 'SF/Yr',
        // `||` after trim, not `??`: a blank override is not an answer, so it
        // falls through to the asset fact rather than blanking the column.
        tenantName: terms?.tenantName?.trim() || unit.tenantName,
        leaseExpiration: unit.leaseExpiration,
      }
    })
    // The Vouchers index and this directory must not disagree about order, and
    // `property.units` is insertion-ordered. Numeric collation so Suite 100 does
    // not sort before Suite 20.
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test -- src/data/buildingSuites.test.ts`
Expected: PASS, all 9.

- [ ] **Step 5: Commit**

```bash
git add src/data/buildingSuites.ts src/data/buildingSuites.test.ts
git commit -m "feat(lease): derive every suite a building has, deal or not"
```

---

## Task 3: Seed occupied and vacant suites

Today `childStages` has one entry per suite, so every seeded suite has a deal and the directory would show nothing new. Give each shell suites past its deal-bearing ones.

The unit count is `suiteProportions.length + 1` (`suiteSizes` appends a remainder). The first `childStages.length` units get deals; the next `occupiedSuites.length` are occupied with no deal; anything after that is vacant with no deal. **Child counts must not change** — 7 children across both shells — because `seed.test.ts` pins the listing total at 27.

**Files:**
- Modify: `src/data/leaseSpaceFixtures.ts` (`ShellSpec`, `SHELL_SPECS`, `applyLeaseSpaces`)
- Modify: `src/data/persistence.ts` (`SEED_VERSION`)
- Test: `src/data/leaseSpaceFixtures.test.ts`

**Interfaces:**
- Consumes: `PropertyUnit` occupancy fields (Task 1); `buildingSuites` (Task 2) for the assertions.
- Produces:
  ```ts
  export interface ShellSpec {
    dealId: string
    suiteProportions: number[]
    childStages: PropertyStatus[]
    /** Suites after the deal-bearing ones: on the building, occupied, no deal. */
    occupiedSuites: { tenant: string; expiresInDays: number }[]
  }
  ```

- [ ] **Step 1: Write the failing tests**

Append to `src/data/leaseSpaceFixtures.test.ts` (match the file's existing import style and store-access helpers):

```ts
describe('suites without deals', () => {
  it('gives every shell at least one occupied suite that has no deal', () => {
    for (const spec of SHELL_SPECS) {
      const shell = [...getStore().listings.values()].find((l) => l.dealId === spec.dealId)!
      const rows = buildingSuites(shell.id)
      const occupied = rows.filter((r) => r.status === 'Occupied')

      expect(occupied.length).toBeGreaterThanOrEqual(1)
      for (const row of occupied) {
        expect(row.dealId).toBeNull()
        expect(row.tenantName).not.toBeNull()
        expect(row.leaseExpiration).not.toBeNull()
      }
    }
  })

  it('gives Meridian a vacant suite with no deal, so Start-a-deal is reachable from a fresh seed', () => {
    const shell = [...getStore().listings.values()].find((l) => l.dealId === '107')!
    const vacant = buildingSuites(shell.id).filter((r) => r.status === 'Vacant' && r.dealId === null)

    expect(vacant.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps every spec self-consistent: units cover the deals, the occupied and the rest', () => {
    for (const spec of SHELL_SPECS) {
      const unitCount = spec.suiteProportions.length + 1
      expect(unitCount).toBeGreaterThanOrEqual(
        spec.childStages.length + spec.occupiedSuites.length,
      )
    }
  })

  it('still creates exactly one child per stage in childStages, and no more', () => {
    for (const spec of SHELL_SPECS) {
      const shell = [...getStore().listings.values()].find((l) => l.dealId === spec.dealId)!
      expect(getChildDeals(shell.id)).toHaveLength(spec.childStages.length)
    }
  })

  it('never lets a unit claim it is vacant while its deal says Leased', () => {
    for (const spec of SHELL_SPECS) {
      const shell = [...getStore().listings.values()].find((l) => l.dealId === spec.dealId)!
      const property = getStore().properties.get(shell.propertyId)!
      for (const child of getChildDeals(shell.id)) {
        if (child.status !== 'closed') continue
        const unit = property.units.find((u) => u.id === child.unitId)!
        expect(unit.occupancy).toBe('occupied')
        expect(unit.tenantName).not.toBeNull()
      }
    }
  })
})
```

Add the imports these need: `SHELL_SPECS` from `./leaseSpaceFixtures`, `buildingSuites` from `./buildingSuites`, `getChildDeals` from `./leaseSpaces`, `getStore` from `./store`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts`
Expected: FAIL — `occupiedSuites` is not a property of `ShellSpec`, and no occupied rows exist.

- [ ] **Step 3: Add `occupiedSuites` to the spec type and the two fixtures**

In `src/data/leaseSpaceFixtures.ts`, extend the interface:

```ts
export interface ShellSpec {
  dealId: string
  /**
   * Suite sizes as proportions of the building; the array yields
   * `length + 1` units, the last taking the remainder.
   *
   * The first `childStages.length` units get child deals. The next
   * `occupiedSuites.length` are occupied with no deal. Anything after that is
   * vacant with no deal — which is what makes Start-a-deal reachable from a
   * fresh seed.
   */
  suiteProportions: number[]
  childStages: PropertyStatus[]
  /** Suites after the deal-bearing ones: on the building, occupied, no deal. */
  occupiedSuites: { tenant: string; expiresInDays: number }[]
}
```

Replace `SHELL_SPECS`:

```ts
export const SHELL_SPECS: ShellSpec[] = [
  // Meridian Business Park — an active office building mid-lease-up. One suite in
  // each of the four states `spaceAvailability` can report, plus the two a suite
  // can be in without a deal: occupied by a sitting tenant, and vacant and
  // unworked. Six units, four children.
  {
    dealId: '107',
    suiteProportions: [0.26, 0.2, 0.18, 0.14, 0.12],
    childStages: ['closed', 'under-contract', 'active', 'proposal'],
    occupiedSuites: [{ tenant: 'Calloway Freight', expiresInDays: 240 }],
  },
  // Patriot Commerce Park — just split, nothing marketed yet. Every worked suite
  // reads "Not advertised", which is what a broker sees the moment they break a
  // building out; one suite is occupied and was never part of the assignment.
  // Four units, three children.
  {
    dealId: '104',
    suiteProportions: [0.32, 0.26, 0.22],
    childStages: ['proposal', 'proposal', 'proposal'],
    occupiedSuites: [{ tenant: 'Sunbelt Fabrication', expiresInDays: 620 }],
  },
]
```

- [ ] **Step 4: Gate child creation and set occupancy**

In `applyLeaseSpaces`, replace the `property.units.forEach(...)` block and what follows it:

```ts
    // Tenant names for suites whose deal has closed — captured here so occupancy
    // can be set truthfully below without recomputing the tenant pool.
    const closedTenantByUnit = new Map<string, string>()

    property.units.forEach((unit, i) => {
      const terms = termsByUnit.get(unit.id)
      if (!terms) return
      const stage = spec.childStages[i]
      // Past the deal-bearing suites: this one lives on the building without an
      // engagement. No child, and its occupancy is set below.
      if (stage === undefined) return
      const child = buildChild(shell, unit, terms, stage, i, spec, dealIdRef)
      // Past Available, a space has an accepted tenant — the lease-side
      // counterparty, which `stageGates` requires to reach Under Contract and
      // which `spaceVouchers` reads. Distinct from `buyerContactIds` on purpose.
      let tenantName: string | undefined
      if (stage === 'under-contract' || stage === 'closed') {
        const tenantId = tenantPool[tenantIndex++]
        if (tenantId) {
          child.tenantContactIds = [tenantId]
          const tenant = contacts.find((c) => c.id === tenantId)
          // Person name, not company: `spaceVouchers` derives its Tenant column
          // from the contact this way, and the roster and the vouchers index must
          // not print two different tenants for the same suite.
          tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : undefined
        }
      }
      if (stage === 'closed' && tenantName) closedTenantByUnit.set(unit.id, tenantName)
      applyStageDetail(child, (i + 1) * 100, tenantName)
      listings.push(child)
    })

    // Occupancy is the asset's own fact. `suiteStatus` reads a suite's deal
    // first, so these values only answer for the suites that have no deal — but
    // a Leased suite must not have its unit claiming to be vacant either, so the
    // closed ones are set too.
    property.units.forEach((unit, i) => {
      const occupied = spec.occupiedSuites[i - spec.childStages.length]
      const closedTenant = closedTenantByUnit.get(unit.id)
      if (occupied) {
        unit.occupancy = 'occupied'
        unit.tenantName = occupied.tenant
        unit.leaseExpiration = isoDate(occupied.expiresInDays)
      } else if (closedTenant) {
        unit.occupancy = 'occupied'
        unit.tenantName = closedTenant
        unit.leaseExpiration = isoDate(1825)
      } else {
        unit.occupancy = 'vacant'
        unit.tenantName = null
        unit.leaseExpiration = null
      }
    })
```

Leave the block after it (`shell.marketing.spaceLeaseTerms = []`, `shell.unitId = null`, the transaction resets) exactly as it is — wiping the shell's rows is still correct, and the occupied suites take their tenant from the unit rather than from a shell row.

- [ ] **Step 5: Bump `SEED_VERSION`**

In `src/data/persistence.ts`:

```ts
export const SEED_VERSION = 38;
```

Without this, IndexedDB serves the version-37 snapshot and none of the new suites appear in the browser — which reads as a code bug rather than a stale cache.

- [ ] **Step 6: Run the seed tests**

Run: `bun --bun run test -- src/data/leaseSpaceFixtures.test.ts src/data/seed.test.ts src/data/buildingAvailability.test.ts`
Expected: PASS. If `seed.test.ts` pins a per-property unit count, update that number — the listing total (27) must be unchanged, since child counts did not change.

- [ ] **Step 7: Run the full suite and typecheck**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/data/leaseSpaceFixtures.ts src/data/leaseSpaceFixtures.test.ts src/data/persistence.ts src/data/seed.test.ts
git commit -m "feat(seed): give each lease shell suites nobody is working"
```

---

## Task 4: `dealNav` — the `Details` item, the swap pair, and a third breadcrumb level

**Files:**
- Modify: `src/components/properties/dealNav.ts`
- Test: `src/components/properties/dealNav.test.ts`

**Interfaces:**
- Consumes: `DealShape` from `#/data/dealShape`.
- Produces:
  ```ts
  export function dealBreadcrumbTrail(
    pathname: string,
    listingId: string,
  ): { sectionLabel: string | null; detailId: string | null; subsectionLabel: string | null }
  ```
  `NAV_GROUPS` gains `{ label: "Details", href: "details", icon: faRulerCombined }` in the Marketing group immediately before `Listing`. `visibleNavGroups` gains the `details`/`listing` swap.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/properties/dealNav.test.ts`:

```ts
describe("the details / listing swap", () => {
  const opts = { leaseParent: false, showsUnderwriting: false };

  it("gives a space Details and never Listing", () => {
    const hrefs = visibleNavGroups("space", opts).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("details");
    expect(hrefs).not.toContain("listing");
  });

  it("gives every other shape Listing and never Details", () => {
    for (const shape of ["sale", "flat-lease", "shell"] as const) {
      const hrefs = visibleNavGroups(shape, opts).flatMap((g) => g.items.map((i) => i.href));
      expect(hrefs).toContain("listing");
      expect(hrefs).not.toContain("details");
    }
  });

  it("shows exactly one of the two for every shape — never both, never neither", () => {
    for (const shape of ["sale", "flat-lease", "shell", "space"] as const) {
      const hrefs = visibleNavGroups(shape, opts).flatMap((g) => g.items.map((i) => i.href));
      const present = hrefs.filter((h) => h === "details" || h === "listing");
      expect(present).toHaveLength(1);
    }
  });

  it("gives a space no Spaces and no Vouchers index", () => {
    const hrefs = visibleNavGroups("space", opts).flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("spaces");
    expect(hrefs).not.toContain("vouchers");
    // A space still earns its own commission, so it keeps the single pair.
    expect(hrefs).toContain("financials");
    expect(hrefs).toContain("financial-documents");
  });
});

describe("dealBreadcrumbTrail — the space page's third level", () => {
  it("names the section, the space and the subsection", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/leads", "L1")).toEqual({
      sectionLabel: "Spaces",
      detailId: "S9",
      subsectionLabel: "Leads",
    });
  });

  it("reports no subsection on the space's own root", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9", "L1")).toEqual({
      sectionLabel: "Spaces",
      detailId: "S9",
      subsectionLabel: null,
    });
  });

  it("labels the space's Details subsection", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/details", "L1").subsectionLabel).toBe("Details");
  });

  it("reports no subsection for a third segment absent from NAV_GROUPS", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/nonsense", "L1").subsectionLabel).toBeNull();
  });

  it("tolerates a trailing slash after the space id", () => {
    expect(dealBreadcrumbTrail("/listings/L1/spaces/S9/", "L1").subsectionLabel).toBeNull();
  });
});
```

Every existing test in this file must keep passing. `subsectionLabel` is a new key, so any existing assertion written as `toEqual({ sectionLabel, detailId })` needs `subsectionLabel: null` added.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- src/components/properties/dealNav.test.ts`
Expected: FAIL — no `details` item, and `subsectionLabel` is undefined.

- [ ] **Step 3: Add the `Details` nav item**

In `src/components/properties/dealNav.ts`, in the Marketing group, immediately **before** the `Listing` item:

```ts
      // A space's own form. It occupies the Listing slot rather than sitting
      // beside it: a parent deal's own marketing form is Listing, a space's is
      // Details, and `visibleNavGroups` shows exactly one of the two.
      { label: "Details", href: "details", icon: faRulerCombined },
```

`faRulerCombined` is already imported in this file (it is the `Plans` icon), so no import change is needed.

- [ ] **Step 4: Add the swap pair to `visibleNavGroups`**

Inside the `items.filter` callback, above the existing `vouchers` rule:

```ts
      // A space's own marketing form is Details; every other shape's is Listing.
      // Exactly one of the two is ever shown — the same swap the Vouchers /
      // Voucher pair below uses.
      if (item.href === "details") return shape === "space";
      if (item.href === "listing") return shape !== "space";
```

- [ ] **Step 5: Add `subsectionLabel` to the breadcrumb trail**

Replace the body of `dealBreadcrumbTrail`:

```ts
export function dealBreadcrumbTrail(
  pathname: string,
  listingId: string,
): {
  sectionLabel: string | null;
  detailId: string | null;
  subsectionLabel: string | null;
} {
  const none = { sectionLabel: null, detailId: null, subsectionLabel: null };
  const prefix = `/listings/${listingId}`;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return none;

  const [section, detail, subsection] = pathname
    .slice(prefix.length)
    .replace(/^\//, "")
    .split("/");
  if (!section) return none;

  const items = NAV_GROUPS.flatMap((g) => g.items);
  const item = items.find((i) => i.href === section);
  if (!item) return none;

  // `||`, not `??`: a trailing slash splits to an empty string, which is no more
  // a detail id or a subsection than a missing segment is.
  return {
    sectionLabel: item.label,
    detailId: detail || null,
    // The third segment is a section of the *drilled-into record* — a space's own
    // nav — so it is looked up in the same NAV_GROUPS rather than a second list.
    // An unknown slug yields null rather than inventing a label from it.
    subsectionLabel: items.find((i) => i.href === (subsection || null))?.label ?? null,
  };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun --bun run test -- src/components/properties/dealNav.test.ts`
Expected: PASS.

- [ ] **Step 7: Run typecheck and the full suite**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: clean. `PropertyDetailHeader` destructures `{ sectionLabel, detailId }` — an added key does not break it.

- [ ] **Step 8: Commit**

```bash
git add src/components/properties/dealNav.ts src/components/properties/dealNav.test.ts
git commit -m "feat(deal-nav): give a space a Details section and a third crumb"
```

---

## Task 5: Make the sidebar reusable under a second route

`PropertyDetailSidebar` currently reads `useParams({ from: "/_shell/listings/$listingId" })`. That `from` is a hardcoded route id — under the space route that match does not exist, so it throws. It also derives its active item from `dealBreadcrumbTrail(pathname, listingId).sectionLabel`, which for a space path resolves to `"Spaces"` rather than the space's own section.

So the sidebar takes what it needs as props. There is no usable default: a default `from` would keep the crash.

**Files:**
- Modify: `src/components/properties/PropertyDetailSidebar.tsx`
- Modify: `src/routes/_shell/listings/$listingId.tsx` (the one existing call site)

**Interfaces:**
- Consumes: `visibleNavGroups`, `dealBreadcrumbTrail` (Task 4).
- Produces:
  ```ts
  export function PropertyDetailSidebar(props: {
    /** The record whose sections these are — a building or a space. */
    listing: Listing
    /** URL prefix each item's href is appended to, with no trailing slash. */
    basePath: string
    /** Which nav item is current, by label. */
    activeLabel: string | null
  }): JSX.Element
  ```

- [ ] **Step 1: Change the signature**

In `src/components/properties/PropertyDetailSidebar.tsx`, replace the `useLocation` / `useParams` / store-lookup preamble with props. Delete the `useLocation`, `useParams`, `useDataStore`, `getListing` and `dealBreadcrumbTrail` imports if they become unused; keep `useNavigate` and `getProperty`.

```tsx
export function PropertyDetailSidebar({
  listing,
  basePath,
  activeLabel,
}: {
  /** The record whose sections these are — a building or a space. */
  listing: Listing;
  /**
   * URL prefix each item's href is appended to, no trailing slash. A building
   * passes `/listings/{id}`; a space passes
   * `/listings/{shellId}/spaces/{spaceId}`. Taken as a prop because this
   * component renders under two different routes, and the route id a
   * `useParams({ from })` would need differs between them.
   */
  basePath: string;
  /**
   * Which item is current, by label. Derived by the caller: a building reads
   * `sectionLabel` off the path, a space reads `subsectionLabel`, and this
   * component cannot tell which it is rendering for.
   */
  activeLabel: string | null;
}) {
  const navigate = useNavigate();
  const property = getProperty(listing.propertyId);
  const showsUnderwriting =
    listing.underwriting != null || propertyQualifiesForUnderwriting(property);
  const shape = dealShape(listing);
  const leaseParent = isLeaseParent(listing);
  const navGroups = visibleNavGroups(shape, { leaseParent, showsUnderwriting });
```

Keep the `collapsed` state, its `useEffect`, and `setGroupOpen` exactly as they are.

- [ ] **Step 2: Point navigation and highlighting at the props**

Replace `handleTabChange`'s navigate call:

```tsx
    void navigate({ to: `${basePath}/${item.href}` });
```

Replace the `activeInGroup` line inside the `navGroups.map`:

```tsx
        const activeInGroup =
          group.items.find((item) => item.label === activeLabel)?.label ?? "";
```

Delete the now-dead `const { sectionLabel } = dealBreadcrumbTrail(...)` line and the `const version = useDataStore(...)` / `void version` pair — reactivity now comes from the `listing` prop, which the layout already reads from a reactive selector.

- [ ] **Step 3: Update the building's call site**

In `src/routes/_shell/listings/$listingId.tsx`, add the imports and pass the props:

```tsx
import { useLocation } from "@tanstack/react-router";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
```

Inside `PropertyDetail`, after the `listing` lookup and the `if (!listing)` guard:

```tsx
  const { pathname } = useLocation();
  // The building's current section is the first segment after its id. A space
  // page computes its own active label from `subsectionLabel` instead.
  const { sectionLabel } = dealBreadcrumbTrail(pathname, listingId);
```

And in the JSX:

```tsx
          <PropertyDetailSidebar
            listing={listing}
            basePath={`/listings/${listingId}`}
            activeLabel={sectionLabel}
          />
```

- [ ] **Step 4: Verify nothing else calls it**

Run: `grep -rn "PropertyDetailSidebar" src --include='*.tsx'`
Expected: only its own definition and `$listingId.tsx`.

- [ ] **Step 5: Typecheck and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: clean.

- [ ] **Step 6: Verify in the browser that nothing regressed**

Start the dev server if it is not already running: `bun --bun run dev` (background).

With the `playwright` MCP server:
1. `browser_navigate` to `http://localhost:3000/listings`
2. `browser_wait_for` text `"Displaying 20 of 20 Deals"` — `browser_navigate` returns before the app hydrates, so this wait is mandatory
3. Click a deal card, then `browser_wait_for` content unique to the deal page (its name in the header)
4. Click through three sidebar sections and confirm each highlights and renders
5. `browser_console_messages` — expect no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/PropertyDetailSidebar.tsx src/routes/_shell/listings/\$listingId.tsx
git commit -m "refactor(deal-nav): let the sidebar render for a record that is not the route's"
```

---

## Task 6: The space route's guard

The child-of-shell check is needed by all 18 sections. Extracted so there is one implementation: 18 hand-written copies would be 18 chances to omit the one that paints a suite's voucher under the wrong building's frame — the bug `ab7b6be` caught.

**Files:**
- Create: `src/data/spaceRoute.ts`
- Create: `src/data/spaceRoute.test.ts`
- Create: `src/components/deals/useSpaceRoute.ts`

**Interfaces:**
- Consumes: `getListing`, `getProperty` from `#/data/store`; `useDataStore` from `#/data/dataStore`.
- Produces:
  ```ts
  export interface SpaceRouteRecord {
    space: Listing
    property: Property
    /** The suite this space markets. Undefined if `unitId` is dangling. */
    unit: PropertyUnit | undefined
    /** The suite's display label, falling back to the deal name. */
    label: string
  }
  export function resolveSpaceRoute(shellId: string, spaceId: string): SpaceRouteRecord | null
  export function useSpaceRoute(shellId: string, spaceId: string): SpaceRouteRecord | null
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/data/spaceRoute.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { resolveSpaceRoute } from './spaceRoute'

function makeShellWithSpace() {
  const shell = createProposalListing({ ...emptyDraft(), name: 'Tower', dealType: 'Lease' })
  const unit = addPropertyUnit(shell.propertyId, { label: 'Suite 305', sqft: 3100, unitType: 'office' })!
  const space = addSpaceToDeal(shell.id, unit.id)!.deal
  return { shell, unit, space }
}

describe('resolveSpaceRoute', () => {
  it('resolves a space that belongs to the shell in the URL', () => {
    const { shell, unit, space } = makeShellWithSpace()
    const found = resolveSpaceRoute(shell.id, space.id)!

    expect(found.space.id).toBe(space.id)
    expect(found.unit!.id).toBe(unit.id)
    expect(found.label).toBe('Suite 305')
  })

  it("refuses a space that belongs to a different shell", () => {
    const a = makeShellWithSpace()
    const b = makeShellWithSpace()
    // b's suite must never render under a's frame: that paints one landlord's
    // money over another's page (ab7b6be).
    expect(resolveSpaceRoute(a.shell.id, b.space.id)).toBeNull()
  })

  it('refuses a listing that is not a space at all', () => {
    const { shell } = makeShellWithSpace()
    expect(resolveSpaceRoute(shell.id, shell.id)).toBeNull()
  })

  it('refuses an id that does not exist', () => {
    const { shell } = makeShellWithSpace()
    expect(resolveSpaceRoute(shell.id, 'no-such-space')).toBeNull()
  })

  it('falls back to the deal name when the unit is missing', () => {
    const { shell, space } = makeShellWithSpace()
    space.unitId = 'dangling-unit-id'
    const found = resolveSpaceRoute(shell.id, space.id)!

    expect(found.unit).toBeUndefined()
    expect(found.label).toBe(space.name)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- src/data/spaceRoute.test.ts`
Expected: FAIL — `Cannot find module './spaceRoute'`.

- [ ] **Step 3: Write the pure resolver**

Create `src/data/spaceRoute.ts`:

```ts
import type { Listing, Property, PropertyUnit } from './types'
import { getListing, getProperty } from './store'

export interface SpaceRouteRecord {
  space: Listing
  property: Property
  /** The suite this space markets. Undefined if `unitId` is dangling. */
  unit: PropertyUnit | undefined
  /** The suite's display label, falling back to the deal name. */
  label: string
}

/**
 * Resolve `/listings/{shellId}/spaces/{spaceId}` to the records a section needs,
 * or null if the URL does not name a real space of that building.
 *
 * The guard is the reason this exists. The `shellId` segment declares which
 * building the page is scoped to, and a space whose parent differs must never
 * render under it — that would paint this suite's voucher and commission over
 * another landlord's frame, the bug `ab7b6be` caught during the reverted panel
 * work. Returning null (rather than redirecting) is deliberate: the store is
 * client-owned, so on a cold load a redirect computed from `parentDealId` would
 * fire against an empty map (`cf5676c`).
 */
export function resolveSpaceRoute(shellId: string, spaceId: string): SpaceRouteRecord | null {
  const space = getListing(spaceId)
  if (!space || space.parentDealId !== shellId) return null
  const property = getProperty(space.propertyId)
  if (!property) return null
  const unit = property.units.find((u) => u.id === space.unitId)
  return { space, property, unit, label: unit?.label ?? space.name }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test -- src/data/spaceRoute.test.ts`
Expected: PASS, all 5.

- [ ] **Step 5: Add the reactive hook**

Create `src/components/deals/useSpaceRoute.ts`:

```ts
import { useDataStore } from "#/data/dataStore";
import { resolveSpaceRoute, type SpaceRouteRecord } from "#/data/spaceRoute";

/**
 * `resolveSpaceRoute`, subscribed to the store.
 *
 * Subscribes to the whole `listings` map rather than `.get(spaceId)`: the guard
 * reads the *parent*, and a space's shape is derived from its siblings, so a
 * `.get()` selector would compare referentially equal and skip re-rendering
 * after a change that matters.
 */
export function useSpaceRoute(shellId: string, spaceId: string): SpaceRouteRecord | null {
  const listings = useDataStore((s) => s.listings);
  const properties = useDataStore((s) => s.properties);
  void listings;
  void properties;
  return resolveSpaceRoute(shellId, spaceId);
}
```

- [ ] **Step 6: Typecheck**

Run: `bunx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/data/spaceRoute.ts src/data/spaceRoute.test.ts src/components/deals/useSpaceRoute.ts
git commit -m "feat(spaces): resolve a space route behind one child-of-shell guard"
```

---

## Task 7: The space page's frame — layout, header, and three sections

Wire three sections end to end before repeating the pattern: `overview`, `details` and `media` together exercise the guard, the sidebar's `basePath`, the breadcrumb's third level, and the Save/Cancel form.

**Files:**
- Create: `src/components/deals/SpaceDetailHeader.tsx`
- Create: `src/components/deals/SpaceDetails.tsx`
- Create: `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx`
- Create: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/index.tsx`
- Create: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/overview.tsx`
- Create: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/details.tsx`
- Create: `src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx`

**Interfaces:**
- Consumes: `useSpaceRoute` (Task 6); `PropertyDetailSidebar` props (Task 5); `dealBreadcrumbTrail`'s `subsectionLabel` (Task 4); existing `DealStageSelect`, `SpaceTermsSection`, `ListingMedia`, `ListingPageHeader`, `TodayPlanner`, `IngestionBanner`, `DealContextRail`, `updateDealMarketing`, `emptySpaceLeaseTerms`, `notify`.
- Produces: the route id `/_shell/listings/$listingId_/spaces/$spaceId` and its children, with params `{ listingId: string; spaceId: string }`.

- [ ] **Step 1: Create the header**

Create `src/components/deals/SpaceDetailHeader.tsx`:

```tsx
import { Link, useLocation } from "@tanstack/react-router";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import type { Listing, Property } from "#/data/types";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
import { DealStageSelect } from "#/components/deals/DealStageSelect";

/**
 * The space page's own header. Deliberately not `PropertyDetailHeader`, which is
 * built around a building's address, publish state, photo and property facts —
 * none of which a suite owns.
 *
 * The building is one crumb away, which is the only way back the page needs; a
 * separate back button a few pixels from the crumb would be noise.
 */
export function SpaceDetailHeader({
  space,
  shell,
  property,
  label,
}: {
  space: Listing;
  shell: Listing;
  property: Property;
  label: string;
}) {
  const { pathname } = useLocation();
  // Read against the *shell's* id: the path is
  // /listings/{shellId}/spaces/{spaceId}/{section}, so the shell is the prefix
  // and the space's own section is the third segment.
  const { subsectionLabel } = dealBreadcrumbTrail(pathname, shell.id);

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <Breadcrumb className="mb-2">
          <Breadcrumb.Item>
            <Breadcrumb.Link render={<Link to="/listings" />}>All Deals</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Breadcrumb.Link
              render={<Link to="/listings/$listingId" params={{ listingId: shell.id }} />}
            >
              {shell.name}
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Breadcrumb.Link
              render={
                <Link to="/listings/$listingId/spaces" params={{ listingId: shell.id }} />
              }
            >
              Spaces
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          {subsectionLabel ? (
            <>
              <Breadcrumb.Item>
                <Breadcrumb.Link
                  render={
                    <Link
                      to="/listings/$listingId/spaces/$spaceId/overview"
                      params={{ listingId: shell.id, spaceId: space.id }}
                    />
                  }
                >
                  {label}
                </Breadcrumb.Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>{subsectionLabel}</Breadcrumb.Item>
            </>
          ) : (
            <Breadcrumb.Item>{label}</Breadcrumb.Item>
          )}
        </Breadcrumb>

        <div className="d-flex align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-semibold mb-0">{label}</h1>
            <div className="text-muted">
              {property.street}, {property.city}, {property.state} {property.zip}
            </div>
          </div>
          <DealStageSelect listing={space} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the layout route**

Create `src/routes/_shell/listings/$listingId_/spaces/$spaceId.tsx`:

```tsx
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { getListing } from "#/data/store";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
import { PropertyDetailSidebar } from "#/components/properties/PropertyDetailSidebar";
import { SpaceDetailHeader } from "#/components/deals/SpaceDetailHeader";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

/**
 * A space deal's page, nested under its building.
 *
 * The trailing underscore on the `$listingId_` directory keeps the URL
 * (`/listings/{shellId}/spaces/{spaceId}/…`) while un-nesting from
 * `$listingId.tsx`'s layout — so the space paints its own header and sidebar
 * instead of rendering inside the building's frame, which is what sank the
 * reverted panel attempt (`c8a84ca`).
 *
 * `validateSearch` declares the union of what any section reads, because search
 * params are inherited by children rather than declared per section. Today that
 * is only `q`, for Leads — a space has no `listing` section, so the `review` param
 * that route validates has no space equivalent.
 */
export const Route = createFileRoute("/_shell/listings/$listingId_/spaces/$spaceId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
  }),
  component: SpaceDetailLayout,
});

function SpaceNotFound({ listingId }: { listingId: string }) {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faVectorSquare} aria-label="Space not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Space not found</Empty.Title>
          This space is not part of this building, or it has been removed.
        </Empty.Content>
        <Empty.Actions>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link to="/listings/$listingId/spaces" params={{ listingId }} />}
          >
            Back to Spaces
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function SpaceDetailLayout() {
  const { listingId, spaceId } = Route.useParams();
  const { pathname } = useLocation();
  const record = useSpaceRoute(listingId, spaceId);
  const shell = getListing(listingId);

  if (!record || !shell) return <SpaceNotFound listingId={listingId} />;

  // The space's current section is the *third* segment, so the sidebar reads
  // `subsectionLabel`; a building reads `sectionLabel` from the same function.
  const { subsectionLabel } = dealBreadcrumbTrail(pathname, listingId);

  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <SpaceDetailHeader
        space={record.space}
        shell={shell}
        property={record.property}
        label={record.label}
      />

      <div className="container d-flex align-items-start gap-4 py-4">
        <Card
          className="shadow flex-shrink-0 position-sticky"
          style={{ width: 180, top: 0 }}
        >
          <PropertyDetailSidebar
            listing={record.space}
            basePath={`/listings/${listingId}/spaces/${spaceId}`}
            activeLabel={subsectionLabel}
          />
        </Card>

        <Card className="flex-grow-1 shadow" style={{ minWidth: 0 }}>
          <Outlet />
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the index redirect**

Create `src/routes/_shell/listings/$listingId_/spaces/$spaceId/index.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/listings/$listingId_/spaces/$spaceId/")({
  beforeLoad: ({ params }) => {
    // A pure param-to-param redirect, so it reads nothing from the store — the
    // `cf5676c` constraint (no store reads in `beforeLoad`) is respected.
    throw redirect({
      to: "/listings/$listingId/spaces/$spaceId/overview",
      params,
    });
  },
});
```

- [ ] **Step 4: Create the Details component**

Create `src/components/deals/SpaceDetails.tsx`:

```tsx
import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { Listing, Property, PropertyUnit, SpaceLeaseTerms } from "#/data/types";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { updateDealMarketing } from "#/data/actions";
import { notify } from "#/lib/notify";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";

/**
 * A space's own marketing form — the Listing slot's occupant for a space deal.
 *
 * These are exactly the fields that used to be edited inline on the building's
 * roster; the roster is a directory now, so this is their single home. Behind a
 * Save button, the same contract the deal edit form uses (`b1aad55`), rather
 * than writing through on every keystroke.
 *
 * Size is held separately from `terms` because it does not live on the terms
 * row: it is `marketing.availableSqFt` on the space's own deal, which is what the
 * publish gate and every display surface read. A `spaceSize` field on the row was
 * removed in `553282a` precisely because nothing read it — do not reintroduce it.
 */
export function SpaceDetails({
  space,
  property,
  unit,
}: {
  space: Listing;
  property: Property;
  unit: PropertyUnit;
}) {
  type Draft = { terms: SpaceLeaseTerms; availableSqFt: number | null };

  const saved: Draft = {
    terms: space.marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(unit.id),
    availableSqFt: space.marketing.availableSqFt || null,
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = draft ?? saved;
  const dirty = draft != null;

  const patch = (next: Partial<Draft>) =>
    setDraft((prev) => ({ ...(prev ?? saved), ...next }));

  const save = () => {
    if (!draft) return;
    updateDealMarketing(space.id, {
      spaceLeaseTerms: [draft.terms],
      // 0 rather than null: `DealMarketing.availableSqFt` is a number, and a
      // cleared field means "no size on record", which the gate reads as unmet.
      availableSqFt: draft.availableSqFt ?? 0,
    });
    setDraft(null);
    notify({ title: "Space details saved" });
  };

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader title="Details" />

      <SpaceTermsSection
        unit={unit}
        property={property}
        terms={current.terms}
        onChange={(termsPatch) =>
          patch({ terms: { ...current.terms, ...termsPatch } })
        }
        availableSqFt={current.availableSqFt}
        onAvailableSqFtChange={(v) => patch({ availableSqFt: v })}
      />

      {/* Cancel ghost, Save primary — the same bar the deal edit form ends with,
          so the two forms behave identically. Disabled until something changes,
          since a Save that does nothing teaches nothing. */}
      <div className="d-flex justify-content-end align-items-center gap-2 border-top mt-3 pt-3">
        {dirty && <span className="text-muted me-auto">Unsaved changes</span>}
        <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(null)}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!dirty} onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the three section routes**

`src/routes/_shell/listings/$listingId_/spaces/$spaceId/overview.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { TodayPlanner } from "#/components/deals/TodayPlanner";
import { DealContextRail } from "#/components/deals/DealContextRail";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/overview",
)({ component: SpaceOverviewRoute });

function SpaceOverviewRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <div className="px-4 py-3">
          <ListingPageHeader title="Overview" />
        </div>
        <TodayPlanner listing={record.space} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-block border-start"
        style={{ width: 340 }}
      >
        <DealContextRail listing={record.space} />
      </div>
    </div>
  );
}
```

`src/routes/_shell/listings/$listingId_/spaces/$spaceId/details.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { SpaceDetails } from "#/components/deals/SpaceDetails";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/details",
)({ component: SpaceDetailsRoute });

function SpaceDetailsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  // The form is keyed to a suite — every field on it describes one. A space whose
  // `unitId` is dangling has nothing to describe, so it says so rather than
  // rendering a form bound to nothing.
  if (!record.unit) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No suite" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>This space is not linked to a suite</Empty.Title>
            Its details are edited against a unit on the property record, and that
            unit is missing.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return (
    <SpaceDetails
      space={record.space}
      property={record.property}
      unit={record.unit}
    />
  );
}
```

`src/routes/_shell/listings/$listingId_/spaces/$spaceId/media.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ListingMedia } from "#/components/listings/ListingMedia";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/media",
)({ component: SpaceMediaRoute });

function SpaceMediaRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <ListingMedia listing={record.space} />;
}
```

- [ ] **Step 6: Regenerate the route tree and typecheck**

Run: `bun --bun run dev` (background — it regenerates `src/routeTree.gen.ts` on start), then:

Run: `bunx tsc --noEmit`
Expected: clean. If route ids are unknown, the tree did not regenerate — confirm the dev server started and that `src/routeTree.gen.ts` now mentions `spaces/$spaceId`.

Run: `grep -c 'spaces/\$spaceId' src/routeTree.gen.ts`
Expected: a non-zero count.

- [ ] **Step 7: Verify the page in the browser**

With the `playwright` MCP server:
1. `browser_navigate` to `http://localhost:3000/listings`
2. `browser_wait_for` text `"Displaying 20 of 20 Deals"`
3. Open the Meridian Business Park deal (dealId 107), go to its Spaces section, and read a space deal's id from the page — or navigate directly once you know it
4. `browser_navigate` to `/listings/{shellId}/spaces/{spaceId}/details`
5. `browser_wait_for` text `"Details"`, scoped to `main.app-shell__main`
6. Confirm: the suite label is the page title, the breadcrumb reads All Deals / {building} / Spaces / {suite} / Details, the sidebar shows Details and **not** Listing, and the building's own header is absent
7. Edit Lease Rate, click Save, confirm the toast and that the value persists across a reload
8. Click the building crumb and confirm it lands on the building
9. `browser_console_messages` — expect no errors

- [ ] **Step 8: Commit**

```bash
git add src/components/deals/SpaceDetailHeader.tsx src/components/deals/SpaceDetails.tsx src/routes/_shell/listings/\$listingId_ src/routeTree.gen.ts
git commit -m "feat(spaces): give a space deal its own page under its building"
```

---

## Task 8: The remaining 15 section routes

Each is the same wrapper as its building counterpart, reading `spaceId` through `useSpaceRoute`. Create all 15 under `src/routes/_shell/listings/$listingId_/spaces/$spaceId/`.

**Files:** Create 15 route files (listed in the table below).

**Interfaces:**
- Consumes: `useSpaceRoute` (Task 6). Every component below already exists and already takes a plain `Listing` or `Property`.
- Produces: the 15 remaining route ids under `/_shell/listings/$listingId_/spaces/$spaceId/`.

- [ ] **Step 1: Create the twelve that need only the listing**

For each row, create `<slug>.tsx` from this template, substituting **Route id**, **Component** and its import:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ListingWebsite } from "#/components/listings/ListingWebsite";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/website",
)({ component: SpaceWebsiteRoute });

function SpaceWebsiteRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <ListingWebsite listing={record.space} />;
}
```

| Slug | Component | Import from |
|---|---|---|
| `website` | `<ListingWebsite listing={record.space} />` | `#/components/listings/ListingWebsite` |
| `email` | `<ListingEmail listing={record.space} />` | `#/components/listings/ListingEmail` |
| `demographics` | `<ListingDemographics listing={record.space} />` | `#/components/listings/ListingDemographics` |
| `grids` | `<GridsPage listing={record.space} />` | `#/components/grids/GridsPage` |
| `underwriting` | `<DealUnderwritingTab listing={record.space} />` | `#/components/deals/underwriting/DealUnderwritingTab` |
| `financials` | `<DealFinancials listing={record.space} heading={\`Voucher — ${record.label}\`} />` | `#/components/deals/DealFinancials` |
| `financial-documents` | `<DealInvoices listing={record.space} heading={\`Invoices — ${record.label}\`} />` | `#/components/deals/DealInvoices` |
| `documents` | `<PropertyDetailDocuments listingId={spaceId} />` | `#/components/properties/PropertyDetailDocuments` |
| `files` | `<PropertyDetailFiles listingId={spaceId} />` | `#/components/properties/PropertyDetailFiles` |
| `notes` | `<DealPagePlaceholder title="Notes" icon={faNoteSticky} />` | `#/components/deals/DealPagePlaceholder`, icon from `@fortawesome/pro-regular-svg-icons` |
| `history` | `<DealPagePlaceholder title="History" icon={faClockRotateLeft} />` | same, icon `faClockRotateLeft` |
| `client-report` | `<ListingClientReport listing={record.space} property={record.property} />` | `#/components/listings/ListingClientReport` |

Every import path above is verified against the building's counterpart route, so it can be used as written. `notes` and `history` additionally need their icon import from `@fortawesome/pro-regular-svg-icons` (`faNoteSticky` / `faClockRotateLeft`).

- [ ] **Step 2: Create `leads`, which reads a search param**

`leads.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/leads",
)({ component: SpaceLeadsRoute });

function SpaceLeadsRoute() {
  const { listingId, spaceId } = Route.useParams();
  // `q` is validated on the `$spaceId` layout route and inherited here, because
  // search params are declared once per route branch rather than per section.
  const { q } = Route.useSearch();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  return (
    <PropertyDetailLeads
      property={record.property}
      initialSearch={q}
      // Leads are scoped by which listing a contact's `inquiredListingIds`
      // names, and this space deal IS one such listing — so the building's leads
      // arrive filtered to the inquiries about this suite.
      spaceDealId={record.space.id}
    />
  );
}
```

- [ ] **Step 3: Create `activities`, which has a rail**

`activities.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { DealActivity } from "#/components/deals/DealStubs";
import { DealMessagesRail } from "#/components/deals/DealMessagesRail";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/activities",
)({ component: SpaceActivitiesRoute });

function SpaceActivitiesRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  return (
    <div className="d-flex align-items-stretch">
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <DealActivity listing={record.space} />
      </div>
      <div
        className="flex-shrink-0 d-none d-xl-flex border-start"
        style={{ width: 420 }}
      >
        <DealMessagesRail listingId={spaceId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `plans`**

`plans.tsx` — copy the body of `src/routes/_shell/listings/$listingId/plans.tsx` verbatim, changing only the route id to `/_shell/listings/$listingId_/spaces/$spaceId/plans`, the component name to `SpacePlansRoute`, and the guard to:

```tsx
  const { listingId, spaceId } = Route.useParams();
  if (!useSpaceRoute(listingId, spaceId)) return null;
```

- [ ] **Step 5: Regenerate and typecheck**

Run: `bun --bun run dev` (background, to regenerate the tree), then `bunx tsc --noEmit`
Expected: clean.

Run: `bun --bun run test`
Expected: all pass.

- [ ] **Step 6: Verify every sidebar item resolves**

With the `playwright` MCP server, on a space page: click every item in the sidebar and confirm each renders content and none blanks the page. `browser_console_messages` after the sweep — expect no errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_shell/listings/\$listingId_ src/routeTree.gen.ts
git commit -m "feat(spaces): bring every remaining section onto the space page"
```

---

## Task 9: The roster becomes a suite directory

**Files:**
- Modify: `src/routes/_shell/listings/$listingId/spaces.tsx` (rewrite the body)

**Interfaces:**
- Consumes: `buildingSuites` / `SuiteRow` (Task 2); the space route ids (Tasks 7–8); existing `isLeaseParent`, `canAddSpaces`, `addSpaceToDeal`, `updateDealMarketing`, `emptySpaceLeaseTerms`, `getListing`, `getProperty`, `notify`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Replace the route with the directory**

Rewrite `src/routes/_shell/listings/$listingId/spaces.tsx`:

```tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus, faAngleRight } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing } from "#/data/store";
import { buildingSuites, type SuiteRow } from "#/data/buildingSuites";
import { canAddSpaces, isLeaseParent } from "#/data/dealShape";
import { addSpaceToDeal } from "#/data/leaseSpaces";
import { updateDealMarketing } from "#/data/actions";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { notify } from "#/lib/notify";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";

export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  component: SpacesTab,
});

/** Status colour: what the building can still transact reads neutral; a suite
 *  someone else is sitting in reads muted, because it is not actionable here. */
function statusVariant(status: SuiteRow["status"]) {
  if (status === "Available") return "success" as const;
  if (status === "Under Contract") return "warning" as const;
  if (status === "Leased" || status === "Occupied") return "secondary" as const;
  return "outline" as const;
}

function SuiteTenant({ row, shellId }: { row: SuiteRow; shellId: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.tenantName ?? "");

  const commit = () => {
    const shell = getListing(shellId);
    if (!shell) return;
    const rows = shell.marketing.spaceLeaseTerms ?? [];
    const next = value.trim();
    // A blank override is removed rather than stored, so the shell never
    // accumulates rows holding nothing and the row falls back to the unit's own
    // tenant name. This is the only way a shell reacquires space terms, and it
    // holds exactly one field's worth.
    const withoutUnit = rows.filter((t) => t.unitId !== row.unitId);
    const existing = rows.find((t) => t.unitId === row.unitId);
    updateDealMarketing(shellId, {
      spaceLeaseTerms: next
        ? [
            ...withoutUnit,
            { ...(existing ?? emptySpaceLeaseTerms(row.unitId)), tenantName: next },
          ]
        : withoutUnit,
    });
    setEditing(false);
    notify({ title: "Tenant name saved" });
  };

  if (!editing) {
    return (
      <button
        type="button"
        className="border-0 bg-transparent p-0 text-start text-muted"
        style={{ cursor: "pointer" }}
        onClick={() => setEditing(true)}
      >
        {row.tenantName ?? "Add tenant name"}
        {row.leaseExpiration ? ` · thru ${row.leaseExpiration}` : ""}
      </button>
    );
  }

  return (
    <span className="d-inline-flex align-items-center gap-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        style={{ width: 220 }}
      />
    </span>
  );
}

function SpacesTab() {
  const { listingId } = Route.useParams();
  const navigate = useNavigate();
  // Subscribe to both maps: a row is a join of a unit (properties) and its deal
  // (listings), so either changing must re-render.
  void useDataStore((s) => s.listings);
  void useDataStore((s) => s.properties);
  const listing = getListing(listingId);
  // Whether this deal has a Spaces section at all — a top-level lease deal,
  // regardless of stage. Separate from canAddSpaces: a Lost shell keeps the
  // section, it just cannot accept new suites.
  const leaseParent = isLeaseParent(listing);
  const canAddSpace = listing ? canAddSpaces(listing) : false;
  const rows = buildingSuites(listingId);
  const [addOpen, setAddOpen] = useState(false);

  const startDeal = (unitId: string) => {
    const created = addSpaceToDeal(listingId, unitId);
    if (!created) return;
    void navigate({
      to: "/listings/$listingId/spaces/$spaceId/details",
      params: { listingId, spaceId: created.deal.id },
    });
  };

  if (!leaseParent) {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="Not eligible" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>Spaces are only for lease representation deals</Empty.Title>
            Only top-level landlord-rep lease deals can be split into spaces.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="fs-6 fw-semibold mb-0">Spaces</h2>
        {canAddSpace && (
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            <FontAwesomeIcon icon={faPlus} /> Add space
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No suites" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No suites on this property yet</Empty.Title>
            Add a space to put a suite on the building and start its deal.
          </Empty.Content>
          {canAddSpace && (
            <Empty.Actions>
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                <FontAwesomeIcon icon={faPlus} /> Add space
              </Button>
            </Empty.Actions>
          )}
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {rows.map((row) => {
            const shared = (
              <>
                <span className="fw-semibold">{row.label}</span>
                <span className="text-muted">{row.sqft.toLocaleString()} SF</span>
                <span className="text-muted">
                  {row.leaseRate != null
                    ? `$${row.leaseRate} ${row.leaseRateUnits}`
                    : ""}
                </span>
                <span className="ms-auto d-flex align-items-center gap-3">
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </span>
              </>
            );

            // A suite with a deal is a link to that deal's page. A suite without
            // one is not — there is nowhere to go, so the row carries whatever
            // action it does support instead.
            if (row.dealId) {
              return (
                <Link
                  key={row.unitId}
                  to="/listings/$listingId/spaces/$spaceId/overview"
                  params={{ listingId, spaceId: row.dealId }}
                  className="d-flex align-items-center gap-3 border rounded p-3 text-decoration-none text-body"
                >
                  {shared}
                  <FontAwesomeIcon icon={faAngleRight} className="text-muted" />
                </Link>
              );
            }

            return (
              <div
                key={row.unitId}
                className="d-flex align-items-center gap-3 border rounded p-3"
              >
                {shared}
                {row.status === "Occupied" ? (
                  <SuiteTenant row={row} shellId={listingId} />
                ) : (
                  canAddSpace && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startDeal(row.unitId)}
                    >
                      Start a deal
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddSpaceModal
        parentDealId={listingId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />
    </div>
  );
}
```

Note what is gone: `?space=` and its `validateSearch`, the `Collapsible` rows, the per-row draft state, `SpaceTermsSection`, `DealStageSelect` and the Voucher button. Stage now lives on the space page's header, terms on its Details section.

- [ ] **Step 2: Typecheck and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: clean. Any test asserting on `?space=` needs updating — search with `grep -rn 'space=' src --include='*.test.ts'`.

- [ ] **Step 3: Verify the three row kinds and both actions**

With the `playwright` MCP server, on Meridian Business Park's Spaces section:
1. `browser_wait_for` text `"Spaces"` scoped to `main.app-shell__main`
2. Confirm six rows: four with deals and a status badge, one **Occupied** with a tenant name and expiry, one **Vacant** with **Start a deal**
3. Click a deal-bearing row → lands on that space's Overview
4. Back, click **Start a deal** on the vacant row → lands on the new space's Details, and the row now links instead
5. Click the occupied row's tenant name, type a different name, press Enter → it persists across a reload; clear it and confirm it falls back to the unit's own name
6. `browser_console_messages` — expect no errors

- [ ] **Step 4: Commit**

```bash
git add src/routes/_shell/listings/\$listingId/spaces.tsx
git commit -m "feat(spaces): make the roster a directory of every suite"
```

---

## Task 10: Shrink `AddSpaceModal` to its real job

Vacant rows now carry their own Start-a-deal, so the existing-units checkbox list is redundant — and its "hide units that already have a deal" filter was standing in for the directory Task 9 built.

**One consequence to be deliberate about:** with the picker gone, the directory's Start-a-deal button is the *only* path to a deal on a suite already on the building. Since Task 9 gives occupied rows no such button, phase 1 ends up making a deal on an occupied suite impossible rather than merely unoffered. That matches the stated intent — deals belong on unoccupied spaces — and it needs no gate, guard or validation to enforce, because it falls out of which affordances exist. Do not add one. Whether it should become a real rule is the Phase 2 backlog item on blockability.

**Files:**
- Modify: `src/components/deals/AddSpaceModal.tsx`

**Interfaces:**
- Consumes: existing `addPropertyUnit`, `addSpaceToDeal`.
- Produces: unchanged props — `{ parentDealId, open, onOpenChange, onAdded? }`.

- [ ] **Step 1: Remove the picker, keep the new-suite form**

In `src/components/deals/AddSpaceModal.tsx`:
- Delete the `usedUnitIds` memo, `availableUnits`, the `checked` state, `toggle`, the `Checkbox` import, the `getChildDeals` import, and the whole "Property units" block in `Modal.Body`.
- Update `canAdd`:

```tsx
  const canAdd = newLabel.trim().length > 0 && (newSqft ?? 0) > 0;
```

- Update `commit` to drop the checked-unit loop:

```tsx
  const commit = () => {
    if (!canAdd) return;
    // A suite added here is being added *in order to* market it, so it starts
    // vacant. The unit lands on the property record first, then gets its deal —
    // the case this modal exists for is a broker who learns a suite was carved
    // out of the building.
    const unit = addPropertyUnit(deal.propertyId, {
      label: newLabel.trim(),
      sqft: newSqft as number,
      unitType: newType,
    });
    if (unit) addSpaceToDeal(parentDealId, unit.id);
    onOpenChange(false);
    onAdded?.();
  };
```

- Update `Modal.Description` to match what it now does:

```tsx
          <Modal.Description>
            Add a suite to {property.name} and start its deal. Suites already on
            the property are listed on the Spaces page.
          </Modal.Description>
```

- Remove the now-redundant `<div className="fw-semibold mb-2">` "New space" heading and the `border-top pt-3` wrapper, since the form is the modal's only content.

- [ ] **Step 2: Typecheck and test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: clean, with no unused-import errors.

- [ ] **Step 3: Verify**

With the `playwright` MCP server: open **Add space** from the Spaces page, add "Suite 950" at 1500 SF, confirm the modal closes, a new row appears in label order, and it links to a space page. `browser_console_messages` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/deals/AddSpaceModal.tsx
git commit -m "refactor(spaces): narrow Add space to suites not yet on the building"
```

---

## Task 11: Point every space link at the space page

`dealCardLink.ts` is the single rule for where a deal card goes, and `dealCardLink.invariant.test.ts` scans the source tree to keep it that way. That makes this sweep small — but the invariant test's *premise* inverts, so it needs rewriting rather than deleting.

**Files:**
- Modify: `src/components/deals/dealCardLink.ts`
- Modify: `src/ai/tools.ts` (`rewriteSpaceDealPath`)
- Modify: `src/components/deals/StageGate.tsx` (~line 590)
- Modify: `src/routes/_shell/listings/$listingId/vouchers.tsx`
- Modify: `src/components/deals/DealContextRail.tsx`
- Modify: `src/components/deals/dealCardLink.invariant.test.ts`
- Test: `src/components/deals/dealCardLink.test.ts`, `src/ai/clientTools.test.ts`

**Interfaces:**
- Consumes: the space route ids (Tasks 7–8).
- Produces:
  ```ts
  export function dealCardLinkProps(listing: Listing):
    | { to: "/listings/$listingId"; params: { listingId: string } }
    | {
        to: "/listings/$listingId/spaces/$spaceId/overview";
        params: { listingId: string; spaceId: string };
      }
  ```
  `buildingSectionListingId(listingId)` is **unchanged** — it answers "which page owns a building-level section", and in phase 1 that is still the building.

- [ ] **Step 1: Write the failing tests**

In `src/components/deals/dealCardLink.test.ts`, replace the space-case assertions with:

```ts
  it("sends a space to its own page under its building", () => {
    const props = dealCardLinkProps({ id: "S9", parentDealId: "L1" } as never);
    expect(props).toEqual({
      to: "/listings/$listingId/spaces/$spaceId/overview",
      params: { listingId: "L1", spaceId: "S9" },
    });
  });

  it("sends a non-space to its own deal page", () => {
    const props = dealCardLinkProps({ id: "L1", parentDealId: null } as never);
    expect(props).toEqual({ to: "/listings/$listingId", params: { listingId: "L1" } });
  });
```

In `src/ai/clientTools.test.ts`, replace the `rewriteSpaceDealPath` space cases with:

```ts
  it("rewrites a space's bare deal path to its page under its building", () => {
    expect(rewriteSpaceDealPath(`/listings/${spaceId}`)).toBe(
      `/listings/${shellId}/spaces/${spaceId}/overview`,
    );
  });

  it("keeps the section when rewriting a space's sectioned path", () => {
    expect(rewriteSpaceDealPath(`/listings/${spaceId}/leads`)).toBe(
      `/listings/${shellId}/spaces/${spaceId}/leads`,
    );
  });
```

Keep the existing pass-through cases (a building, an unknown id, a path with a query or hash) exactly as they are.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun --bun run test -- src/components/deals/dealCardLink.test.ts src/ai/clientTools.test.ts`
Expected: FAIL — both still produce roster targets.

- [ ] **Step 3: Update `dealCardLinkProps`**

Replace the function and its doc comment in `src/components/deals/dealCardLink.ts`:

```ts
/**
 * Where a card for this deal should go. A space deal has its own page, nested
 * under its building, so a space card opens that page rather than the building's
 * suite directory. Every card surface shares this one rule, so a space can never
 * lose its page by way of an un-updated link.
 */
export function dealCardLinkProps(listing: Listing):
  | { to: "/listings/$listingId"; params: { listingId: string } }
  | {
      to: "/listings/$listingId/spaces/$spaceId/overview";
      params: { listingId: string; spaceId: string };
    } {
  if (listing.parentDealId) {
    return {
      to: "/listings/$listingId/spaces/$spaceId/overview",
      params: { listingId: listing.parentDealId, spaceId: listing.id },
    };
  }
  return { to: "/listings/$listingId", params: { listingId: listing.id } };
}
```

Leave `buildingSectionListingId` untouched, and update only the second sentence of its comment if needed — its contract has not changed.

- [ ] **Step 4: Update `rewriteSpaceDealPath`**

In `src/ai/tools.ts`:

```ts
export function rewriteSpaceDealPath(path: string): string {
  const match = /^\/listings\/([^/?#]+)(\/[^?#]*)?$/.exec(path);
  if (!match) return path;
  const [, listingId, section] = match;
  const buildingId = getListing(listingId)?.parentDealId;
  if (!buildingId) return path;
  // A space's sections live under its own page, so the section survives the
  // rewrite rather than being handed to the building.
  const leaf = !section || section === "/" ? "/overview" : section;
  return `/listings/${buildingId}/spaces/${listingId}${leaf}`;
}
```

Update the function's doc comment: it no longer sends a section to the building, and there is no `?space=` riding in the path string.

- [ ] **Step 5: Update the publish gate's "Back to editing"**

In `src/components/deals/StageGate.tsx`, replace the space branch of the navigate call:

```tsx
                void navigate(
                  deal.parentDealId
                    ? {
                        // A space's marketing fields live on its own Details
                        // page — the Listing slot's occupant for a space.
                        to: "/listings/$listingId/spaces/$spaceId/details",
                        params: { listingId: deal.parentDealId, spaceId: deal.id },
                      }
                    : {
                        to: "/listings/$listingId/listing",
                        params: { listingId: deal.id },
                      },
                );
```

Update the comment above it — a space's terms are no longer on the roster.

- [ ] **Step 6: Point the Vouchers index rows at the space page**

In `src/routes/_shell/listings/$listingId/vouchers.tsx`, change each row's link target from `/listings/$listingId/vouchers/$spaceId` to:

```tsx
                to="/listings/$listingId/spaces/$spaceId/financials"
                params={{ listingId, spaceId: row.dealId }}
```

- [ ] **Step 7: Restore the parent link on the context rail**

Recover the deleted component: `git show 86990cc:src/components/deals/DealContextRail.tsx > /tmp/rail-old.tsx`, then port its `LinkedParentDeal` section and the parent lookup it needs into the current `DealContextRail.tsx`. Point its link at `/listings/$listingId` with the parent's id — the parent is a building and has an ordinary deal page.

- [ ] **Step 8: Rewrite the invariant test's premise**

In `src/components/deals/dealCardLink.invariant.test.ts`, replace the file's opening doc comment. Keep the mechanism, the `LINK_FORMS` array, the `ALLOWED` map and all three assertions exactly as they are — only the *reason* changes:

```ts
/**
 * A space deal's page lives under its building, at
 * `/listings/{shellId}/spaces/{spaceId}`. Nothing at the route level enforces
 * that a link uses it — so *the links are the enforcement*, and a link that
 * assumes `/listings/{spaceId}` lands on a page that renders the space as though
 * it were a building.
 *
 * That makes a link the whole invariant, and links drift silently: the sweep that
 * was supposed to fix them all grepped for `to="/listings/$listingId"` and so
 * missed every object-form navigate, every template literal, every sub-route and
 * every raw anchor — fourteen live sites, two of them in the flow the change was
 * about.
 *
 * So this test reads the source. Any file that builds a deal-page target has to
 * be on the list below, with a reason. A new one fails here rather than in a
 * demo. It is deliberately blunt: the point is to be loud, not clever.
 */
```

Also update `GUIDANCE` so its advice matches:

```ts
const GUIDANCE = [
  "This file builds a link to a deal page, and a space deal's page lives under its",
  "building at /listings/{shellId}/spaces/{spaceId}.",
  "Route it through `dealCardLinkProps(listing)` to open a deal, or",
  "`buildingSectionListingId(id)` for a building-level section such as Documents or",
  "Leads. If the site genuinely cannot receive a space, add it to ALLOWED in this",
  "file with the reason.",
].join("\n");
```

`ALLOWED` may need one added entry (`DealContextRail.tsx`, from Step 7) — the test's third assertion will tell you.

- [ ] **Step 9: Run the tests**

Run: `bun --bun run test`
Expected: all pass. If the invariant test reports an unexpected file, add it to `ALLOWED` with a real reason or route it through a resolver. If it reports a stale entry, remove it.

Run: `bunx tsc --noEmit`
Expected: clean.

- [ ] **Step 10: Verify the flows**

With the `playwright` MCP server:
1. `/listings` → `browser_wait_for` `"Displaying 20 of 20 Deals"` → click a **space** card (it carries a Space chip) → confirm it lands on the space's page, not the building's
2. On a shell, open Vouchers → click a row → confirm it lands on that space's Voucher section
3. On a space, move its stage to trigger the publish gate → **Back to editing** → confirm it lands on the space's Details
4. `browser_console_messages` — expect no errors

- [ ] **Step 11: Commit**

```bash
git add src/components/deals/dealCardLink.ts src/components/deals/dealCardLink.test.ts src/components/deals/dealCardLink.invariant.test.ts src/ai/tools.ts src/ai/clientTools.test.ts src/components/deals/StageGate.tsx src/routes/_shell/listings/\$listingId/vouchers.tsx src/components/deals/DealContextRail.tsx
git commit -m "feat(links): send every space link to the space's own page"
```

---

## Task 12: Delete the vouchers detail route

Last, so nothing is removed before its replacement works. `/listings/{shellId}/vouchers/{spaceId}` is now a duplicate of the space page's own `financials` section.

**Files:**
- Delete: `src/routes/_shell/listings/$listingId/vouchers/$spaceId.tsx`

- [ ] **Step 1: Confirm nothing links to it**

Run: `grep -rn 'vouchers/\$spaceId' src --include='*.tsx' --include='*.ts' | grep -v routeTree.gen`
Expected: no results outside the route file itself. If any remain, fix them before deleting.

- [ ] **Step 2: Delete it and regenerate**

```bash
git rm src/routes/_shell/listings/\$listingId/vouchers/\$spaceId.tsx
```

Then restart `bun --bun run dev` so `src/routeTree.gen.ts` regenerates without it.

- [ ] **Step 3: Verify**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: clean.

Run: `grep -c 'vouchers/\$spaceId' src/routeTree.gen.ts`
Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add -A src/routes src/routeTree.gen.ts
git commit -m "refactor(vouchers): drop the per-space detail the space page replaces"
```

---

## Task 13: Pin the nav against the routes, then verify the whole flow

The sidebar navigates with an interpolated string (`${basePath}/${item.href}`), so a nav item pointing at a section that has no route is a runtime blank page, not a compile error. This test is what catches that.

**Files:**
- Create: `src/components/properties/spaceNavRoutes.test.ts`

**Interfaces:**
- Consumes: `visibleNavGroups` (Task 4); the space route files (Tasks 7–8).

- [ ] **Step 1: Write the test**

Create `src/components/properties/spaceNavRoutes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { visibleNavGroups } from "./dealNav";

/**
 * Every nav item a space shows must have a route file, and every route file must
 * be reachable from the nav.
 *
 * The sidebar builds its targets by interpolation — `${basePath}/${item.href}` —
 * so TypeScript cannot check them. A nav item whose section has no route is a
 * blank page in a demo; a route no nav item points at is dead code. This test is
 * what per-route typing does not give us.
 */

const SPACE_ROUTES_DIR = fileURLToPath(
  new URL("../../routes/_shell/listings/$listingId_/spaces/$spaceId/", import.meta.url),
);

const routeSlugs = readdirSync(SPACE_ROUTES_DIR)
  .filter((f) => f.endsWith(".tsx") && f !== "index.tsx")
  .map((f) => f.replace(/\.tsx$/, ""))
  .sort();

const navHrefs = visibleNavGroups("space", {
  leaseParent: false,
  showsUnderwriting: true,
})
  .flatMap((g) => g.items.map((i) => i.href))
  .sort();

describe("a space's nav and its routes", () => {
  it("has a route for every nav item", () => {
    const missing = navHrefs.filter((href) => !routeSlugs.includes(href));
    expect(
      missing,
      "These sections are in a space's sidebar with no route file, so clicking them blanks the page.",
    ).toEqual([]);
  });

  it("has a nav item for every route", () => {
    const unreachable = routeSlugs.filter((slug) => !navHrefs.includes(slug));
    expect(
      unreachable,
      "These space routes exist but no nav item points at them. Either add the nav item or delete the route.",
    ).toEqual([]);
  });

  it("finds the routes it is looking for at all", () => {
    // A guard on the guard: if the directory moved, both assertions above would
    // pass on empty sets.
    expect(routeSlugs.length).toBe(18);
    expect(routeSlugs).toContain("details");
    expect(routeSlugs).not.toContain("listing");
  });
});
```

- [ ] **Step 2: Run it**

Run: `bun --bun run test -- src/components/properties/spaceNavRoutes.test.ts`
Expected: PASS. A failure names exactly which slug is missing or unreachable — fix the route or the nav item, not the test.

- [ ] **Step 3: Run every gate**

Run: `bunx tsc --noEmit`
Expected: no errors. This is the only typecheck gate — `vite build` does not type-check.

Run: `bun --bun run test`
Expected: all pass. Ignore the biome output and the one react/module Vitest stderr line — neither is a gate.

Run: `bun --bun run build`
Expected: succeeds. This also regenerates `src/routeTree.gen.ts`; if it changes, commit it.

- [ ] **Step 4: Walk the whole flow in the browser**

Delete the IndexedDB database first, or the version-38 seed never loads and you will be reviewing stale data. The MCP server runs `--isolated`, so a fresh session re-seeds — but confirm the new suites are actually present before trusting what you see.

With the `playwright` MCP server:
1. `browser_navigate` to `http://localhost:3000/listings`, `browser_wait_for` `"Displaying 20 of 20 Deals"`
2. Click the space card for a Meridian suite → lands on the space page
3. Set its stage through the gate → confirm the gate opens and commits
4. Details → change Lease Rate → Save → toast, and the value survives a reload
5. Breadcrumb to the building → Spaces → confirm six rows: four with deals, one Occupied with a tenant and expiry, one Vacant
6. **Start a deal** on the vacant row → lands on the new space's Details, and the directory row now links
7. Edit the occupied row's tenant name → persists; clear it → falls back to the unit's name
8. Vouchers → a row → lands on that space's Voucher section
9. `browser_console_messages` after the walk — expect no errors

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/spaceNavRoutes.test.ts src/routeTree.gen.ts
git commit -m "test(spaces): pin a space's nav against the routes behind it"
```

---

## Deferred to Phase 2

Recorded in the spec's *Phase 2 backlog* and deliberately **not** in this plan:

- **Marketing divergence.** A space holds a clone of the building's marketing (`addSpaceToDeal` spreads `...parent.marketing`), and seven sections a space now renders read and write that clone: `media`, `website`, `email`, `documents`, `grids`, `plans`, `demographics`. Editing them on a space diverges it from the building. Excluding `listing` removed the largest instance; these ship as-is.
- The full building-vs-space scope table for all 17 inherited sections.
- Duplicate URLs for the same content, and whether `buildingSectionListingId`'s contract changes.
- Whether an occupied suite should be blockable rather than merely unoffered; whether the Vouchers index survives; whether `dealShape`'s `flat-lease` → `shell` flip still reads correctly against a directory that lists deal-less units.
