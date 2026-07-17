# Lease Workflow (Umbrella Representation + Space Deals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give landlord-rep leases the same gated 5-stage lifecycle sales have, plus an umbrella-representation → per-space-deal model where a broker wins a whole-property assignment and spawns a child deal per space, each inheriting the parent's marketing template and running its own pipeline.

**Architecture:** No new entity — a child space deal is a normal sell-side `Listing` with a `parentDealId` pointer and a `unitId` bound to a `Property` unit. `isUmbrella` is *derived* (`has children`), never stored, and never affects gates. The existing gate engine (`resolveGate` / `StageGate` / `commitStageTransition`) is *completed* for lease (rent/SF at Active, Tenant + term at Under Contract, commencement date at Closed) — no new engine. "Add space" reads the Property's units (source of truth) and writes new units back to the Property before spawning children. Template inheritance is snapshot-at-creation with an explicit "re-sync from parent."

**Tech Stack:** React 19 · TypeScript · TanStack Start (file-based routes) · Zustand + IndexedDB data store · Blueprint React (`@buildoutinc/blueprint-react`) · FontAwesome Pro · Vitest · Bun.

## Global Constraints

- Package manager is **Bun**: run everything with `bun --bun run <script>` (e.g. `bun --bun run test`, `bun --bun run build`).
- All UI uses **Blueprint React** components imported from the `ui` subpath; spacing/layout via **Bootstrap 5 utility classes** (never Tailwind).
- Icons are **FontAwesome Pro**, default weight **`pro-regular`**. Do **not** pass `fixedWidth` to `FontAwesomeIcon` (deprecated in this project).
- Never add or restructure a component's visual design beyond what a task specifies — behavior changes only.
- **Do NOT use Playwright.** Run unit tests (`bun --bun run test`) and `bun --bun run build` for verification; for anything that needs a running browser, add a manual verification step for the user.
- The persisted data shape is versioned by `SEED_VERSION` in the data store — any change to seeded/stored shapes must bump it so IndexedDB re-seeds.
- Never edit `src/routes/routeTree.gen.ts` (auto-generated).
- Scope is **landlord rep (sell-side) only**. Buy-side / tenant-rep is untouched.

---

### Task 1: Data-model foundation — new fields + defaults

Adds the persisted fields the rest of the plan depends on. No behavior yet.

**Files:**
- Modify: `src/data/types.ts` — `Listing` (add `parentDealId`, `tenantContactIds`), `DealTransaction` (add `leaseCommencementDate`)
- Modify: `src/data/createListing.ts` — `createProposalListing` sets the new fields on new deals; `emptyDraft` unaffected
- Modify: `src/data/dataStore.ts` — bump `SEED_VERSION`; migrate any in-memory seed shape if it constructs listings/transactions literally
- Test: `src/data/createListing.test.ts` (create)

**Interfaces:**
- Produces:
  - `Listing.parentDealId: string | null` — `null` for top-level (flat deal or umbrella parent); the parent's `id` for a child space deal.
  - `Listing.tenantContactIds: string[]` — dedicated Tenant dataset (distinct from `buyerContactIds`).
  - `DealTransaction.leaseCommencementDate: string | null` — tenancy start captured entering Closed.
  - `createProposalListing(draft: NewListingDraft): Listing` — now always sets `parentDealId: null`, `tenantContactIds: []`, `transaction.leaseCommencementDate: null`.

- [ ] **Step 1: Write the failing test**

Create `src/data/createListing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'

describe('createProposalListing — lease-workflow fields', () => {
  it('defaults new relational + lease fields', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Test Deal', dealType: 'Lease' })
    expect(deal.parentDealId).toBeNull()
    expect(deal.tenantContactIds).toEqual([])
    expect(deal.transaction.leaseCommencementDate).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/createListing.test.ts`
Expected: FAIL — `parentDealId`/`tenantContactIds`/`leaseCommencementDate` are `undefined` (properties don't exist yet).

- [ ] **Step 3: Add the type fields**

In `src/data/types.ts`, inside `interface Listing` (after `unitId: string | null` around line 220), add:

```ts
  /** Parent umbrella deal id when this is a child space deal; null for top-level deals. */
  parentDealId: string | null
```

Still in `interface Listing`, next to the other contact-id arrays (after `buyerContactIds: string[]`), add:

```ts
  /** Tenant(s) entering the lease — dedicated dataset, distinct from buyerContactIds. */
  tenantContactIds: string[]
```

In `interface DealTransaction` (after `listingExpirationDate: string | null` around line 369), add:

```ts
  /** Tenancy start date, captured entering Closed on a lease deal. */
  leaseCommencementDate: string | null
```

- [ ] **Step 4: Set the fields when a deal is created**

In `src/data/createListing.ts`, inside the `const listing: Listing = { ... }` literal in `createProposalListing`:

Add next to `unitId: null,` (around line 455):

```ts
    parentDealId: null,
```

Add next to `buyerContactIds: buyer ? [buyer.id] : [],` (around line 462):

```ts
    tenantContactIds: [],
```

In the same literal's `transaction: { ... }` block, add next to `listingExpirationDate: null,` (around line 520):

```ts
      leaseCommencementDate: null,
```

- [ ] **Step 5: Bump the seed version**

In `src/data/dataStore.ts`, find `SEED_VERSION` and increment it by one (e.g. `const SEED_VERSION = 8` → `9`). If the seed file constructs `Listing` or `DealTransaction` object literals directly (grep `leaseCommencementDate`/`tenantContactIds` — if seed literals exist they will now be type errors), add the same three fields (`parentDealId: null`, `tenantContactIds: []`, `leaseCommencementDate: null`) to each seeded literal.

Run: `bun --bun run build` and fix any TypeScript errors reported for missing `parentDealId` / `tenantContactIds` / `leaseCommencementDate` on seed literals by adding those defaults.
Expected: build succeeds (0 errors).

- [ ] **Step 6: Run test to verify it passes**

Run: `bun --bun run test src/data/createListing.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/types.ts src/data/createListing.ts src/data/dataStore.ts src/data/createListing.test.ts
git commit -m "feat(lease): add parentDealId, tenantContactIds, leaseCommencementDate to the deal model"
```

---

### Task 2: `resolveGate` lease branch + required-field wiring

Completes the lease gate configuration: rent/units/SF at Active (no asking price), Tenant + term at Under Contract, commencement date at Closed.

**Files:**
- Modify: `src/data/stageGates.ts` — `RequiredField` union, `REQUIRED_FIELD_LABEL`, `resolveGate`, `fieldSatisfied`
- Test: `src/data/stageGates.lease.test.ts` (create)

**Interfaces:**
- Consumes: `resolveGate(from, target, dealType)` (existing) and `RequiredField` (existing) from Task 1's unchanged `stageGates.ts`.
- Produces:
  - New `RequiredField` members: `'tenantLinked' | 'leaseRate' | 'availableSqFt' | 'leaseTermMonths' | 'leaseCommencementDate'`.
  - `resolveGate('proposal','active','Lease')` requires `['saleTitle','saleDescription','leaseRate','availableSqFt','aiDocsReviewed','websiteReviewed','listedOnDate','listingExpirationDate']`.
  - `resolveGate('active','under-contract','Lease')` requires `['tenantLinked','leaseTermMonths','commissionAmount']`.
  - `resolveGate('under-contract','closed','Lease')` requires `['leaseCommencementDate']`.
  - Sale gates are byte-for-byte unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/data/stageGates.lease.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveGate } from './stageGates'

