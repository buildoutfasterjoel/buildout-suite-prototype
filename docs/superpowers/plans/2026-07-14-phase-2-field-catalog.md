# Phase 2 — Field Catalog & Source-of-Truth Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Property record the single source of truth and the Deal (`= Listing`) a thin engagement object — nest deal fields by home (`marketing`/`financials`/`transaction`), remove property facts duplicated onto the deal, and add `PropertyUnit`/`PropertyFinancialRecord` + a `selectDealWithProperty` resolver.

**Architecture:** Additive-then-remove refactor so `bunx tsc --noEmit` and `vitest run` stay green after every task. New nested structures are added alongside the existing flat fields and populated in seed; consumers migrate group-by-group to the new paths; the deprecated flat `Listing` fields are removed only in the final task. Property changes are purely additive (flat current-headline actuals stay; `financialRecords[]` adds dated history). The document editor and all Property-facts consumers are untouched.

**Tech Stack:** React 19 · TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`) · TanStack Start · Zustand store (`src/data/dataStore.ts`) · Vitest · `@faker-js/faker` (deterministic seed) · Bun.

## Global Constraints

- Package manager is **Bun**; run everything via `bun --bun run …`.
- Typecheck command: **`bunx tsc --noEmit`** (strict; `noUnusedLocals`/`noUnusedParameters` — remove now-unused imports/locals as you migrate).
- Test command: **`bun --bun run test`** (`vitest run`).
- `src/routes/routeTree.gen.ts` is auto-generated — never edit it.
- Do **not** use Playwright. Run tests/typecheck; ask the user to test UI in-browser.
- FontAwesome: default `pro-regular`; never pass `fixedWidth`.
- The Property record is the single source of truth; a Deal duplicates **no** property facts — it reads them through `propertyId`.
- Property edits to `types.ts`/`seed.ts` this phase are **additive only** (no flat Property field is removed or renamed).
- Keep commits small — one per task step group as indicated.

---

## File Structure

**Modified:**
- `src/data/types.ts` — new types + nested `Listing` groups + additive `Property` fields; remove stale `DataStore`.
- `src/data/store.ts` — `getStore()` return type reconciliation; add `latestFinancialRecord` is **not** here (see selectors).
- `src/data/selectors.ts` — add `selectDealWithProperty`, `latestFinancialRecord`; migrate `DealSummary` mapping + `searchAll`.
- `src/data/seed.ts` — generate units, financial records, nested deal groups; bump nothing (version lives in persistence).
- `src/data/createListing.ts` — build nested deal groups; add property units/records to the stub.
- `src/data/persistence.ts` — bump `SEED_VERSION` 4 → 5 (final task).
- Consumer files (per group, exact sites listed in each task):
  `src/components/deals/{DealCard,DealOverview,DealFinancials,DealContextRail,TodayPlanner}.tsx`,
  `src/components/properties/{PropertyCard,PropertyDetailHeader,PropertyMapInner}.tsx`,
  `src/components/listings/{ListingDemographics,ListingEmail}.tsx`,
  `src/components/dashboard/YourListingsSection.tsx`,
  `src/components/search/OmniSearch.tsx`,
  `src/data/listingWebsiteSettings.ts`, `src/ai/tools.ts`, `src/routes/listings/index.tsx`.
- `src/components/properties/propertyIndexFilters.test.ts` — Property mock (additive fields; it casts `as unknown as Property`, so only touched if needed).

**Created:** none (all types live in `types.ts`; resolver in `selectors.ts`).

---

## Task 1: Reconcile stale `DataStore` type → `DataSlice`

**Files:**
- Modify: `src/data/types.ts:410-415` (remove `DataStore` interface)
- Modify: `src/data/store.ts:1-26` (import + `getStore` return type)
- Test: `src/data/store.test.ts` (existing)

**Interfaces:**
- Consumes: `DataSlice` from `src/data/dataStore.ts` (has `properties, listings, comps, contacts, dealFiles, emails, callLists`).
- Produces: `getStore(): Pick<DataSlice, 'properties' | 'listings' | 'comps' | 'contacts'>` — an `EntityMaps` alias exported from `types.ts`.

- [ ] **Step 1: Replace the stale `DataStore` interface with an `EntityMaps` alias in `types.ts`**

In `src/data/types.ts`, replace lines 410-415:

```ts
export interface DataStore {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
}
```

with:

```ts
/**
 * The four core entity maps, as returned by `getStore()`. This is the subset of
 * the live `DataSlice` (`src/data/dataStore.ts`) that read-side helpers need —
 * `dealFiles`/`emails`/`callLists` are accessed through their own helpers.
 */
export interface EntityMaps {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
}
```

- [ ] **Step 2: Point `store.ts` at `EntityMaps`**

In `src/data/store.ts`, change the import (line 2) from `DataStore,` to `EntityMaps,` and update `getStore` (lines 23-26):

```ts
/** Live view of the four core entity maps from the Zustand store. */
export function getStore(): EntityMaps {
  const { properties, listings, comps, contacts } = useDataStore.getState()
  return { properties, listings, comps, contacts }
}
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors (no other file imported the `DataStore` type — verified: only `store.ts` did).

- [ ] **Step 4: Test**

Run: `bun --bun run test`
Expected: PASS (all existing suites, incl. `store.test.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/data/store.ts
git commit -m "refactor(data): replace stale DataStore type with EntityMaps"
```

---

## Task 2: Add Property children types + additive Property fields + seed

**Files:**
- Modify: `src/data/types.ts` (add `PropertyUnit`, `PropertyFinancialRecord`, `UnitType`, `FinancialRecordSource`; extend `Property`)
- Modify: `src/data/selectors.ts` (add `latestFinancialRecord`)
- Modify: `src/data/seed.ts:431-516` (`generateProperty` — build units + records + occupancy + notes) and add `generateUnits`/`generateFinancialRecords` helpers
- Modify: `src/data/createListing.ts:114-184` (`buildStubProperty` — add empty units/records + occupancy/notes)
- Test: `src/data/seed.test.ts` (add cases)

**Interfaces:**
- Produces:
  - `PropertyUnit = { id, label, unitType, sqft, beds, baths, suite, floor, ceilingHeight, offices, conferenceRooms, furnished }`
  - `PropertyFinancialRecord = { id, asOf, source, potentialGrossIncome, vacancyRate, effectiveGrossIncome, operatingExpenses, noi, capRate, grossRentMultiplier, cashOnCashReturn, occupancyPct }`
  - `Property` additionally has `occupancyPct: number`, `notes: string`, `units: PropertyUnit[]`, `financialRecords: PropertyFinancialRecord[]` (newest-first).
  - `latestFinancialRecord(property: Property): PropertyFinancialRecord | undefined` → `property.financialRecords[0]`.

- [ ] **Step 1: Write failing seed tests**

Append to `src/data/seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { generateDataset } from './seed'

describe('property units + financial records seed', () => {
  const { properties } = generateDataset()

  it('gives every property at least one unit with a physical shell', () => {
    for (const p of properties) {
      expect(p.units.length).toBeGreaterThan(0)
      for (const u of p.units) {
        expect(u.sqft).toBeGreaterThan(0)
        expect(typeof u.label).toBe('string')
      }
    }
  })

  it('gives every property dated financial records, newest first, latest mirroring flat actuals', () => {
    for (const p of properties) {
      expect(p.financialRecords.length).toBeGreaterThan(0)
      const dates = p.financialRecords.map((r) => r.asOf)
      const sorted = [...dates].sort().reverse()
      expect(dates).toEqual(sorted) // newest-first
      const latest = p.financialRecords[0]
      expect(latest.noi).toBe(p.noi)
      expect(latest.capRate).toBe(p.capRate)
    }
  })

  it('derives occupancyPct from vacancy and gives a notes string', () => {
    for (const p of properties) {
      expect(p.occupancyPct).toBeGreaterThanOrEqual(0)
      expect(p.occupancyPct).toBeLessThanOrEqual(100)
      expect(typeof p.notes).toBe('string')
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun --bun run test src/data/seed.test.ts`
Expected: FAIL — `p.units`/`p.financialRecords`/`p.occupancyPct` do not exist yet (type + runtime).

- [ ] **Step 3: Add the new types to `types.ts`**

After the `Property` interface (after line 138), add:

```ts
export type UnitType = 'residential' | 'office' | 'retail' | 'industrial' | 'other'

/** A physical child shell of a Property (condo unit, pad, suite, apartment). Source of truth on the asset. */
export interface PropertyUnit {
  id: string
  /** Display label, e.g. "Unit 4B" or "Suite 200". */
  label: string
  unitType: UnitType
  sqft: number
  // Residential shell
  beds: number | null
  baths: number | null
  // Commercial shell
  suite: string | null
  floor: number | null
  /** Overrides the building-level ceiling height when set. */
  ceilingHeight: number | null
  offices: number | null
  conferenceRooms: number | null
  furnished: boolean
}

export type FinancialRecordSource = 'T-12 actuals' | 'Assessor' | 'Owner-provided' | 'Broker estimate'

/** A dated snapshot of the asset's in-place operating performance. Newest record = current. */
export interface PropertyFinancialRecord {
  id: string
  /** ISO date (YYYY-MM-DD) the figures are as-of. */
  asOf: string
  source: FinancialRecordSource
  potentialGrossIncome: number
  vacancyRate: number
  effectiveGrossIncome: number
  operatingExpenses: number
  noi: number
  capRate: number
  grossRentMultiplier: number
  cashOnCashReturn: number
  occupancyPct: number
}
```

Then extend the `Property` interface — add these fields just before `createdAt` (currently line 136):

```ts
  // Occupancy + notes + child records (source of truth for the asset)
  occupancyPct: number
  notes: string
  units: PropertyUnit[]
  /** Dated in-place financial actuals, newest first; [0] mirrors the flat current fields above. */
  financialRecords: PropertyFinancialRecord[]
```

- [ ] **Step 4: Add `latestFinancialRecord` to `selectors.ts`**

At the end of `src/data/selectors.ts`, add (and add `PropertyFinancialRecord` to the type import on line 2):

```ts
/** The current (newest) in-place financial record for a property, or undefined if none. */
export function latestFinancialRecord(property: Property): PropertyFinancialRecord | undefined {
  return property.financialRecords[0]
}
```

- [ ] **Step 5: Add seed generators + populate `generateProperty`**

In `src/data/seed.ts`, add helper functions above `generateProperty` (before line 344). These reuse the locals `generateProperty` already computes:

```ts
function generateUnits(
  propertyType: PropertyType,
  buildingSqFt: number,
  residentialUnits: number | null,
): PropertyUnit[] {
  const unitType: UnitType =
    propertyType === 'multifamily'
      ? 'residential'
      : propertyType === 'office' || propertyType === 'retail' || propertyType === 'industrial'
        ? propertyType
        : 'other'

  // Multifamily: a handful of residential shells. Everything else: 1–3 commercial suites.
  const count =
    propertyType === 'multifamily'
      ? Math.min(residentialUnits ?? 4, 6)
      : faker.helpers.weightedArrayElement([
          { weight: 60, value: 1 },
          { weight: 28, value: 2 },
          { weight: 12, value: 3 },
        ])
  const per = Math.max(400, Math.round(buildingSqFt / count))

  return Array.from({ length: count }, (_, i): PropertyUnit => {
    const residential = unitType === 'residential'
    return {
      id: faker.string.uuid(),
      label: residential ? `Unit ${i + 1}` : `Suite ${(i + 1) * 100}`,
      unitType,
      sqft: per,
      beds: residential ? faker.number.int({ min: 1, max: 3 }) : null,
      baths: residential ? faker.number.int({ min: 1, max: 2 }) : null,
      suite: residential ? null : `${(i + 1) * 100}`,
      floor: residential ? null : faker.number.int({ min: 1, max: 5 }),
      ceilingHeight: residential ? null : faker.number.int({ min: 9, max: 16 }),
      offices: residential ? null : faker.number.int({ min: 0, max: 6 }),
      conferenceRooms: residential ? null : faker.number.int({ min: 0, max: 2 }),
      furnished: !residential && faker.datatype.boolean({ probability: 0.25 }),
    }
  })
}

function generateFinancialRecords(current: {
  pgi: number
  vacancyRate: number
  egi: number
  operatingExpenses: number
  noi: number
  capRate: number
  grm: number
  cashOnCashReturn: number
  occupancyPct: number
}): PropertyFinancialRecord[] {
  // Newest first: the current year mirrors the flat Property fields exactly; two
  // prior years scale figures down a little so the history reads plausibly.
  const currentYear = 2026
  const sources: FinancialRecordSource[] = ['T-12 actuals', 'Owner-provided', 'Broker estimate']
  return [0, 1, 2].map((back): PropertyFinancialRecord => {
    const f = back === 0 ? 1 : 1 - back * faker.number.float({ min: 0.03, max: 0.07, fractionDigits: 3 })
    return {
      id: faker.string.uuid(),
      asOf: `${currentYear - back}-12-31`,
      source: sources[back],
      potentialGrossIncome: Math.round(current.pgi * f),
      vacancyRate: current.vacancyRate,
      effectiveGrossIncome: Math.round(current.egi * f),
      operatingExpenses: Math.round(current.operatingExpenses * f),
      noi: back === 0 ? current.noi : Math.round(current.noi * f),
      capRate: current.capRate,
      grossRentMultiplier: current.grm,
      cashOnCashReturn: current.cashOnCashReturn,
      occupancyPct: current.occupancyPct,
    }
  })
}
```

Then in `generateProperty`, compute `occupancyPct`, `cashOnCashReturn`, `units`, `notes`, and `financialRecords` and add them to the returned object. Replace the CRE-metrics block (lines 503-511) with a version that captures `cashOnCashReturn` in a local first, and add the new fields before `createdAt` (line 513):

```ts
    // (replace lines 503-511)
    potentialGrossIncome: pgi,
    vacancyRate,
    effectiveGrossIncome: egi,
    operatingExpenses,
    noi,
    capRate,
    cashOnCashReturn,
    grossRentMultiplier: grm,
    parkingSpaces,

    occupancyPct,
    notes: faker.helpers.arrayElement([
      'Well-maintained asset; roof replaced within the last 5 years.',
      'Value-add opportunity — below-market rents on renewal.',
      'Stabilized; long-term credit tenancy in place.',
      'Deferred maintenance noted on the last inspection.',
    ]),
    units,
    financialRecords,
```

And add these locals just before the `return {` (after line 430):

```ts
  const cashOnCashReturn = faker.number.float({ min: capRate * 0.7, max: capRate * 1.1, fractionDigits: 4 })
  const occupancyPct = Math.round((1 - vacancyRate) * 1000) / 10
  const units = generateUnits(propertyType, buildingSqFt, residentialUnits)
  const financialRecords = generateFinancialRecords({
    pgi, vacancyRate, egi, operatingExpenses, noi, capRate, grm, cashOnCashReturn, occupancyPct,
  })
```

(Remove the inline `cashOnCashReturn: faker.number.float(...)` that was on old line 509 — it's now the `cashOnCashReturn` local.)

Ensure `PropertyUnit`, `UnitType`, `PropertyFinancialRecord`, `FinancialRecordSource` are added to the `types` import at the top of `seed.ts`.

- [ ] **Step 6: Populate `buildStubProperty` in `createListing.ts`**

In `src/data/createListing.ts`, add to the returned stub object (after line 180 `parkingSpaces: 0,`, before `createdAt`):

```ts
    occupancyPct: 0,
    notes: '',
    units: [],
    financialRecords: [
      {
        id: crypto.randomUUID(),
        asOf: now.slice(0, 10),
        source: 'Broker estimate',
        potentialGrossIncome: 0,
        vacancyRate: 0,
        effectiveGrossIncome: 0,
        operatingExpenses: 0,
        noi: 0,
        capRate: 0,
        grossRentMultiplier: 0,
        cashOnCashReturn: 0,
        occupancyPct: 0,
      },
    ],
```

(No new imports needed — the object is typed structurally against `Property`.)

- [ ] **Step 7: Run the tests to verify they pass**

Run: `bun --bun run test src/data/seed.test.ts`
Expected: PASS (new cases green).

- [ ] **Step 8: Full typecheck + test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no type errors; all suites PASS.

- [ ] **Step 9: Commit**

```bash
git add src/data/types.ts src/data/selectors.ts src/data/seed.ts src/data/createListing.ts src/data/seed.test.ts
git commit -m "feat(data): add PropertyUnit + PropertyFinancialRecord + occupancy/notes (additive)"
```

---

## Task 3: Add Deal `transaction` group + migrate transaction/back-office consumers

**Files:**
- Modify: `src/data/types.ts` (add `DealTransaction`; add `transaction: DealTransaction` to `Listing`)
- Modify: `src/data/seed.ts:987-1054` and `src/data/createListing.ts:321-392` (populate `transaction`, keeping the flat fields)
- Modify consumers: `src/components/deals/DealFinancials.tsx`, `src/components/deals/DealOverview.tsx`, `src/components/deals/DealCard.tsx`, `src/components/deals/TodayPlanner.tsx`, `src/routes/listings/index.tsx`

**Interfaces:**
- Consumes: existing `DealFinancials` (back-office), `FinancialDeduction`, `FinancialReceivable`.
- Produces: `Listing.transaction: DealTransaction` where
  ```ts
  DealTransaction = {
    salePrice: number; pricePerSqFt: number; commissionPct: number; commissionAmount: number;
    closeProbability: number; contractExecutedDate: string | null; closeDate: string | null;
    listedOnDate: string | null; listingExpirationDate: string | null; deadReason: string | null;
    nextCriticalDate: string | null; backOffice: DealFinancials;
  }
  ```

- [ ] **Step 1: Add `DealTransaction` to `types.ts`**

After the `DealFinancials` interface (after line 299), add:

```ts
/**
 * The transaction facts of a deal — the accepted parties (via the deal's contact-id
 * arrays), critical dates, the transacted price/commission, and the back-office
 * settlement records. Populated across Under Contract → Close.
 */
export interface DealTransaction {
  /** The transacted sale price (distinct from the pitch/asking price on `financials`). */
  salePrice: number
  pricePerSqFt: number
  commissionPct: number
  commissionAmount: number
  closeProbability: number
  contractExecutedDate: string | null
  closeDate: string | null
  listedOnDate: string | null
  listingExpirationDate: string | null
  deadReason: string | null
  nextCriticalDate: string | null
  /** Voucher / receivables / deductions — the Close-phase settlement records. */
  backOffice: DealFinancials
}
```

Add `transaction: DealTransaction` to the `Listing` interface — insert immediately after `financials: DealFinancials` (line 199). Leave the existing flat `salePrice`, `pricePerSqFt`, `commissionPct`, `commissionAmount`, `closeProbability`, `nextCriticalDate`, and `financials` fields in place for now.

- [ ] **Step 2: Populate `transaction` in `seed.ts`**

In `generateListings`, the returned object (lines 987-1054) currently ends with `financials: {…}` and `nextCriticalDate`. Add a `transaction` field that reuses the existing locals and the same back-office object. Insert after the `financials: {…}` block (after line 1049), before `nextCriticalDate` (line 1050):

```ts
      transaction: {
        salePrice,
        pricePerSqFt,
        commissionPct,
        commissionAmount,
        closeProbability: faker.number.int({ min: pMin, max: pMax }),
        contractExecutedDate: status === 'under-contract' || status === 'closed'
          ? faker.date.recent({ days: 120 }).toISOString().slice(0, 10) : null,
        closeDate: status === 'closed' ? faker.date.recent({ days: 90 }).toISOString().slice(0, 10) : null,
        listedOnDate: status !== 'proposal' ? faker.date.recent({ days: 200 }).toISOString().slice(0, 10) : null,
        listingExpirationDate: status !== 'proposal' ? faker.date.future({ years: 1 }).toISOString().slice(0, 10) : null,
        deadReason: null,
        nextCriticalDate: nextTask?.date ?? null,
        backOffice: {
          name,
          identifier: dealId,
          status: voucherStatus,
          closeDate: status === 'closed' ? faker.date.recent({ days: 90 }).toISOString().slice(0, 10) : null,
          relatedContactsLabel: `${sellerName}${sellerContacts.length + buyerContacts.length > 1 ? ` & ${sellerContacts.length + buyerContacts.length - 1} more` : ''}`,
          preSplitDeductions,
          receivables: status === 'closed'
            ? [
                {
                  id: faker.string.uuid(),
                  payerName: `${(buyerContacts[0] ?? sellerContacts[0]).firstName} ${(buyerContacts[0] ?? sellerContacts[0]).lastName}`,
                  payerEmail: (buyerContacts[0] ?? sellerContacts[0]).email,
                  dueDate: faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
                  billingDescription: 'Full Payment',
                  amount: commissionAmount,
                  credited: 0,
                },
              ]
            : [],
        },
      },
```

> Note: this duplicates the back-office object shape that the flat `financials` field still holds. That duplication is temporary — the flat `financials` field is removed in Task 4, after its readers migrate below.

- [ ] **Step 3: Populate `transaction` in `createListing.ts`**

In `createProposalListing`, the returned `listing` (lines 321-392) has a `financials: {…}` block then `nextCriticalDate`. Add after the `financials: {…}` block (after line 387), before `nextCriticalDate`:

```ts
    transaction: {
      salePrice: draft.listingPrice,
      pricePerSqFt:
        draft.availableSqFt > 0
          ? Math.round((draft.listingPrice / draft.availableSqFt) * 100) / 100
          : 0,
      commissionPct: draft.commissionPct,
      commissionAmount,
      closeProbability: 0,
      contractExecutedDate: null,
      closeDate: null,
      listedOnDate: null,
      listingExpirationDate: null,
      deadReason: null,
      nextCriticalDate,
      backOffice: {
        name,
        identifier: dealId,
        status: 'Draft',
        closeDate: null,
        relatedContactsLabel: primaryContact ? contactLabel(primaryContact) : '—',
        preSplitDeductions: [],
        receivables: [],
      },
    },
```

- [ ] **Step 4: Migrate back-office `financials` readers to `transaction.backOffice`**

`src/components/deals/DealFinancials.tsx`:
- Line 106: `const { financials, commissionAmount } = listing;` → `const { transaction } = listing; const { backOffice: financials, commissionAmount } = transaction;`
- Line 298: `const deductions = listing.financials.preSplitDeductions;` → `const deductions = listing.transaction.backOffice.preSplitDeductions;`
- Line 359: `const receivables = listing.financials.receivables;` → `const receivables = listing.transaction.backOffice.receivables;`
- Line 441: `value={formatCurrency(listing.salePrice)}` → `value={formatCurrency(listing.transaction.salePrice)}`
- Line 444: `` `${listing.commissionPct}%` `` → `` `${listing.transaction.commissionPct}%` ``
- Line 447: `formatCurrency(listing.commissionAmount)` → `formatCurrency(listing.transaction.commissionAmount)`

(Leave the destructured `commissionAmount` on line 106 as-is since it now comes from `transaction`.)

`src/components/deals/TodayPlanner.tsx`:
- Line 239: `endMilestone(listing.status, start, listing.financials.closeDate)` → `endMilestone(listing.status, start, listing.transaction.backOffice.closeDate)`

`src/components/deals/DealOverview.tsx`:
- Line 100: `value={formatCurrency(listing.salePrice)}` → `formatCurrency(listing.transaction.salePrice)`
- Line 105: `listing.commissionPct` → `listing.transaction.commissionPct`
- Line 106: `listing.commissionAmount` → `listing.transaction.commissionAmount`
- Line 107: `` `${listing.closeProbability}%` `` → `listing.transaction.closeProbability`

`src/components/deals/DealCard.tsx`:
- Line 98: `formatCriticalDate(listing.nextCriticalDate)` → `formatCriticalDate(listing.transaction.nextCriticalDate)`

`src/routes/listings/index.tsx`:
- Line 248: `l.closeProbability / 100` → `l.transaction.closeProbability / 100`

- [ ] **Step 5: Typecheck + test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no errors (flat fields still exist so nothing else breaks); suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/seed.ts src/data/createListing.ts src/components/deals src/routes/listings/index.tsx
git commit -m "feat(data): add Deal.transaction group + migrate transaction/back-office reads"
```

---

## Task 4: Remove flat back-office `financials`; add Deal `financials` (pitch) group

**Files:**
- Modify: `src/data/types.ts` (remove flat `financials: DealFinancials` from `Listing`; add `DealPitchFinancials` + supporting types; add `financials: DealPitchFinancials`)
- Modify: `src/data/seed.ts` and `src/data/createListing.ts` (remove the flat `financials: {…}` block; add the pitch `financials` block)
- Modify consumers: `src/components/deals/DealCard.tsx`, `src/components/properties/PropertyCard.tsx`, `src/components/properties/PropertyMapInner.tsx`, `src/ai/tools.ts`, `src/routes/listings/index.tsx`, `src/components/deals/DealOverview.tsx`

**Interfaces:**
- Produces: `Listing.financials: DealPitchFinancials`, and:
  ```ts
  FinancialScenario = { id: string; name: string; noi: number; capRate: number; cashFlow: number }
  IncomeLineItem = { id: string; label: string; amount: number }
  ExpenseLineItem = { id: string; label: string; amount: number }
  RentRollRow = { id: string; unitId: string | null; tenant: string; actualRent: number; marketRent: number; rentPerSf: number; securityDeposit: number; leaseStart: string | null; leaseEnd: string | null }
  DealPitchFinancials = {
    askingPrice: number; askingPriceUnits: string; hidePrice: boolean; pricePerSqFt: number; capRate: number;
    income: IncomeLineItem[]; grossScheduledIncome: number; otherIncome: number; totalScheduledIncome: number;
    vacancyPct: number; vacancyCost: number; grossIncome: number; expenses: ExpenseLineItem[]; operatingExpenses: number;
    noi: number; loanAmount: number; downPayment: number; debtService: number; cashFlow: number;
    debtCoverageRatio: number; grossRentMultiplier: number; cashOnCash: number; scenarios: FinancialScenario[]; rentRoll: RentRollRow[];
  }
  ```

- [ ] **Step 1: Add pitch types to `types.ts`**

After `DealTransaction` (added in Task 3), add:

```ts
export interface IncomeLineItem { id: string; label: string; amount: number }
export interface ExpenseLineItem { id: string; label: string; amount: number }

/** A named, reorderable underwriting scenario (e.g. Worst Case / Best Case). */
export interface FinancialScenario {
  id: string
  name: string
  noi: number
  capRate: number
  cashFlow: number
}

/** One row of the deal's presented rent roll — a lease on a property unit. */
export interface RentRollRow {
  id: string
  /** References a `Property.units` shell, or null for an unassigned row. */
  unitId: string | null
  tenant: string
  actualRent: number
  marketRent: number
  rentPerSf: number
  securityDeposit: number
  leaseStart: string | null
  leaseEnd: string | null
}

/**
 * The broker's pro-forma pitch financials for this deal — the underwriting shown
 * in marketing. Snapshots the property's actuals and can move independently.
 */
export interface DealPitchFinancials {
  askingPrice: number
  askingPriceUnits: string
  hidePrice: boolean
  pricePerSqFt: number
  capRate: number
  income: IncomeLineItem[]
  grossScheduledIncome: number
  otherIncome: number
  totalScheduledIncome: number
  vacancyPct: number
  vacancyCost: number
  grossIncome: number
  expenses: ExpenseLineItem[]
  operatingExpenses: number
  noi: number
  loanAmount: number
  downPayment: number
  debtService: number
  cashFlow: number
  debtCoverageRatio: number
  grossRentMultiplier: number
  cashOnCash: number
  scenarios: FinancialScenario[]
  rentRoll: RentRollRow[]
}
```

- [ ] **Step 2: Swap the `financials` field type on `Listing`**

In the `Listing` interface, change `financials: DealFinancials` (line 199) to `financials: DealPitchFinancials`. (The back-office data now lives only under `transaction.backOffice`, and its readers were migrated in Task 3.)

- [ ] **Step 3: Replace the flat `financials` block in `seed.ts` with the pitch block**

In `generateListings`, delete the old `financials: {…}` object literal (lines 1026-1049) and replace it with a pitch `financials`. Reuse existing locals; add derived pitch locals just before the `return {` (after line 985):

```ts
    const grossScheduledIncome = Math.round(salePrice * 0.09)
    const otherIncome = Math.round(grossScheduledIncome * 0.04)
    const totalScheduledIncome = grossScheduledIncome + otherIncome
    const vacancyPct = faker.number.float({ min: 3, max: 9, fractionDigits: 1 })
    const vacancyCost = Math.round(totalScheduledIncome * (vacancyPct / 100))
    const grossIncome = totalScheduledIncome - vacancyCost
    const pitchOpEx = Math.round(grossIncome * 0.38)
    const pitchNoi = grossIncome - pitchOpEx
    const loanAmount = Math.round(salePrice * 0.65)
    const downPayment = salePrice - loanAmount
    const debtService = Math.round(loanAmount * 0.07)
    const pitchCapRate = Math.max(0, property.capRate + faker.number.float({ min: -0.005, max: 0.005, fractionDigits: 4 }))
    const rentRoll: RentRollRow[] = property.units.map((u): RentRollRow => {
      const rent = Math.round(u.sqft * faker.number.float({ min: 1.2, max: 3.5, fractionDigits: 2 }))
      return {
        id: faker.string.uuid(),
        unitId: u.id,
        tenant: faker.company.name(),
        actualRent: rent,
        marketRent: Math.round(rent * faker.number.float({ min: 1.0, max: 1.15, fractionDigits: 2 })),
        rentPerSf: u.sqft > 0 ? Math.round((rent / u.sqft) * 100) / 100 : 0,
        securityDeposit: rent,
        leaseStart: faker.date.past({ years: 3 }).toISOString().slice(0, 10),
        leaseEnd: faker.date.future({ years: 3 }).toISOString().slice(0, 10),
      }
    })
```

Then the `financials` field in the returned object becomes:

```ts
      financials: {
        askingPrice: salePrice,
        askingPriceUnits: 'total',
        hidePrice: false,
        pricePerSqFt,
        capRate: pitchCapRate,
        income: [
          { id: faker.string.uuid(), label: 'Base Rent', amount: grossScheduledIncome },
          { id: faker.string.uuid(), label: 'Other Income', amount: otherIncome },
        ],
        grossScheduledIncome,
        otherIncome,
        totalScheduledIncome,
        vacancyPct,
        vacancyCost,
        grossIncome,
        expenses: [
          { id: faker.string.uuid(), label: 'Operating Expenses', amount: pitchOpEx },
        ],
        operatingExpenses: pitchOpEx,
        noi: pitchNoi,
        loanAmount,
        downPayment,
        debtService,
        cashFlow: pitchNoi - debtService,
        debtCoverageRatio: debtService > 0 ? Math.round((pitchNoi / debtService) * 100) / 100 : 0,
        grossRentMultiplier: grossScheduledIncome > 0 ? Math.round((salePrice / grossScheduledIncome) * 10) / 10 : 0,
        cashOnCash: downPayment > 0 ? Math.round(((pitchNoi - debtService) / downPayment) * 1000) / 10 : 0,
        scenarios: [
          { id: faker.string.uuid(), name: 'Worst Case', noi: Math.round(pitchNoi * 0.85), capRate: pitchCapRate + 0.005, cashFlow: Math.round((pitchNoi - debtService) * 0.7) },
          { id: faker.string.uuid(), name: 'Best Case', noi: Math.round(pitchNoi * 1.12), capRate: Math.max(0, pitchCapRate - 0.005), cashFlow: Math.round((pitchNoi - debtService) * 1.3) },
        ],
        rentRoll,
      },
```

Add `RentRollRow` (and any new types used) to the `types` import at the top of `seed.ts`.

Also remove the now-unused flat `capRate:` line (998) from the returned object **only if** you are keeping the flat `capRate` field until Task 7 — do NOT remove it yet; it is removed in Task 7. Keep line 998 as-is.

- [ ] **Step 4: Replace the flat `financials` block in `createListing.ts` with the pitch block**

In `createProposalListing`, delete the old `financials: {…}` (lines 379-387) and replace with:

```ts
    financials: {
      askingPrice: draft.listingPrice,
      askingPriceUnits: 'total',
      hidePrice: false,
      pricePerSqFt:
        draft.availableSqFt > 0
          ? Math.round((draft.listingPrice / draft.availableSqFt) * 100) / 100
          : 0,
      capRate: 0,
      income: [],
      grossScheduledIncome: 0,
      otherIncome: 0,
      totalScheduledIncome: 0,
      vacancyPct: 0,
      vacancyCost: 0,
      grossIncome: 0,
      expenses: [],
      operatingExpenses: 0,
      noi: 0,
      loanAmount: 0,
      downPayment: 0,
      debtService: 0,
      cashFlow: 0,
      debtCoverageRatio: 0,
      grossRentMultiplier: 0,
      cashOnCash: 0,
      scenarios: [],
      rentRoll: [],
    },
```

- [ ] **Step 5: Migrate `listing.askingPrice` / `listing.capRate` / `listing.pricePerSqFt` readers**

`src/components/deals/DealCard.tsx`:
- Line 97: `formatPrice(listing.askingPrice)` → `formatPrice(listing.financials.askingPrice)`

`src/components/properties/PropertyCard.tsx`:
- Line 120: `formatPrice(listing.askingPrice)` → `formatPrice(listing.financials.askingPrice)`

`src/components/properties/PropertyMapInner.tsx`:
- Line 81: `formatPrice(p.askingPrice)` (`p` is a Listing) → `formatPrice(p.financials.askingPrice)`

`src/ai/tools.ts`:
- Line 62: `askingPrice: l.askingPrice` (in `dealSummary(l: Listing)`) → `askingPrice: l.financials.askingPrice`

`src/routes/listings/index.tsx`:
- Line 231: `b.askingPrice - a.askingPrice` → `b.financials.askingPrice - a.financials.askingPrice`
- Line 233 (ascending sort): same swap, ascending → `a.financials.askingPrice - b.financials.askingPrice`
- Line 235: `b.capRate - a.capRate` → `b.financials.capRate - a.financials.capRate`
- Line 248: `l.askingPrice * (...)` → `l.financials.askingPrice * (...)`

`src/components/deals/DealOverview.tsx`:
- Line 103: `` `$${listing.pricePerSqFt.toLocaleString(...)}` `` → `listing.financials.pricePerSqFt` (keep the same formatting call, just the path changes)

- [ ] **Step 6: Typecheck + test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no errors; suites PASS. (`DealFinancials.tsx` no longer reads the flat back-office `financials`; all pitch readers use `financials.*`.)

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/data/seed.ts src/data/createListing.ts src/components src/ai/tools.ts src/routes/listings/index.tsx
git commit -m "feat(data): add Deal.financials pitch group (pro forma + rent roll + scenarios)"
```

---

## Task 5: Add Deal `marketing` group + `unitId` + `internalNotes`

**Files:**
- Modify: `src/data/types.ts` (add `DealMarketing` + supporting enums; add `marketing`, `unitId`, `internalNotes` to `Listing`)
- Modify: `src/data/seed.ts` and `src/data/createListing.ts` (populate `marketing`, `unitId`, `internalNotes`)
- Modify consumers: `src/components/deals/DealOverview.tsx`, `src/components/deals/DealCard.tsx`, `src/data/listingWebsiteSettings.ts`

**Interfaces:**
- Produces: `Listing.unitId: string | null`, `Listing.internalNotes: string`, `Listing.marketing: DealMarketing` where
  ```ts
  DealMarketing = {
    saleTitle: string; saleDescription: string; saleBullets: string[]; saleClosingInfo: string;
    leaseTitle: string; leaseDescription: string; leaseBullets: string[];
    propertyUse: PropertyUse; investmentType: InvestmentType; includesRealEstate: boolean; auction: boolean;
    saleTerms: string; reimbursement: string; marketingChannel: MarketingChannel; visibilityTier: VisibilityTier;
    publishFlags: PublishFlags; occupancySnapshot: number | null; availableSqFt: number;
    locationDescription: string; leaseTerms: LeaseTerms;
  }
  ```

- [ ] **Step 1: Add marketing types to `types.ts`**

After `DealPitchFinancials`, add:

```ts
export type PropertyUse = 'Net Leased Investment' | 'Investment' | 'Owner/User' | 'Business for Sale' | 'Development'
export type InvestmentType = 'Core' | 'Core Plus' | 'Value Add' | 'Opportunistic' | 'Distressed'
export type MarketingChannel = 'None' | 'Buildout Buyer Network' | 'My Brokerage Website' | 'Buildout Syndication Network'
export type VisibilityTier = 'Fully Private' | 'Private' | 'Semi-Public' | 'Fully Public'
export type LeaseRateUnits = 'SF/Yr' | 'SF/Mo' | 'Monthly'
export type SpaceLeaseType = 'Gross' | 'Modified Gross' | 'NNN' | 'Modified Net' | 'Full Service' | 'Ground Lease'

/** Deal-level terms for transacting a unit (reset per engagement). */
export interface LeaseTerms {
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  hideLeaseRate: boolean
  leaseType: SpaceLeaseType
  leaseTermMonths: number | null
  dateAvailable: string | null
  minDivisibleSqFt: number | null
  maxContiguousSqFt: number | null
  tiAllowance: number | null
  freeRentMonths: number | null
  signageAvailable: boolean
  rentEscalators: string | null
  sublease: boolean
  description: string | null
}

/** Per-item public/private flags — Active publishes the flagged set (wired in Phase 3/4). */
export interface PublishFlags {
  title: boolean
  description: boolean
  bullets: boolean
  financials: boolean
  photos: boolean
}

/** The deal's marketing content — copy, terms, channel/visibility, publish flags. */
export interface DealMarketing {
  saleTitle: string
  saleDescription: string
  saleBullets: string[]
  saleClosingInfo: string
  leaseTitle: string
  leaseDescription: string
  leaseBullets: string[]
  propertyUse: PropertyUse
  investmentType: InvestmentType
  includesRealEstate: boolean
  auction: boolean
  saleTerms: string
  reimbursement: string
  marketingChannel: MarketingChannel
  visibilityTier: VisibilityTier
  publishFlags: PublishFlags
  /** Snapshot of `Property.occupancyPct` taken at Active, or null before publish. */
  occupancySnapshot: number | null
  availableSqFt: number
  locationDescription: string
  leaseTerms: LeaseTerms
}
```

Add to the `Listing` interface (after `dealSide`, near line 155): `unitId: string | null` and `internalNotes: string`; and after the `financials`/`transaction` fields add `marketing: DealMarketing`.

- [ ] **Step 2: Populate `marketing` + `unitId` + `internalNotes` in `seed.ts`**

In `generateListings`, add before `return {` (reusing `dealType`, `availableSqFt`, `property`):

```ts
    const isLease = dealType !== 'Sale'
    const marketingUnitId = property.units.length > 0 ? property.units[i % property.units.length].id : null
```

Add fields to the returned object (place `unitId` right after `propertyId`, `internalNotes` near the end before `createdAt`, and `marketing` alongside `financials`/`transaction`):

```ts
      unitId: marketingUnitId,
      internalNotes: faker.helpers.arrayElement(['', '', 'Seller motivated — wants to close before year-end.', 'Waiting on estoppels.']),
      marketing: {
        saleTitle: `${property.name} — ${TYPE_LABEL[property.propertyType]} Offering`,
        saleDescription: faker.lorem.paragraph(),
        saleBullets: faker.helpers.arrayElements(
          ['Prime location', 'Below-market rents', 'Recent capital improvements', 'Strong tenancy', 'Value-add upside'],
          faker.number.int({ min: 2, max: 4 }),
        ),
        saleClosingInfo: 'Offers due by the date noted in the OM.',
        leaseTitle: isLease ? `${property.name} — Space Available` : '',
        leaseDescription: isLease ? faker.lorem.sentence() : '',
        leaseBullets: isLease ? ['Flexible terms', 'Move-in ready'] : [],
        propertyUse: faker.helpers.arrayElement(['Net Leased Investment', 'Investment', 'Owner/User', 'Business for Sale', 'Development'] as const),
        investmentType: faker.helpers.arrayElement(['Core', 'Core Plus', 'Value Add', 'Opportunistic', 'Distressed'] as const),
        includesRealEstate: true,
        auction: false,
        saleTerms: 'All cash or conventional financing.',
        reimbursement: 'NNN',
        marketingChannel: faker.helpers.arrayElement(['None', 'Buildout Buyer Network', 'My Brokerage Website', 'Buildout Syndication Network'] as const),
        visibilityTier: faker.helpers.arrayElement(['Fully Private', 'Private', 'Semi-Public', 'Fully Public'] as const),
        publishFlags: { title: true, description: true, bullets: true, financials: false, photos: true },
        occupancySnapshot: status === 'proposal' ? null : property.occupancyPct,
        availableSqFt,
        locationDescription: `Located in ${property.submarket}, ${property.city}.`,
        leaseTerms: {
          leaseRate: isLease ? faker.number.float({ min: 8, max: 55, fractionDigits: 2 }) : null,
          leaseRateUnits: 'SF/Yr',
          hideLeaseRate: false,
          leaseType: faker.helpers.arrayElement(['Gross', 'Modified Gross', 'NNN', 'Modified Net', 'Full Service', 'Ground Lease'] as const),
          leaseTermMonths: isLease ? faker.number.int({ min: 12, max: 120 }) : null,
          dateAvailable: isLease ? faker.date.soon({ days: 90 }).toISOString().slice(0, 10) : null,
          minDivisibleSqFt: null,
          maxContiguousSqFt: null,
          tiAllowance: isLease ? faker.number.int({ min: 0, max: 60 }) : null,
          freeRentMonths: isLease ? faker.number.int({ min: 0, max: 6 }) : null,
          signageAvailable: true,
          rentEscalators: isLease ? '3% annual' : null,
          sublease: false,
          description: isLease ? faker.lorem.sentence() : null,
        },
      },
```

- [ ] **Step 3: Populate `marketing` + `unitId` + `internalNotes` in `createListing.ts`**

In `createProposalListing`'s returned `listing`, add `unitId: null,` (after `propertyId`), `internalNotes: '',` (near the end), and:

```ts
    marketing: {
      saleTitle: draft.name || name,
      saleDescription: draft.description,
      saleBullets: [],
      saleClosingInfo: '',
      leaseTitle: '',
      leaseDescription: '',
      leaseBullets: [],
      propertyUse: 'Investment',
      investmentType: 'Core',
      includesRealEstate: true,
      auction: false,
      saleTerms: '',
      reimbursement: '',
      marketingChannel: 'None',
      visibilityTier: 'Fully Private',
      publishFlags: { title: false, description: false, bullets: false, financials: false, photos: false },
      occupancySnapshot: null,
      availableSqFt: draft.availableSqFt,
      locationDescription: draft.locationDescription,
      leaseTerms: {
        leaseRate: null,
        leaseRateUnits: 'SF/Yr',
        hideLeaseRate: false,
        leaseType: 'NNN',
        leaseTermMonths: null,
        dateAvailable: null,
        minDivisibleSqFt: null,
        maxContiguousSqFt: null,
        tiAllowance: null,
        freeRentMonths: null,
        signageAvailable: false,
        rentEscalators: null,
        sublease: false,
        description: null,
      },
    },
```

- [ ] **Step 4: Migrate `description`/`locationDescription`/`availableSqFt`/`leaseRate` readers**

`src/components/deals/DealOverview.tsx`:
- Line 128: `listing.availableSqFt.toLocaleString()` → `listing.marketing.availableSqFt.toLocaleString()`

`src/components/deals/DealCard.tsx`:
- Line 95: `isLease && listing.leaseRate != null` → `isLease && listing.marketing.leaseTerms.leaseRate != null`
- Line 96: `` `$${listing.leaseRate}/SF` `` → `` `$${listing.marketing.leaseTerms.leaseRate}/SF` ``

`src/data/listingWebsiteSettings.ts`:
- Line 51: `${listing.availableSqFt.toLocaleString()}` → `${listing.marketing.availableSqFt.toLocaleString()}`

(No consumer reads `listing.description` or `listing.locationDescription` — they were construction-only; their data now lives at `marketing.saleDescription`/`marketing.locationDescription`.)

- [ ] **Step 5: Typecheck + test**

Run: `bunx tsc --noEmit && bun --bun run test`
Expected: no errors; suites PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/seed.ts src/data/createListing.ts src/components src/data/listingWebsiteSettings.ts
git commit -m "feat(data): add Deal.marketing group + unitId + internalNotes"
```

---

## Task 6: Add `selectDealWithProperty` resolver + migrate denormalized-property consumers

**Files:**
- Modify: `src/data/selectors.ts` (add `selectDealWithProperty`)
- Test: `src/data/selectors.test.ts` (add a case)
- Modify consumers (Group 1 — read property facts off a Listing):
  `src/components/deals/DealContextRail.tsx`, `src/components/deals/DealOverview.tsx`, `src/components/deals/DealCard.tsx`,
  `src/components/dashboard/YourListingsSection.tsx`, `src/components/properties/PropertyDetailHeader.tsx`,
  `src/components/properties/PropertyCard.tsx`, `src/components/properties/PropertyMapInner.tsx`,
  `src/components/listings/ListingDemographics.tsx`, `src/components/listings/ListingEmail.tsx`,
  `src/components/search/OmniSearch.tsx`, `src/data/listingWebsiteSettings.ts`, `src/ai/tools.ts`,
  `src/data/selectors.ts` (its own `DealSummary` map + `searchAll`), `src/routes/listings/index.tsx`

**Interfaces:**
- Produces: `selectDealWithProperty(dealId: string): { deal: Listing; property: Property | undefined; unit: PropertyUnit | undefined } | undefined`.

- [ ] **Step 1: Write a failing resolver test**

Add to `src/data/selectors.test.ts`:

```ts
import { selectDealWithProperty } from './selectors'
import { useDataStore } from './dataStore'

it('selectDealWithProperty resolves the deal, its property, and its unit', () => {
  const anyDeal = [...useDataStore.getState().listings.values()][0]
  const resolved = selectDealWithProperty(anyDeal.id)
  expect(resolved).toBeTruthy()
  expect(resolved!.deal.id).toBe(anyDeal.id)
  expect(resolved!.property?.id).toBe(anyDeal.propertyId)
  if (anyDeal.unitId) expect(resolved!.unit?.id).toBe(anyDeal.unitId)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `bun --bun run test src/data/selectors.test.ts`
Expected: FAIL — `selectDealWithProperty` is not exported.

- [ ] **Step 3: Implement `selectDealWithProperty`**

In `src/data/selectors.ts`, add (import `PropertyUnit` in the type import):

```ts
/**
 * Resolve a deal together with the property facts it references. Deals hold no
 * property data of their own — views join through `propertyId` (+ optional `unitId`).
 */
export function selectDealWithProperty(dealId: string):
  | { deal: Listing; property: Property | undefined; unit: PropertyUnit | undefined }
  | undefined {
  const { listings, properties } = useDataStore.getState()
  const deal = listings.get(dealId)
  if (!deal) return undefined
  const property = properties.get(deal.propertyId)
  const unit = deal.unitId && property ? property.units.find((u) => u.id === deal.unitId) : undefined
  return { deal, property, unit }
}
```

- [ ] **Step 4: Migrate `selectors.ts` internal readers**

In `getContactDetailClient` (the `DealSummary` map, lines 49-59): the deal no longer has `city`/`state`. Resolve the property per deal:

```ts
  const deals: DealSummary[] = listings.map((l) => {
    const property = useDataStore.getState().properties.get(l.propertyId)
    return {
      id: l.id,
      name: l.name,
      city: property?.city ?? '',
      state: property?.state ?? '',
      status: l.status,
      dealType: l.dealType,
      planTotal: l.tasks.length,
      planDone: l.tasks.filter((t) => t.status === 'complete').length,
      leadName: l.internalBrokers[0]?.name ?? contact.assignedTo,
    }
  })
```

In `searchAll` (lines 85-87): the deal search haystack referenced `l.city`/`l.state`. Replace with property-resolved values:

```ts
    deals: [...listings.values()].filter((l) => {
      const p = properties.get(l.propertyId)
      return matches(l.name, p?.city, p?.state, l.dealType)
    }),
```

- [ ] **Step 5: Migrate component/route/data consumers**

For each site, obtain the property via the resolver (or `getProperty(listing.propertyId)` where only a listing is in scope) and read the fact from the property. Exact edits:

`src/components/deals/DealContextRail.tsx:86` — this file already resolves the property via `getProperty` (see `property.propertyType` at :99). Change the address template to use that resolved `property`:
`` `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip}` `` → `` `${property?.street}, ${property?.city}, ${property?.state} ${property?.zip}` `` (reuse the existing `property` binding; if none is in scope, add `const property = getProperty(listing.propertyId)`).

`src/components/deals/DealOverview.tsx` — add `const { property } = selectDealWithProperty(listing.id) ?? {}` near the top of the component, then:
- Line 125: `value={listing.propertyTypeLabel}` → `value={property ? TYPE_LABELS[property.propertyType] : '—'}` (import `TYPE_LABELS` from `#/components/properties/propertyDisplay`)
- Line 126: `value={listing.street}` → `value={property?.street ?? '—'}`
- Line 127: `` value={`${listing.location} ${listing.zip}`} `` → `` value={property ? `${property.city}, ${property.state} ${property.zip}` : '—'} ``

`src/components/deals/DealCard.tsx` — add `const property = getProperty(listing.propertyId)` (import from `#/data/store`), then:
- Line 115: `TYPE_ICONS[listing.propertyType]` → `property ? TYPE_ICONS[property.propertyType] : <fallback>` (guard; keep existing fallback pattern)
- Line 116: `TYPE_LABELS[listing.propertyType]` → `property ? TYPE_LABELS[property.propertyType] : ''`
- Line 154: `{listing.city}, {listing.state}` → `{property?.city}, {property?.state}`

`src/components/dashboard/YourListingsSection.tsx:62` — add `const property = getProperty(listing.propertyId)`, then `{listing.street}, {listing.city}, {listing.state}` → `{property?.street}, {property?.city}, {property?.state}`.

`src/components/properties/PropertyDetailHeader.tsx:33` — param is a `Listing`; add `const property = getProperty(listing.propertyId)` and swap the address template to `property?.*`.

`src/components/properties/PropertyCard.tsx` — add `const property = getProperty(listing.propertyId)`, then:
- Line 96/99: `listing.propertyType` → `property?.propertyType` (guard the `TYPE_ICONS`/`TYPE_LABELS` lookups)
- Line 109: `{listing.city}, {listing.state}` → `{property?.city}, {property?.state}`

`src/components/properties/PropertyMapInner.tsx` — its `listings: Listing[]` locals `p`/`l` are Listings. For each marker resolve the property once:
- Line 46: `listings.map((l) => [l.lat, l.lng])` → `listings.map((l) => { const p = getProperty(l.propertyId); return [p?.lat ?? 0, p?.lng ?? 0] })`
- Lines 69-81: inside the marker render, replace `p.lat`/`p.lng`/`p.street`/`p.city`/`p.state`/`p.propertyType` with a resolved `const prop = getProperty(p.propertyId)` and `prop?.*`. (`p.askingPrice` was already moved to `p.financials.askingPrice` in Task 4 — leave that.)

`src/components/listings/ListingDemographics.tsx:40` — add `const property = getProperty(listing.propertyId)`, then `center={{ lat: listing.lat, lng: listing.lng }}` → `center={{ lat: property?.lat ?? 0, lng: property?.lng ?? 0 }}`.

`src/components/listings/ListingEmail.tsx:20-22` — `listing.propertyType` → resolve property: add `const property = getProperty(listing.propertyId)`, use `property?.propertyType` in the filter and dependency array.

`src/components/search/OmniSearch.tsx:133` — `d` is a deal/Listing: `[d.city, d.state]` → resolve `const p = getProperty(d.propertyId)`; `[p?.city, p?.state].filter(Boolean).join(", ")`.

`src/ai/tools.ts:60-61` — `dealSummary(l: Listing)`: `city: l.city`/`state: l.state` → resolve `const p = getProperty(l.propertyId)`; `city: p?.city ?? ''`, `state: p?.state ?? ''`.

`src/data/listingWebsiteSettings.ts:50-51` — `listing.propertyTypeLabel`/`listing.city`/`listing.state`/`listing.street` in the meta templates → resolve `const property = getProperty(listing.propertyId)` and use `TYPE_LABELS[property.propertyType]` / `property?.city` etc.

`src/routes/listings/index.tsx:216` — search haystack `` `${l.name} ${l.street} ${l.city} ${l.state}` `` → resolve `const p = getProperty(l.propertyId)`; `` `${l.name} ${p?.street ?? ''} ${p?.city ?? ''} ${p?.state ?? ''}` ``.

> All property facts still exist on the `Listing` at this point (removed in Task 7), so if any site is missed the build still passes — but the intent is that no Group-1 read remains against the listing. Verify with the grep in Step 6.

- [ ] **Step 6: Verify no denormalized reads remain, typecheck, test**

Run:
```bash
grep -rnE "listing\.(street|city|state|zip|lat|lng|propertyType|propertySubtype|location|propertyTypeLabel)\b|\b[dlp]\.(street|city|state|zip|lat|lng|propertyTypeLabel)\b" src --include="*.ts" --include="*.tsx" | grep -v "src/data/seed.ts" | grep -v "src/data/createListing.ts"
```
Expected: no matches that resolve to a Listing receiver (Property/Contact/Comp receivers are fine). Then:
```bash
bunx tsc --noEmit && bun --bun run test
```
Expected: no errors; suites PASS (incl. the new resolver test).

- [ ] **Step 7: Commit**

```bash
git add src/data/selectors.ts src/data/selectors.test.ts src/components src/ai/tools.ts src/data/listingWebsiteSettings.ts src/routes/listings/index.tsx
git commit -m "feat(data): add selectDealWithProperty + migrate deals off denormalized property facts"
```

---

## Task 7: Remove deprecated flat `Listing` fields + bump `SEED_VERSION`

**Files:**
- Modify: `src/data/types.ts` (remove the deprecated flat fields from `Listing`)
- Modify: `src/data/seed.ts` (`generateListings` — drop the removed fields from the returned object)
- Modify: `src/data/createListing.ts` (`createProposalListing` — drop the removed fields)
- Modify: `src/data/persistence.ts:5` (bump `SEED_VERSION` 4 → 5)

**Interfaces:**
- Produces: final `Listing` shape — top-level `id, propertyId, unitId, name, slug, status, dealType, dealSide, dealId, sellerContactIds, buyerContactIds, otherContactIds, internalBrokers, outsideBrokers, tasks, messages, activities, history, documents?, internalNotes, marketing, financials, transaction, createdAt, updatedAt`.

- [ ] **Step 1: Remove the deprecated flat fields from the `Listing` interface**

In `src/data/types.ts`, delete these fields from `Listing` (they now live in nested homes or are resolved via the property):

```
availableSqFt, askingPrice, leaseRate, capRate,   // → marketing / financials
description, locationDescription,                 // → marketing
propertyType, propertySubtype, street, city, state, zip, lat, lng,  // → property (resolver)
location, propertyTypeLabel,                       // → property (resolver)
salePrice, pricePerSqFt, commissionPct, commissionAmount, closeProbability,  // → transaction
nextCriticalDate                                   // → transaction
```

Keep: `id, propertyId, unitId, name, slug, status, dealType, dealSide, dealId, sellerContactIds, buyerContactIds, otherContactIds, internalBrokers, outsideBrokers, tasks, messages, activities, history, documents?, internalNotes, marketing, financials, transaction, createdAt, updatedAt`. Update the interface doc comment to say display fields are resolved from the parent `Property` via `selectDealWithProperty` (no denormalization).

- [ ] **Step 2: Remove the deprecated fields from `generateListings` in `seed.ts`**

Delete these lines from the returned object (current line numbers): `availableSqFt`(995), `askingPrice`(996), `leaseRate`(997), `capRate`(998), `propertyType`(999), `propertySubtype`(1000), `street`(1001), `city`(1002), `state`(1003), `zip`(1004), `lat`(1005), `lng`(1006), `location`(1010), `propertyTypeLabel`(1011), `salePrice`(1012), `pricePerSqFt`(1013), `commissionPct`(1014), `commissionAmount`(1015), `closeProbability`(1016), `nextCriticalDate`(1050). The locals `availableSqFt`, `salePrice`, `pricePerSqFt`, `commissionPct`, `commissionAmount`, `netCommission` are still used to build `transaction`/`financials`/brokers — keep them. Remove any local that becomes unused (TS `noUnusedLocals` will flag it).

- [ ] **Step 3: Remove the deprecated fields from `createProposalListing` in `createListing.ts`**

Delete the corresponding fields from the returned `listing` object: `availableSqFt`(330), `askingPrice`(331), `leaseRate`(332), `capRate`(333), `description`(334), `locationDescription`(335), `propertyType`(337), `propertySubtype`(338), `street`(339), `city`(340), `state`(341), `zip`(342), `lat`(343), `lng`(344), `location`(348-350), `propertyTypeLabel`(351), `salePrice`(352), `pricePerSqFt`(353-356), `commissionPct`(357), `commissionAmount`(358), `closeProbability`(359), `nextCriticalDate`(388). Keep the `commissionAmount` local (line 298) — it feeds `transaction`/brokers. Remove `addressLabel`/`spaceName` only if they become unused (they feed `name`, so likely stay).

- [ ] **Step 4: Bump `SEED_VERSION`**

In `src/data/persistence.ts`, line 5: `export const SEED_VERSION = 4` → `export const SEED_VERSION = 5`.

- [ ] **Step 5: Typecheck (this is the real gate — any missed consumer surfaces here)**

Run: `bunx tsc --noEmit`
Expected: no errors. If a consumer still reads a removed flat field, fix it now by resolving through the property (Task 6 pattern) or the nested home.

- [ ] **Step 6: Full test + build**

Run:
```bash
bun --bun run test
bun --bun run build
```
Expected: all suites PASS; production build succeeds.

- [ ] **Step 7: Manual reseed sanity check (ask the user)**

Ask the user to open the app, run the in-app `reset()` (or clear IndexedDB), and confirm the world reseeds under `SEED_VERSION = 5` — property records show units + financial history; deals show marketing/financials/transaction; addresses still render on deal cards/overview (resolved from the property). Per project rules, do not use Playwright.

- [ ] **Step 8: Commit**

```bash
git add src/data/types.ts src/data/seed.ts src/data/createListing.ts src/data/persistence.ts
git commit -m "feat(data): remove denormalized Listing fields; deal reads property via resolver; bump SEED_VERSION"
```

---

## Self-Review

**Spec coverage (design §-by-§):**
- §2 Property additive fields (`occupancyPct`, `notes`, `units`, `financialRecords`) → Task 2. ✓
- §2 Deal nested homes (`marketing`/`financials`/`transaction`), `unitId`, `internalNotes`, denormalized removal → Tasks 3–7. ✓
- §3 Occupancy (Property + deal snapshot) → Task 2 (`occupancyPct`) + Task 5 (`marketing.occupancySnapshot`). ✓
- §3 Actuals flat-current + records history → Task 2. ✓
- §3 Pitch financials + scenarios + rent roll (deal, rows ref units) → Task 4. ✓
- §3 Back-office → `transaction.backOffice` → Task 3. ✓
- §3 Notes both → `Property.notes` (Task 2) + `Listing.internalNotes` (Task 5). ✓
- §3 Buyer/Seller as contact refs → unchanged (existing `sellerContactIds`/`buyerContactIds`); transaction dates added Task 3. ✓
- §3 Publish flags → `marketing.publishFlags` (Task 5). ✓
- §3 Units (generic, `dealType` labels) → Task 2 (`PropertyUnit`) + Task 5 (`unitId`). ✓
- §5.1 types 1:1 mirror → Tasks 2–5. §5.2 `DataStore`→`EntityMaps` → Task 1. §5.3 resolver + consumer migration → Task 6. §5.4 seed + `SEED_VERSION` → Tasks 2–5 + Task 7. ✓
- §6 verification (tests green, reset() clean on v5) → Task 7 Steps 6–7. ✓
- §7 out-of-scope (multi-deal-per-unit UI, rent-roll presentation, publish gate, property editing) → not built. ✓

**Placeholder scan:** No TBD/TODO; every code step shows concrete code; every migration site lists exact `old → new`. ✓

**Type consistency:** `EntityMaps` (Task 1); `PropertyUnit`/`PropertyFinancialRecord`/`latestFinancialRecord` (Task 2); `DealTransaction.backOffice: DealFinancials` (Task 3); `DealPitchFinancials`/`RentRollRow`/`FinancialScenario` (Task 4); `DealMarketing`/`LeaseTerms`/`PublishFlags` (Task 5); `selectDealWithProperty` return shape (Task 6) — names/signatures match across tasks. The `financials` field is `DealFinancials` in Task 3 then re-typed to `DealPitchFinancials` in Task 4 (deliberate; back-office readers migrate first in Task 3). ✓

**Note on additive back-office duplication (Task 3):** the flat `financials` object and `transaction.backOffice` briefly hold identical data between Task 3 and Task 4; this is intentional to keep the build green and is resolved in Task 4 Step 2.