describe('resolveGate — lease branch', () => {
  it('Active (publish) gates on lease rate + available SF, not asking price', () => {
    const g = resolveGate('proposal', 'active', 'Lease')
    expect(g.required).toEqual([
      'saleTitle', 'saleDescription', 'leaseRate', 'availableSqFt',
      'aiDocsReviewed', 'websiteReviewed', 'listedOnDate', 'listingExpirationDate',
    ])
    expect(g.required).not.toContain('askingPrice')
    expect(g.publishes).toBe(true)
  })

  it('Under Contract gates on tenant + lease term (not buyer/sale price)', () => {
    const g = resolveGate('active', 'under-contract', 'Lease')
    expect(g.required).toEqual(['tenantLinked', 'leaseTermMonths', 'commissionAmount'])
    expect(g.required).not.toContain('buyerLinked')
    expect(g.required).not.toContain('salePrice')
  })

  it('Closed gates on lease commencement date', () => {
    const g = resolveGate('under-contract', 'closed', 'Lease')
    expect(g.required).toEqual(['leaseCommencementDate'])
  })

  it('Sale gates are unchanged', () => {
    expect(resolveGate('proposal', 'active', 'Sale').required).toContain('askingPrice')
    expect(resolveGate('active', 'under-contract', 'Sale').required).toEqual(
      ['buyerLinked', 'salePrice', 'commissionAmount'],
    )
    expect(resolveGate('under-contract', 'closed', 'Sale').required).toEqual(['closeDate'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/stageGates.lease.test.ts`
Expected: FAIL — lease `required` arrays still contain sale fields / are missing the new lease members.

- [ ] **Step 3: Extend the `RequiredField` union and labels**

In `src/data/stageGates.ts`, extend the `RequiredField` union (ends at `| 'askingPrice'` around line 25):

```ts
  | 'askingPrice'
  | 'tenantLinked'
  | 'leaseRate'
  | 'availableSqFt'
  | 'leaseTermMonths'
  | 'leaseCommencementDate'
```

Add the matching entries to `REQUIRED_FIELD_LABEL` (after `askingPrice: 'Asking price',` around line 105):

```ts
  tenantLinked: 'Tenant',
  leaseRate: 'Lease rate',
  availableSqFt: 'Available SF',
  leaseTermMonths: 'Lease term',
  leaseCommencementDate: 'Commencement date',
```

- [ ] **Step 4: Update `resolveGate` lease branches**

In `resolveGate`, replace the `case 'active':` `required` array (around lines 205-214) with a lease-aware version:

```ts
      return {
        ...base,
        kind: 'field',
        title: 'Approve & Publish',
        required: [
          'saleTitle',
          'saleDescription',
          // Sale gates on asking price; lease gates on rate + available SF.
          ...(isLease
            ? (['leaseRate', 'availableSqFt'] as const)
            : (['askingPrice'] as const)),
          'aiDocsReviewed',
          'websiteReviewed',
          'listedOnDate',
          'listingExpirationDate',
        ],
        publishes: true,
      }
```

Replace the `case 'under-contract':` `required` (around lines 222-224) with:

```ts
        required: isLease
          ? ['tenantLinked', 'leaseTermMonths', 'commissionAmount']
          : ['buyerLinked', 'salePrice', 'commissionAmount'],
```

Replace the `case 'closed':` return (around line 228) with a lease-aware close requirement:

```ts
    case 'closed':
      return {
        ...base,
        kind: 'field',
        title: 'Move to Closed',
        required: isLease ? ['leaseCommencementDate'] : ['closeDate'],
        publishes: false,
      }
```

- [ ] **Step 5: Teach `fieldSatisfied` the new fields**

In `fieldSatisfied` (around line 236), add cases before the closing brace of the `switch`:

```ts
    case 'tenantLinked':
      return form.tenantLinked
    case 'leaseRate':
      return form.leaseRate != null && form.leaseRate > 0
    case 'availableSqFt':
      return form.availableSqFt != null && form.availableSqFt > 0
    case 'leaseTermMonths':
      return form.leaseTermMonths != null && form.leaseTermMonths > 0
    case 'leaseCommencementDate':
      return !!form.leaseCommencementDate
```

> These read new `GateFormState` fields added in Task 3. This task will not typecheck standalone; run the test with `bun --bun run test` (Vitest transpiles per-file) — the union/label/resolveGate assertions pass. The full `bun --bun run build` typecheck happens at the end of Task 3.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun --bun run test src/data/stageGates.lease.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 7: Commit**

```bash
git add src/data/stageGates.ts src/data/stageGates.lease.test.ts
git commit -m "feat(lease): resolveGate lease branch — rent/SF at Active, tenant/term at UC, commencement at Close"
```

---

### Task 3: Gate form state + commit path for lease fields

Wires the new lease fields through the gate form (`GateFormState`), seeding (`seedGateForm`), the transition input (`buildTransitionInput` + `StageTransitionInput`), and the commit action (`commitStageTransition`), so a committed lease gate actually persists rate/SF/tenant/term/commencement.

**Files:**
- Modify: `src/data/stageGates.ts` — `GateFormState`, `EMPTY_GATE_FORM`, `seedGateForm`, `buildTransitionInput`, `StageTransitionInput`
- Modify: `src/data/actions.ts` — `commitStageTransition` folds lease fields into `marketing.spaceLeaseTerms` / `marketing.availableSqFt` / `transaction.leaseCommencementDate` / `tenantContactIds`
- Test: `src/data/stageGates.leaseCommit.test.ts` (create)

**Interfaces:**
- Consumes: `GateConfig`, `resolveGate`, the `RequiredField` members from Task 2; `Listing`/`DealTransaction`/`SpaceLeaseTerms`/`LeaseRateUnits` from `types.ts`; `emptySpaceLeaseTerms(unitId)` from `createListing.ts`.
- Produces:
  - `GateFormState` gains: `tenantLinked: boolean`, `tenantContactId: string | null`, `leaseRate: number | null`, `leaseRateUnits: LeaseRateUnits`, `availableSqFt: number | null`, `leaseTermMonths: number | null`, `leaseCommencementDate: string | null`.
  - `seedGateForm(deal)` seeds those from the deal (lease title/desc from `marketing.leaseTitle/leaseDescription` when `dealType==='Lease'`; rate/units/SF from `marketing.spaceLeaseTerms[0]` / `marketing.availableSqFt`).
  - `StageTransitionInput` gains optional `tenantContactId`, `leaseRate`, `leaseRateUnits`, `availableSqFt`, `leaseTermMonths` (and `transaction.leaseCommencementDate`).
  - `buildTransitionInput(config, form, dealId, actor, dealType)` — **new 5th arg** `dealType: DealType`; routes title/description to `saleTitle`/`saleDescription` (Sale) or `leaseTitle`/`leaseDescription` (Lease), and passes the lease scalars through.
  - `commitStageTransition(input)` merges the lease scalars into the deal's first `spaceLeaseTerms` record (creating one for `unitId` when absent), `marketing.availableSqFt`, `transaction.leaseCommencementDate`, and appends `tenantContactId` to `tenantContactIds`.

- [ ] **Step 1: Write the failing test**

Create `src/data/stageGates.leaseCommit.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { commitStageTransition } from './actions'
import { getListing } from './store'
import { resolveGate, seedGateForm, buildTransitionInput } from './stageGates'

describe('lease gate commit', () => {
  it('publishes a lease deal with rate + available SF onto its space terms', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Suite 100', dealType: 'Lease' })
    const config = resolveGate('proposal', 'active', 'Lease')
    const form = {
      ...seedGateForm(deal),
      saleTitle: 'Prime Suite 100',
      saleDescription: 'Corner retail',
      leaseRate: 32,
      leaseRateUnits: 'SF/Yr' as const,
      availableSqFt: 2400,
      listedOnDate: '2026-08-01',
      listingExpirationDate: '2027-08-01',
      aiDocsAllReviewed: true,
      websiteReviewed: true,
    }
    const input = buildTransitionInput(config, form, deal.id, 'Tester', 'Lease')
    commitStageTransition(input)

    const saved = getListing(deal.id)!
    expect(saved.status).toBe('active')
    expect(saved.publishedAt).not.toBeNull()
    expect(saved.marketing.leaseTitle).toBe('Prime Suite 100')
    expect(saved.marketing.availableSqFt).toBe(2400)
    expect(saved.marketing.spaceLeaseTerms[0]?.leaseRate).toBe(32)
    expect(saved.marketing.spaceLeaseTerms[0]?.leaseRateUnits).toBe('SF/Yr')
  })

  it('captures tenant + commencement date on the way to Closed', () => {
    const deal = createProposalListing({ ...emptyDraft(), name: 'Suite 200', dealType: 'Lease' })
    const closeCfg = resolveGate('under-contract', 'closed', 'Lease')
    const form = { ...seedGateForm(deal), leaseCommencementDate: '2026-10-01' }
    commitStageTransition(buildTransitionInput(closeCfg, form, deal.id, 'Tester', 'Lease'))
    expect(getListing(deal.id)!.transaction.leaseCommencementDate).toBe('2026-10-01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/stageGates.leaseCommit.test.ts`
Expected: FAIL — `buildTransitionInput` takes 4 args (Tս error / lease fields undefined), lease terms not persisted.

- [ ] **Step 3: Extend `GateFormState` + `EMPTY_GATE_FORM`**

In `src/data/stageGates.ts`, add the `LeaseRateUnits` import to the type import block at the top:

```ts
import type {
  DealMarketing,
  DealPitchFinancials,
  DealSide,
  DealTransaction,
  DealType,
  LeaseRateUnits,
  Listing,
  PropertyStatus,
} from './types'
```

Add these fields to `interface GateFormState` (after `askingPrice: number | null` around line 49):

```ts
  /** Under Contract (lease): tenant linked. */
  tenantLinked: boolean
  tenantContactId: string | null
  /** Approve & Publish (lease): rate + units + available SF, seeded from spaceLeaseTerms[0]. */
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  availableSqFt: number | null
  /** Under Contract (lease): lease term in months. */
  leaseTermMonths: number | null
  /** Closed (lease): tenancy start. */
  leaseCommencementDate: string | null
```

Add the defaults to `EMPTY_GATE_FORM` (after `askingPrice: null,` around line 125):

```ts
  tenantLinked: false,
  tenantContactId: null,
  leaseRate: null,
  leaseRateUnits: 'SF/Yr',
  availableSqFt: null,
  leaseTermMonths: null,
  leaseCommencementDate: null,
```

- [ ] **Step 4: Seed the lease fields in `seedGateForm`**

In `seedGateForm` (around line 133), add before the `return { ...EMPTY_GATE_FORM, ...}` a lease-aware read, then include the fields in the returned object. Replace the current `seedGateForm` body with:

```ts
export function seedGateForm(deal: Listing): GateFormState {
  const aiDocs = (deal.documents ?? []).filter((d) => d.aiGenerated)
  const isLease = deal.dealType === 'Lease'
  const space = deal.marketing.spaceLeaseTerms[0]
  return {
    ...EMPTY_GATE_FORM,
    buyerLinked: deal.buyerContactIds.length > 0,
    buyerContactId: deal.buyerContactIds[0] ?? null,
    tenantLinked: deal.tenantContactIds.length > 0,
    tenantContactId: deal.tenantContactIds[0] ?? null,
    listedOnDate: deal.transaction.listedOnDate,
    listingExpirationDate: deal.transaction.listingExpirationDate,
    contractExecutedDate: deal.transaction.contractExecutedDate,
    closeDate: deal.transaction.closeDate,
    salePrice: deal.transaction.salePrice || null,
    commissionAmount: deal.transaction.commissionAmount || null,
    commissionPct: deal.transaction.commissionPct || null,
    deadReason: deal.transaction.deadReason,
    // Title/description: lease deals read the lease copy, sale deals the sale copy.
    saleTitle: isLease ? deal.marketing.leaseTitle : deal.marketing.saleTitle,
    saleDescription: isLease ? deal.marketing.leaseDescription : deal.marketing.saleDescription,
    askingPrice: deal.financials.askingPrice || null,
    leaseRate: space?.leaseRate ?? null,
    leaseRateUnits: space?.leaseRateUnits ?? 'SF/Yr',
    availableSqFt: deal.marketing.availableSqFt || null,
    leaseTermMonths: space?.leaseTermMonths ?? null,
    leaseCommencementDate: deal.transaction.leaseCommencementDate,
    aiDocsAllReviewed: aiDocs.length === 0,
    websiteReviewed: false,
  }
}
```

- [ ] **Step 5: Extend `StageTransitionInput` + `buildTransitionInput`**

Add the optional lease scalars to `interface StageTransitionInput` (after `buyerContactId?: string` around line 74):

```ts
  tenantContactId?: string
  leaseRate?: number | null
  leaseRateUnits?: LeaseRateUnits
  availableSqFt?: number | null
  leaseTermMonths?: number | null
```

Replace `buildTransitionInput` (around line 270) with the dealType-aware version:

```ts
export function buildTransitionInput(
  config: GateConfig,
  form: GateFormState,
  dealId: string,
  actor: string,
  dealType: DealType,
): StageTransitionInput {
  const isLease = dealType === 'Lease'
  const transaction: Partial<DealTransaction> = {}
  if (form.listedOnDate) transaction.listedOnDate = form.listedOnDate
  if (form.listingExpirationDate) transaction.listingExpirationDate = form.listingExpirationDate
  if (form.contractExecutedDate) transaction.contractExecutedDate = form.contractExecutedDate
  if (form.closeDate) transaction.closeDate = form.closeDate
  if (form.salePrice != null) transaction.salePrice = form.salePrice
  if (form.commissionAmount != null) transaction.commissionAmount = form.commissionAmount
  if (form.commissionPct != null) transaction.commissionPct = form.commissionPct
  if (form.deadReason) transaction.deadReason = form.deadReason
  if (form.leaseCommencementDate) transaction.leaseCommencementDate = form.leaseCommencementDate

  const input: StageTransitionInput = { dealId, targetStage: config.targetStage, actor }
  if (Object.keys(transaction).length > 0) input.transaction = transaction
  if (form.buyerContactId) input.buyerContactId = form.buyerContactId
  if (form.tenantContactId) input.tenantContactId = form.tenantContactId
  if (form.leaseTermMonths != null) input.leaseTermMonths = form.leaseTermMonths

  if (config.publishes) {
    input.publish = true
    const marketing: Partial<DealMarketing> = {}
    // Route title/description to the right marketing copy for the deal type.
    if (form.saleTitle) {
      if (isLease) marketing.leaseTitle = form.saleTitle
      else marketing.saleTitle = form.saleTitle
    }
    if (form.saleDescription) {
      if (isLease) marketing.leaseDescription = form.saleDescription
      else marketing.saleDescription = form.saleDescription
    }
    if (Object.keys(marketing).length > 0) input.marketing = marketing
    if (isLease) {
      if (form.leaseRate != null) input.leaseRate = form.leaseRate
      input.leaseRateUnits = form.leaseRateUnits
      if (form.availableSqFt != null) input.availableSqFt = form.availableSqFt
    } else if (form.askingPrice != null) {
      input.financials = { askingPrice: form.askingPrice }
    }
  }
  if (config.leavesActive && form.unpublishOnExit) input.unpublish = true
  return input
}
```

- [ ] **Step 6: Fold lease fields into the commit action**

In `src/data/actions.ts`, add the `emptySpaceLeaseTerms` import at the top (next to the existing `createProposalListing` import from `./createListing`):

```ts
import { createProposalListing, emptySpaceLeaseTerms, type NewListingDraft } from './createListing'
```

Inside `commitStageTransition`'s `patchListing` callback (around line 78), after the `const publishedAt = ...` line and before the `return { ...l, ... }`, add lease-field derivation:

```ts
      // Fold lease-gate scalars into the marketed space's terms + marketing.
      const hasLeaseTerms =
        input.leaseRate != null || input.leaseRateUnits != null ||
        input.leaseTermMonths != null
      let marketing = input.marketing ? { ...l.marketing, ...input.marketing } : l.marketing
      if (hasLeaseTerms || input.availableSqFt != null) {
        const terms = [...marketing.spaceLeaseTerms]
        const unitId = l.unitId ?? terms[0]?.unitId ?? 'whole-property'
        const base = terms[0] ?? emptySpaceLeaseTerms(unitId)
        terms[0] = {
          ...base,
          leaseRate: input.leaseRate ?? base.leaseRate,
          leaseRateUnits: input.leaseRateUnits ?? base.leaseRateUnits,
          leaseTermMonths: input.leaseTermMonths ?? base.leaseTermMonths,
        }
        marketing = {
          ...marketing,
          spaceLeaseTerms: terms,
          availableSqFt: input.availableSqFt ?? marketing.availableSqFt,
        }
      }
      const tenantContactIds =
        input.tenantContactId && !l.tenantContactIds.includes(input.tenantContactId)
          ? [...l.tenantContactIds, input.tenantContactId]
          : l.tenantContactIds
```

Then in the returned object literal (around line 99), replace the `marketing:` line and add `tenantContactIds`:

```ts
      return {
        ...l,
        status: input.targetStage,
        dealSide: input.dealSide ?? l.dealSide,
        sellerContactIds,
        buyerContactIds,
        tenantContactIds,
        publishedAt,
        transaction: { ...l.transaction, ...input.transaction },
        marketing,
        financials: input.financials ? { ...l.financials, ...input.financials } : l.financials,
        history: [...l.history, historyEntry],
        updatedAt: now,
      }
```

- [ ] **Step 7: Update the existing `buildTransitionInput` caller in `StageGate.tsx`**

In `src/components/deals/StageGate.tsx`, the `commit` function (around line 237) calls `buildTransitionInput(config, effectiveForm, deal.id, ...)`. Add the new 5th arg:

```ts
    const input = buildTransitionInput(
      config,
      effectiveForm,
      deal.id,
      deal.internalBrokers[0]?.name ?? "You",
      deal.dealType,
    );
```

- [ ] **Step 8: Run test + full typecheck**

Run: `bun --bun run test src/data/stageGates.leaseCommit.test.ts && bun --bun run test src/data/stageGates.lease.test.ts && bun --bun run build`
Expected: both test files PASS; `build` reports 0 TypeScript errors (Task 2's `fieldSatisfied` now compiles against the new `GateFormState`).

- [ ] **Step 9: Commit**

```bash
git add src/data/stageGates.ts src/data/actions.ts src/components/deals/StageGate.tsx src/data/stageGates.leaseCommit.test.ts
git commit -m "feat(lease): persist lease gate fields (rate/SF/tenant/term/commencement) through commit"
```

---

### Task 4: Umbrella actions + selectors (add space, promote, inherit, re-sync, rollup)

The core relational behavior: spawn a child space deal bound to a Property unit, write new units back to the Property, snapshot the parent's marketing template, re-sync on demand, and derive umbrella state/rollup.

**Files:**
- Create: `src/data/leaseSpaces.ts` — the space actions + selectors
- Modify: `src/data/store.ts` — add `addPropertyUnit`
- Modify: `src/data/actions.ts` — `linkContactToDeal` accepts `'tenant'`
- Test: `src/data/leaseSpaces.test.ts` (create)

**Interfaces:**
- Consumes: `getProperty`, `updateProperty`, `getListing`, `addListing`, `getListingsForProperty` (store); `Listing`, `Property`, `PropertyUnit`, `UnitType` (types); `emptySpaceLeaseTerms` (createListing).
- Produces:
  - `addPropertyUnit(propertyId: string, unit: { label: string; sqft: number; unitType: UnitType }): PropertyUnit | undefined` — appends a `PropertyUnit` to the Property and returns it.
  - `addSpaceToDeal(parentDealId: string, unitId: string): { deal: Listing } | null` — creates a child `Listing` (`parentDealId` set, `unitId` bound, `status: 'proposal'`, `publishedAt: null`), snapshotting the parent's marketing template, seeding one `spaceLeaseTerms` record for the unit, and inserting it into the store.
  - `resyncChildFromParent(childId: string): { deal: Listing } | null` — overwrites the child's template fields (lease title/description/bullets, channel, visibility, propertyUse/investmentType) from its parent; leaves the child's own rate/SF/tenant/stage intact.
  - `getChildDeals(parentDealId: string): Listing[]` — children of an umbrella (excludes the parent).
  - `isUmbrella(dealId: string): boolean` — `getChildDeals(dealId).length > 0`.
  - `spacesStageBreakdown(parentDealId: string): { total: number; byStage: Record<PropertyStatus, number> }` — rollup for the parent card.

- [ ] **Step 1: Write the failing test**

Create `src/data/leaseSpaces.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createProposalListing, emptyDraft } from './createListing'
import { getProperty, getListing } from './store'
import {
  addPropertyUnit, addSpaceToDeal, resyncChildFromParent,
  getChildDeals, isUmbrella, spacesStageBreakdown,
} from './leaseSpaces'
import { commitStageTransition } from './actions'

function makeParent() {
  return createProposalListing({ ...emptyDraft(), name: 'Mall Assignment', dealType: 'Lease' })
}

describe('lease space actions', () => {
  it('writes a new unit back to the property and spawns a bound child', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 100', sqft: 2400, unitType: 'retail' })!
    expect(getProperty(parent.propertyId)!.units.some((u) => u.id === unit.id)).toBe(true)

    const res = addSpaceToDeal(parent.id, unit.id)!
    expect(res.deal.parentDealId).toBe(parent.id)
    expect(res.deal.unitId).toBe(unit.id)
    expect(res.deal.status).toBe('proposal')
    expect(res.deal.publishedAt).toBeNull()
    expect(res.deal.marketing.spaceLeaseTerms[0]?.unitId).toBe(unit.id)
    expect(isUmbrella(parent.id)).toBe(true)
    expect(getChildDeals(parent.id).map((c) => c.id)).toContain(res.deal.id)
  })

  it('snapshots the parent template and re-syncs on demand', () => {
    const parent = makeParent()
    const unit = addPropertyUnit(parent.propertyId, { label: 'Suite 200', sqft: 1000, unitType: 'retail' })!
    // Parent gets a template.
    commitStageTransition({ dealId: parent.id, targetStage: 'proposal', actor: 'T', marketing: { leaseTitle: 'Mall Brand' } })
    const child = addSpaceToDeal(parent.id, unit.id)!.deal
    expect(child.marketing.leaseTitle).toBe('Mall Brand')
    // Parent template changes after the child was created.
    commitStageTransition({ dealId: parent.id, targetStage: 'proposal', actor: 'T', marketing: { leaseTitle: 'Mall Rebrand' } })
    expect(getListing(child.id)!.marketing.leaseTitle).toBe('Mall Brand') // snapshot, unchanged
    resyncChildFromParent(child.id)
    expect(getListing(child.id)!.marketing.leaseTitle).toBe('Mall Rebrand') // re-pulled
  })

  it('rolls up child stages', () => {
    const parent = makeParent()
    const u1 = addPropertyUnit(parent.propertyId, { label: 'A', sqft: 500, unitType: 'retail' })!
    const u2 = addPropertyUnit(parent.propertyId, { label: 'B', sqft: 500, unitType: 'retail' })!
    const c1 = addSpaceToDeal(parent.id, u1.id)!.deal
    addSpaceToDeal(parent.id, u2.id)
    commitStageTransition({ dealId: c1.id, targetStage: 'active', actor: 'T' })
    const rollup = spacesStageBreakdown(parent.id)
    expect(rollup.total).toBe(2)
    expect(rollup.byStage.active).toBe(1)
    expect(rollup.byStage.proposal).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/leaseSpaces.test.ts`
Expected: FAIL — `./leaseSpaces` module and `addPropertyUnit` do not exist.

- [ ] **Step 3: Add `addPropertyUnit` to the store**

In `src/data/store.ts`, add after `updateProperty` (around line 86). Ensure `PropertyUnit` and `UnitType` are imported from `./types` at the top of the file (add them if missing):

```ts
/** Append a new unit shell to a Property (source of truth) and return the created unit. */
export function addPropertyUnit(
  propertyId: string,
  unit: { label: string; sqft: number; unitType: UnitType },
): PropertyUnit | undefined {
  const existing = getStore().properties.get(propertyId)
  if (!existing) return undefined
  const created: PropertyUnit = {
    id: crypto.randomUUID(),
    label: unit.label,
    unitType: unit.unitType,
    sqft: unit.sqft,
    beds: null,
    baths: null,
    suite: null,
    floor: null,
    ceilingHeight: null,
    offices: null,
    conferenceRooms: null,
    furnished: false,
    saleHistory: [],
  }
  updateProperty(propertyId, { units: [...existing.units, created] })
  return created
}
```

- [ ] **Step 4: Allow linking a tenant**

In `src/data/actions.ts`, change `linkContactToDeal`'s signature + key map (around line 162) to accept `'tenant'`:

```ts
export function linkContactToDeal(
  dealId: string,
  contactId: string,
  role: 'seller' | 'buyer' | 'tenant' | 'other',
): { deal: Listing | null } {
  const key =
    role === 'seller' ? 'sellerContactIds'
    : role === 'buyer' ? 'buyerContactIds'
    : role === 'tenant' ? 'tenantContactIds'
    : 'otherContactIds'
  return {
    deal: patchListing(dealId, (l) =>
      l[key].includes(contactId) ? l : { ...l, [key]: [...l[key], contactId] },
    ),
  }
}
```

- [ ] **Step 5: Create the space-actions module**

Create `src/data/leaseSpaces.ts`:

```ts
import type { Listing, PropertyStatus } from './types'
import { getListing, getProperty, addListing } from './store'
import { emptySpaceLeaseTerms } from './createListing'

/** Marketing fields a child inherits (snapshot) from its umbrella parent. */
const TEMPLATE_KEYS = [
  'leaseTitle', 'leaseDescription', 'leaseBullets', 'leaseCommissionSplitPct',
  'propertyUse', 'investmentType', 'marketingChannel', 'visibilityTier',
] as const

/** Copy the parent's template fields into a marketing object. */
function applyTemplate(target: Listing['marketing'], parent: Listing['marketing']): Listing['marketing'] {
  const patch: Partial<Listing['marketing']> = {}
  for (const k of TEMPLATE_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(patch as any)[k] = parent[k]
  }
  return { ...target, ...patch }
}

/** Children of an umbrella deal (excludes the parent itself). */
export function getChildDeals(parentDealId: string): Listing[] {
  const store = getListing // noop ref to keep import used across builds
  void store
  return [...(globalThis as never as { __never?: never }, listingsSnapshot())].filter(
    (l) => l.parentDealId === parentDealId,
  )
}

/** All listings as an array (small helper so selectors don't reach into the store map shape). */
function listingsSnapshot(): Listing[] {
  // getListingsForProperty is per-property; we need all. Read from the store directly.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getStore } = require('./store') as typeof import('./store')
  return [...getStore().listings.values()]
}

export function isUmbrella(dealId: string): boolean {
  return getChildDeals(dealId).length > 0
}

export function spacesStageBreakdown(parentDealId: string): {
  total: number
  byStage: Record<PropertyStatus, number>
} {
  const byStage: Record<PropertyStatus, number> = {
    proposal: 0, active: 0, 'under-contract': 0, closed: 0, inactive: 0,
  }
  const children = getChildDeals(parentDealId)
  for (const c of children) byStage[c.status] += 1
  return { total: children.length, byStage }
}

export function addSpaceToDeal(
  parentDealId: string,
  unitId: string,
): { deal: Listing } | null {
  const parent = getListing(parentDealId)
  if (!parent) return null
  const property = getProperty(parent.propertyId)
  const unit = property?.units.find((u) => u.id === unitId)
  if (!property || !unit) return null

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const dealId = `D-${String(Math.floor(Date.now() % 100000)).padStart(5, '0')}`
  const childrenCount = getChildDeals(parentDealId).length

  const child: Listing = {
    ...parent,
    id,
    dealId,
    parentDealId,
    unitId,
    name: `${parent.name} — ${unit.label}`,
    slug: `${parent.slug}-space-${childrenCount + 1}`,
    status: 'proposal',
    publishedAt: null,
    // Own pipeline state — start clean, do not inherit the parent's parties/history.
    sellerContactIds: [...parent.sellerContactIds],
    buyerContactIds: [],
    tenantContactIds: [],
    otherContactIds: [],
    tasks: [],
    messages: [],
    activities: [],
    history: [
      { id: crypto.randomUUID(), label: 'Created under', fromStage: null, toStage: 'proposal', actor: 'You (Listing Broker)', timestamp: now },
    ],
    documents: [],
    marketing: applyTemplate(
      {
        ...parent.marketing,
        availableSqFt: unit.sqft,
        spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unitId) }],
      },
      parent.marketing,
    ),
    createdAt: now,
    updatedAt: now,
  }

  addListing(child)
  return { deal: child }
}

export function resyncChildFromParent(childId: string): { deal: Listing } | null {
  const child = getListing(childId)
  if (!child || !child.parentDealId) return null
  const parent = getListing(child.parentDealId)
  if (!parent) return null
  const { updateDealMarketing } = require('./actions') as typeof import('./actions')
  const merged = applyTemplate(child.marketing, parent.marketing)
  const patch: Partial<Listing['marketing']> = {}
  for (const k of TEMPLATE_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(patch as any)[k] = (merged as any)[k]
  }
  const res = updateDealMarketing(childId, patch)
  return res.deal ? { deal: res.deal } : null
}
```

> Simplify the `getChildDeals`/`listingsSnapshot` helper: replace the convoluted body above with the clean version in Step 6 — it's written cleanly there. (Kept the comment here so the reviewer sees the intent.)

- [ ] **Step 6: Clean up the selector helper**

Replace the `getChildDeals` and `listingsSnapshot` definitions in `src/data/leaseSpaces.ts` with a clean version, and add `getStore` to the top import:

```ts
import { getListing, getProperty, addListing, getStore } from './store'
```

```ts
/** Children of an umbrella deal (excludes the parent itself). */
export function getChildDeals(parentDealId: string): Listing[] {
  return [...getStore().listings.values()].filter((l) => l.parentDealId === parentDealId)
}
```

Delete the `listingsSnapshot` function entirely. Also replace the two `require('./...')` calls with proper top-of-file imports:

```ts
import { updateDealMarketing } from './actions'
```

and remove the inline `const { updateDealMarketing } = require(...)` line in `resyncChildFromParent`, and remove the `const store = getListing; void store` lines. (If a circular-import runtime error appears between `actions.ts` and `leaseSpaces.ts`, keep `addListing`/`getListing` from the store and import `updateDealMarketing` lazily inside `resyncChildFromParent` via `const { updateDealMarketing } = await import('./actions')` — but prefer the static import; the store, not actions, is the shared dependency, so a cycle is unlikely.)

- [ ] **Step 7: Run test to verify it passes**

Run: `bun --bun run test src/data/leaseSpaces.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 8: Full typecheck**

Run: `bun --bun run build`
Expected: 0 TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add src/data/leaseSpaces.ts src/data/store.ts src/data/actions.ts src/data/leaseSpaces.test.ts
git commit -m "feat(lease): umbrella space actions — add/promote/inherit/re-sync + rollup selectors"
```

---

### Task 5: Sale/Lease pill tabs in the create-deal modal

Introduce the deal-type choice (the modal never sets `dealType` today) as pill tabs at the top of `CreateDealModal`, driving `draft.dealType`.

**Files:**
- Modify: `src/components/deals/CreateDealModal.tsx`
- Test: manual (browser) — no unit test (presentational)

**Interfaces:**
- Consumes: `NewListingDraft.dealType` (`'Sale' | 'Lease'`), `emptyDraft()` (both from `createListing.ts`).
- Produces: the modal sets `draft.dealType` from the pill selection; default stays `'Sale'`.

- [ ] **Step 1: Locate the draft state + modal top**

In `src/components/deals/CreateDealModal.tsx`, find where the component holds its draft state (a `useState<NewListingDraft>` seeded from `emptyDraft()`) and the first element rendered inside `<Modal.Body>` (or the step container). Read ~40 lines around each to confirm the setter name (assume `setDraft`).

- [ ] **Step 2: Add the `Tabs` import**

Add to the Blueprint imports at the top:

```tsx
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
```

- [ ] **Step 3: Render the pill tabs above everything in the body**

As the first child inside the modal body/step container, add:

```tsx
<Tabs
  value={draft.dealType}
  onValueChange={(v) => setDraft((d) => ({ ...d, dealType: v as NewListingDraft["dealType"] }))}
  className="mb-3"
>
  <Tabs.List>
    <Tabs.Trigger value="Sale">Sale</Tabs.Trigger>
    <Tabs.Trigger value="Lease">Lease</Tabs.Trigger>
  </Tabs.List>
</Tabs>
```

> If the modal is multi-step and step 1 already has a heading, place the tabs directly above that heading so they frame the whole flow. Use the exact `NewListingDraft` type name already imported in the file for the cast.

- [ ] **Step 4: Verify build**

Run: `bun --bun run build`
Expected: 0 TypeScript errors.

- [ ] **Step 5: Manual verification**

Run: `bun --bun run dev`, open the create-deal modal, confirm Sale/Lease pills render at the top, default to **Sale**, and switching to **Lease** persists (create a lease deal and confirm `dealType: 'Lease'` on the resulting deal — check via the deal page or the pipeline). Ask the user to confirm if you cannot drive the browser.

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/CreateDealModal.tsx
git commit -m "feat(lease): Sale/Lease pill tabs at the top of the create-deal modal"
```

---

### Task 6: Lease fields in the StageGate modal

Render the lease-specific inputs when the resolved gate requires them: rate + units + available SF at Approve & Publish, Tenant at Under Contract, commencement date at Closed. Sale gates render exactly as before.

**Files:**
- Modify: `src/components/deals/StageGate.tsx`
- Test: manual (browser) + the Task 3 commit unit test already covers the data path

**Interfaces:**
- Consumes: `GateFormState` fields `leaseRate`, `leaseRateUnits`, `availableSqFt`, `leaseTermMonths`, `leaseCommencementDate`, `tenantLinked`, `tenantContactId` (Task 3); `req(field)` helper (existing); `getSellerOptions` (existing, reused for the tenant picker); `CurrencyInput` (existing); `LeaseRateUnits` values (`'SF/Yr' | 'SF/Mo' | 'Monthly'`).
- Produces: gate UI that fills the lease fields; commit already persists them via Task 3.

- [ ] **Step 1: Guard the sale-only publish inputs**

In `StageGate.tsx`, the publish block renders "Asking price" unconditionally (around lines 324-341). Wrap the **Asking price** `<Field>` so it only shows for sale deals, and render lease inputs otherwise. Replace that Asking-price `<Field>...</Field>` with:

```tsx
{deal.dealType === "Sale" ? (
  <Field>
    <Field.Label>Asking price</Field.Label>
    <CurrencyInput
      value={form.askingPrice}
      onChange={(v) => set("askingPrice", v)}
    />
    <Field.Description>
      Editing here updates the listing.{" "}
      <a href={`/listings/${deal.id}/edit`} target="_blank" rel="noreferrer">
        Open full marketing editor{" "}
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
      </a>
    </Field.Description>
  </Field>
) : (
  <>
    <div className="d-flex gap-2">
      <Field className="flex-grow-1">
        <Field.Label>Lease rate</Field.Label>
        <CurrencyInput
          value={form.leaseRate}
          onChange={(v) => set("leaseRate", v)}
        />
      </Field>
      <Field style={{ width: 140 }}>
        <Field.Label>Units</Field.Label>
        <Select
          items={LEASE_RATE_UNIT_OPTIONS}
          value={form.leaseRateUnits}
          onValueChange={(v) => set("leaseRateUnits", v as typeof form.leaseRateUnits)}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Content>
            {LEASE_RATE_UNIT_OPTIONS.map((o) => (
              <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
            ))}
          </Select.Content>
        </Select>
      </Field>
    </div>
    <Field>
      <Field.Label>Available SF</Field.Label>
      <Input
        type="number"
        value={form.availableSqFt ?? ""}
        onChange={(e) => set("availableSqFt", e.target.value ? Number(e.target.value) : null)}
        placeholder="e.g. 2400"
      />
    </Field>
  </>
)}
```

- [ ] **Step 2: Add the lease-rate-units option constant**

Near the top of `StageGate.tsx` (after the `DATE_FORMAT` const around line 47), add:

```tsx
const LEASE_RATE_UNIT_OPTIONS = [
  { value: "SF/Yr", label: "SF/Yr" },
  { value: "SF/Mo", label: "SF/Mo" },
  { value: "Monthly", label: "Monthly" },
] as const;
```

- [ ] **Step 3: Render the Tenant picker (Under Contract, lease)**

The existing Buyer `<Field>` is guarded by `req("buyerLinked")`. Directly after that block (around line 437), add a Tenant field guarded by `req("tenantLinked")`, reusing `buyerOptions` (the property's contacts):

```tsx
{req("tenantLinked") && (
  <Field>
    <Field.Label>Tenant</Field.Label>
    <Select
      items={buyerOptions}
      value={form.tenantContactId ?? ""}
      onValueChange={(v) => {
        set("tenantContactId", v || null);
        set("tenantLinked", !!v || deal.tenantContactIds.length > 0);
      }}
    >
      <Select.Trigger>
        <Select.Value placeholder="Select a tenant…" />
      </Select.Trigger>
      <Select.Content>
        {buyerOptions.map((o) => (
          <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
        ))}
      </Select.Content>
    </Select>
  </Field>
)}
```

- [ ] **Step 4: Render lease term (Under Contract, lease) + commencement date (Closed, lease)**

After the commission `<Field>` blocks (around line 491), add lease term:

```tsx
{req("leaseTermMonths") && (
  <Field>
    <Field.Label>Lease term (months)</Field.Label>
    <Input
      type="number"
      value={form.leaseTermMonths ?? ""}
      onChange={(e) => set("leaseTermMonths", e.target.value ? Number(e.target.value) : null)}
      placeholder="e.g. 60"
    />
  </Field>
)}
{req("leaseCommencementDate") && (
  <Field>
    <Field.Label>Lease Commencement</Field.Label>
    <GateDatePicker
      value={form.leaseCommencementDate}
      onChange={(v) => set("leaseCommencementDate", v)}
      placeholder="Tenancy start date"
    />
  </Field>
)}
```

- [ ] **Step 5: Make the publish-summary label lease-aware (small polish)**

In the publish read-only summary (around line 291), the `<dt>Seller</dt>` label is fine for both sides, but the "Asking price"→lease swap means the title field label "Listing title" already suits both. No change needed beyond Steps 1-4. Verify the "Sale Price" field (`req("salePrice")`, around line 461) does **not** render for lease (it won't — `resolveGate` lease branch omits `salePrice`).

- [ ] **Step 6: Verify build**

Run: `bun --bun run build`
Expected: 0 TypeScript errors.

- [ ] **Step 7: Manual verification**

Run: `bun --bun run dev`. On a lease deal: open Approve & Publish → confirm **Lease rate + Units + Available SF** show (no Asking price) and the button stays disabled until they're filled; Active → Under Contract shows **Tenant + Lease term (months)**; Under Contract → Closed shows **Lease Commencement**. Confirm a Sale deal's gates are unchanged. Ask the user to confirm if you cannot drive the browser.

- [ ] **Step 8: Commit**

```bash
git add src/components/deals/StageGate.tsx
git commit -m "feat(lease): lease fields in the stage gate (rate/units/SF, tenant, term, commencement)"
```

---

### Task 7: Spaces tab + Add Space modal

A Spaces tab on the deal that lists child space deals and an "Add space" modal that picks from the Property's units (or adds a new unit) and spawns children.

**Files:**
- Create: `src/routes/_shell/listings/$listingId/spaces.tsx` — the Spaces tab route
- Create: `src/components/deals/AddSpaceModal.tsx` — the picker modal
- Modify: `src/components/properties/PropertyDetailSidebar.tsx` — add the "Spaces" nav item
- Test: manual (browser); logic covered by Task 4 unit tests

**Interfaces:**
- Consumes: `getChildDeals`, `addSpaceToDeal`, `addPropertyUnit` (Task 4); `getProperty`, `getListing` (store); `useDataStore` for reactive re-render; `STAGE_LABEL` (`stageGates.ts`); `DealStageChip` (existing, `src/components/deals/DealStageChip.tsx`); `faVectorSquare`, `faPlus` (FontAwesome pro-regular).
- Produces: `/listings/$listingId/spaces` route; `<AddSpaceModal open onOpenChange parentDealId onAdded? />`.

- [ ] **Step 1: Create the Add Space modal**

Create `src/components/deals/AddSpaceModal.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus } from "@fortawesome/pro-regular-svg-icons";
import type { UnitType } from "#/data/types";
import { getListing, getProperty } from "#/data/store";
import { getChildDeals, addSpaceToDeal, addPropertyUnit } from "#/data/leaseSpaces";

const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "retail", label: "Retail" },
  { value: "office", label: "Office" },
  { value: "industrial", label: "Industrial" },
  { value: "residential", label: "Residential" },
  { value: "other", label: "Other" },
];

export function AddSpaceModal({
  parentDealId,
  open,
  onOpenChange,
  onAdded,
}: {
  parentDealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}) {
  const deal = getListing(parentDealId);
  const property = deal ? getProperty(deal.propertyId) : undefined;

  // Units already spun into a child space deal — hide them from the picker.
  const usedUnitIds = useMemo(
    () => new Set(getChildDeals(parentDealId).map((c) => c.unitId).filter(Boolean) as string[]),
    [parentDealId, open],
  );
  const availableUnits = (property?.units ?? []).filter((u) => !usedUnitIds.has(u.id));

  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newLabel, setNewLabel] = useState("");
  const [newSqft, setNewSqft] = useState<number | null>(null);
  const [newType, setNewType] = useState<UnitType>("retail");

  // Reset local state when the modal (re)opens.
  const [seededOpen, setSeededOpen] = useState(false);
  if (open && !seededOpen) {
    setChecked(new Set());
    setNewLabel("");
    setNewSqft(null);
    setNewType("retail");
    setSeededOpen(true);
  }
  if (!open && seededOpen) setSeededOpen(false);

  if (!deal || !property) return null;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canAdd = checked.size > 0 || (newLabel.trim().length > 0 && (newSqft ?? 0) > 0);

  const commit = () => {
    // Spawn a child per checked existing unit.
    for (const unitId of checked) addSpaceToDeal(parentDealId, unitId);
    // Add a new unit to the property, then spawn its child.
    if (newLabel.trim() && (newSqft ?? 0) > 0) {
      const unit = addPropertyUnit(deal.propertyId, {
        label: newLabel.trim(),
        sqft: newSqft as number,
        unitType: newType,
      });
      if (unit) addSpaceToDeal(parentDealId, unit.id);
    }
    onOpenChange(false);
    onAdded?.();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>Add space</Modal.Title>
          <Modal.Description>
            Spin a space from {property.name} into its own deal.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          <div>
            <div className="fw-semibold mb-2">Property units</div>
            {availableUnits.length === 0 ? (
              <p className="text-muted mb-0">
                Every unit on this property already has a space deal. Add a new one below.
              </p>
            ) : (
              <div className="d-flex flex-column gap-2 border rounded p-2">
                {availableUnits.map((u) => (
                  <label key={u.id} className="d-flex align-items-center gap-2 mb-0">
                    <Checkbox
                      checked={checked.has(u.id)}
                      onCheckedChange={() => toggle(u.id)}
                    />
                    <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
                    <span className="fw-semibold">{u.label}</span>
                    <span className="text-muted ms-1">{u.sqft.toLocaleString()} SF</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="border-top pt-3">
            <div className="fw-semibold mb-2">
              <FontAwesomeIcon icon={faPlus} /> New space
            </div>
            <div className="d-flex gap-2">
              <Field className="flex-grow-1">
                <Field.Label>Label</Field.Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Suite 300"
                />
              </Field>
              <Field style={{ width: 140 }}>
                <Field.Label>SF</Field.Label>
                <Input
                  type="number"
                  value={newSqft ?? ""}
                  onChange={(e) => setNewSqft(e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field style={{ width: 160 }}>
                <Field.Label>Type</Field.Label>
                <Select
                  items={UNIT_TYPE_OPTIONS}
                  value={newType}
                  onValueChange={(v) => setNewType(v as UnitType)}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {UNIT_TYPE_OPTIONS.map((o) => (
                      <Select.Item key={o.value} value={o.value}>{o.label}</Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </Field>
            </div>
            <Field.Description>
              A new space is added to the property record, then spun into a deal.
            </Field.Description>
          </div>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!canAdd} onClick={commit}>
            Add space
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
```

- [ ] **Step 2: Create the Spaces tab route**

Create `src/routes/_shell/listings/$listingId/spaces.tsx`:

```tsx
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare, faPlus } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getChildDeals } from "#/data/leaseSpaces";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";
import { DealStageChip } from "#/components/deals/DealStageChip";

export const Route = createFileRoute("/_shell/listings/$listingId/spaces")({
  component: SpacesTab,
});

function SpacesTab() {
  const { listingId } = Route.useParams();
  // Reactive: re-render when a child is added (store map is replaced).
  const version = useDataStore((s) => s.listings);
  void version;
  const children = getChildDeals(listingId);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h5 mb-0">Spaces</h2>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          <FontAwesomeIcon icon={faPlus} /> Add space
        </Button>
      </div>

      {children.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faVectorSquare} aria-label="No spaces" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No spaces yet</Empty.Title>
            Add a space to spin an individual unit into its own deal — it inherits this deal&apos;s
            marketing template.
          </Empty.Content>
          <Empty.Actions>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <FontAwesomeIcon icon={faPlus} /> Add space
            </Button>
          </Empty.Actions>
        </Empty>
      ) : (
        <div className="d-flex flex-column gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              to="/listings/$listingId/overview"
              params={{ listingId: c.id }}
              className="d-flex align-items-center justify-content-between gap-3 border rounded p-3 text-decoration-none"
            >
              <span className="d-flex align-items-center gap-2 text-body fw-semibold">
                <FontAwesomeIcon icon={faVectorSquare} className="text-muted" />
                {c.name}
              </span>
              <span className="d-flex align-items-center gap-3">
                <span className="text-muted">
                  {c.marketing.spaceLeaseTerms[0]?.leaseRate
                    ? `$${c.marketing.spaceLeaseTerms[0]?.leaseRate} ${c.marketing.spaceLeaseTerms[0]?.leaseRateUnits}`
                    : "Rate TBD"}
                </span>
                <DealStageChip status={c.status} />
              </span>
            </Link>
          ))}
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

> Before writing, open `src/components/deals/DealStageChip.tsx` and confirm the prop name is `status` (a `PropertyStatus`). If it differs (e.g. `stage`), match the actual prop. Likewise confirm the `Link` params pattern against an existing sibling route that links to `/listings/$listingId/overview`.

- [ ] **Step 3: Add the "Spaces" nav item**

In `src/components/properties/PropertyDetailSidebar.tsx`, add `faVectorSquare` to the FontAwesome import, and add a nav item to the **Deal** group's `items` array (after `Overview`):

```tsx
      { label: "Spaces", href: "spaces", icon: faVectorSquare },
```

- [ ] **Step 4: Verify build (route tree regenerates)**

Run: `bun --bun run build`
Expected: 0 errors; `routeTree.gen.ts` regenerates to include `/listings/$listingId/spaces` (do not hand-edit it).

- [ ] **Step 5: Manual verification**

Run: `bun --bun run dev`. Open a lease deal → **Spaces** tab → **Add space**: check an existing unit and/or add a new one → confirm children appear as rows with the `faVectorSquare` flair and a stage chip, and that a newly-added space also appears as a unit on the Property record. Ask the user to confirm if you cannot drive the browser.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_shell/listings/$listingId/spaces.tsx src/components/deals/AddSpaceModal.tsx src/components/properties/PropertyDetailSidebar.tsx src/routes/routeTree.gen.ts
git commit -m "feat(lease): Spaces tab + Add Space modal (pick property units / add new)"
```

---

### Task 8: "Add space" button in the deal header

A second, prominent entry point for adding spaces, per the spec (header **and** tab).

**Files:**
- Modify: `src/components/properties/PropertyDetailHeader.tsx`
- Test: manual (browser)

**Interfaces:**
- Consumes: `AddSpaceModal` (Task 7); `useNavigate` (TanStack); the `listing` prop the header already receives.
- Produces: an "Add space" button in the header, shown only for `dealType === 'Lease'` deals, opening `AddSpaceModal`.

- [ ] **Step 1: Read the header**

Open `src/components/properties/PropertyDetailHeader.tsx` and locate the action area (where the stage `<Select>` and any buttons render) and confirm the component receives `listing`.

- [ ] **Step 2: Add local modal state + the button**

Add imports:

```tsx
import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";
```

(Only add imports not already present.)

Inside the component body, add:

```tsx
  const [addSpaceOpen, setAddSpaceOpen] = useState(false);
```

In the header's action area, add (only for lease deals):

```tsx
{listing.dealType === "Lease" && (
  <Button variant="secondary" onClick={() => setAddSpaceOpen(true)}>
    <FontAwesomeIcon icon={faVectorSquare} /> Add space
  </Button>
)}
```

And render the modal once, near the end of the returned JSX:

```tsx
<AddSpaceModal
  parentDealId={listing.id}
  open={addSpaceOpen}
  onOpenChange={setAddSpaceOpen}
/>
```

- [ ] **Step 3: Verify build**

Run: `bun --bun run build`
Expected: 0 TypeScript errors.

- [ ] **Step 4: Manual verification**

Run: `bun --bun run dev`. On a lease deal, confirm the header "Add space" button opens the same modal and adding a space updates the Spaces tab. Confirm the button does **not** appear on a Sale deal. Ask the user to confirm if you cannot drive the browser.

- [ ] **Step 5: Commit**

```bash
git add src/components/properties/PropertyDetailHeader.tsx
git commit -m "feat(lease): Add space button in the deal header (lease deals)"
```

---

### Task 9: Pipeline card flair + parent rollup

Mark child space cards on the board with the `faVectorSquare` flair, and show a space-count/stage rollup on the umbrella parent's card.

**Files:**
- Modify: `src/components/deals/DealCard.tsx`
- Test: manual (browser); rollup logic covered by Task 4's `spacesStageBreakdown` test

**Interfaces:**
- Consumes: `isUmbrella`, `spacesStageBreakdown` (Task 4); `faVectorSquare` (FontAwesome); the `listing`/`deal` prop the card already receives.
- Produces: a small `↳ unit-space` flair on child cards (`listing.parentDealId != null`) and a "N spaces · …" line on umbrella cards (`isUmbrella(listing.id)`).

- [ ] **Step 1: Read the card**

Open `src/components/deals/DealCard.tsx`, confirm the prop name for the listing (assume `deal` or `listing`) and where the card's title/metadata render.

- [ ] **Step 2: Add imports**

```tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { isUmbrella, spacesStageBreakdown } from "#/data/leaseSpaces";
```

(Skip any already imported.)

- [ ] **Step 3: Child flair**

Where the card renders its title, add a small flair before the name when the card is a child (use the actual prop name; `deal` shown here):

```tsx
{deal.parentDealId != null && (
  <span className="badge text-bg-light d-inline-flex align-items-center gap-1 me-1">
    <FontAwesomeIcon icon={faVectorSquare} /> Space
  </span>
)}
```

- [ ] **Step 4: Parent rollup**

In the card's metadata area, add (computed once inside the component body: `const rollup = isUmbrella(deal.id) ? spacesStageBreakdown(deal.id) : null;`):

```tsx
{rollup && (
  <div className="small text-muted mt-1">
    {rollup.total} {rollup.total === 1 ? "space" : "spaces"}
    {rollup.byStage.active > 0 && ` · ${rollup.byStage.active} Active`}
    {rollup.byStage["under-contract"] > 0 && ` · ${rollup.byStage["under-contract"]} UC`}
    {rollup.byStage.closed > 0 && ` · ${rollup.byStage.closed} Closed`}
  </div>
)}
```

- [ ] **Step 5: Verify build**

Run: `bun --bun run build`
Expected: 0 TypeScript errors.

- [ ] **Step 6: Manual verification**

Run: `bun --bun run dev`, open the Deals board/pipeline. Confirm child space deals render as their own cards with the "Space" flair, and the umbrella parent card shows the space-count/stage rollup line. Ask the user to confirm if you cannot drive the browser.

- [ ] **Step 7: Commit**

```bash
git add src/components/deals/DealCard.tsx
git commit -m "feat(lease): space-card flair + umbrella rollup on the pipeline"
```

---

### Task 10: Child parent-link + Re-sync from parent

On a child space deal, show a breadcrumb back to the umbrella and a "Re-sync from parent" action that re-pulls the template.

**Files:**
- Modify: `src/components/properties/PropertyDetailHeader.tsx`
- Test: manual (browser); `resyncChildFromParent` covered by Task 4

**Interfaces:**
- Consumes: `resyncChildFromParent` (Task 4); `getListing` (store); `notify` (`src/lib/notify.ts`, used elsewhere for toasts — confirm the export name); `Link` (TanStack); `faArrowsRotate` (FontAwesome pro-regular); the `listing` prop.
- Produces: on a child (`listing.parentDealId != null`), a "Part of: {parent name}" link and a "Re-sync from parent" button.

- [ ] **Step 1: Add imports**

In `src/components/properties/PropertyDetailHeader.tsx`:

```tsx
import { Link } from "@tanstack/react-router";
import { faArrowsRotate } from "@fortawesome/pro-regular-svg-icons";
import { getListing } from "#/data/store";
import { resyncChildFromParent } from "#/data/leaseSpaces";
import { notify } from "#/lib/notify";
```

(Skip any already present. Open `src/lib/notify.ts` and confirm the exported function name is `notify` and its argument shape `{ title, description }`; match it.)

- [ ] **Step 2: Derive the parent**

In the component body:

```tsx
  const parentDeal = listing.parentDealId ? getListing(listing.parentDealId) : undefined;
```

- [ ] **Step 3: Render the breadcrumb + re-sync**

Above the deal title in the header (so it reads as context), add:

```tsx
{parentDeal && (
  <div className="d-flex align-items-center gap-3 mb-1 small">
    <Link
      to="/listings/$listingId/spaces"
      params={{ listingId: parentDeal.id }}
      className="text-muted text-decoration-none"
    >
      Part of: {parentDeal.name}
    </Link>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        resyncChildFromParent(listing.id);
        notify({ title: "Re-synced from parent", description: listing.name });
      }}
    >
      <FontAwesomeIcon icon={faArrowsRotate} /> Re-sync from parent
    </Button>
  </div>
)}
```

> Confirm `Button`'s `size="sm"` is a valid Blueprint prop; if not, drop the `size` prop. Match the existing `Button` usage in the file.

- [ ] **Step 4: Verify build**

Run: `bun --bun run build`
Expected: 0 TypeScript errors.

- [ ] **Step 5: Manual verification**

Run: `bun --bun run dev`. On a child space deal, confirm the "Part of: {parent}" link navigates to the parent's Spaces tab, and "Re-sync from parent" pulls the parent's current template (change the parent's lease title in the editor, then re-sync the child and confirm it updates) with a toast. Ask the user to confirm if you cannot drive the browser.

- [ ] **Step 6: Final full-suite check**

Run: `bun --bun run test && bun --bun run build`
Expected: all tests PASS; build 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/properties/PropertyDetailHeader.tsx
git commit -m "feat(lease): child parent-link breadcrumb + re-sync from parent"
```

---

## Self-Review

**Spec coverage:**
- Umbrella + child via one `Listing` + `parentDealId` → Task 1 (field) + Task 4 (behavior). ✓
- `isUmbrella` derived, never gate logic → Task 4 (`isUmbrella` = `getChildDeals().length > 0`); gates never read it. ✓
- Parent stays marketable, keeps full ladder, no suppression → no umbrella branch in `resolveGate` (Task 2); parent uses the same lease config. ✓
- Flat → umbrella by promotion (Add space) → Task 4 `addSpaceToDeal` + Tasks 7/8 UI. ✓
- Property as source of truth; new spaces write a `PropertyUnit` back → Task 4 `addPropertyUnit`, Task 7 modal. ✓
- Sale/Lease pill tabs in create modal → Task 5. ✓
- Lease gates: rent/units/SF at Active, tenant + term at Under Contract, commencement at Closed → Task 2 (config) + Task 3 (commit) + Task 6 (UI). ✓
- Tenant = own dataset (`tenantContactIds`) → Task 1 (field) + Task 3 (commit) + Task 4 (`linkContactToDeal 'tenant'`). ✓
- Template = snapshot + explicit re-sync → Task 4 (`addSpaceToDeal` snapshot, `resyncChildFromParent`) + Task 10 (UI). ✓
- Spaces tab + Add space in header AND tab → Tasks 7 (tab) + 8 (header). ✓
- Child cards independent + `faVectorSquare` flair; parent card rollup → Task 9. ✓
- Child parent breadcrumb → Task 10. ✓
- Non-goals (buy-side, live inheritance, auto-stage rollup, contact-slot cleanup) → untouched; rollup is display-only (Task 9). ✓

**Placeholder scan:** No "TBD/TODO/implement later" in steps. The Task 5 note about multi-step modal placement and the several "confirm the prop name" notes are *verification instructions against real code*, not deferred work — each step still contains complete code. Task 4 Step 5 intentionally writes a rough helper then Step 6 replaces it with the clean version; the clean code is fully specified. ("Rate TBD" in Task 7 is user-facing copy, not a plan placeholder.)

**Type consistency:** `parentDealId`, `tenantContactIds`, `leaseCommencementDate` named identically across Tasks 1/3/4. `buildTransitionInput` 5th arg `dealType` added in Task 3 and its only other caller (StageGate) updated in the same task (Step 7). `GateFormState` lease fields added in Task 3 before `fieldSatisfied` (Task 2) relies on them — full typecheck deferred to end of Task 3 Step 8, noted in Task 2 Step 5. `addSpaceToDeal`/`getChildDeals`/`isUmbrella`/`spacesStageBreakdown`/`addPropertyUnit`/`resyncChildFromParent` signatures match between Task 4's definitions and their Task 7/8/9/10 consumers. `DealStageChip` prop and `notify` signature flagged for confirmation-against-source before use.
