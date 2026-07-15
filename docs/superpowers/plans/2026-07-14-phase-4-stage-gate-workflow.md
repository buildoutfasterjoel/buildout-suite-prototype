# Phase 4 — Stage-Gate Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn every deal stage transition — in both directions, from the Deals board or the deal detail header — into a gate that captures the fields/attestations the target stage requires (or confirms the consequences of a backward move) before it commits.

**Architecture:** One pure `resolveGate(from, target)` function is the single source of truth for what a transition requires and does. A single controlled `StageGate` modal, driven by a `useStageGate` zustand store and mounted once in `AppShell` (mirroring `GlobalCreateDealModal`), renders the resolved gate and commits via one `commitStageTransition` action. Both entry points (board drag, header `<Select>`) just call `useStageGate.getState().open(dealId, targetStage)`; nothing moves until the gate commits.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Zustand (`useDataStore`, store-per-concern pattern) · Vitest · Blueprint React (`Modal`, `Field`, `Select`, `Checkbox`, `RadioGroup`, `Toast`) · FontAwesome Pro (`pro-regular`).

## Global Constraints

- **Five stages only, labels unchanged.** `PropertyStatus = 'proposal' | 'active' | 'under-contract' | 'closed' | 'inactive'`. Labels stay Pitching / Active / Under Contract / Closed / Lost (`STATUS_LABELS`). Do not add, remove, or relabel stages.
- **`DealSide` stays `'buyer' | 'seller'`** — no "Dual".
- **Blueprint components + `pro-regular` icons only.** Import from `@buildoutinc/blueprint-react/ui/<Name>`. No `fixedWidth` on `FontAwesomeIcon`. No margin utilities on `Badge` icons.
- **Package manager is Bun.** Run everything with `bun --bun run …` (tests: `bun --bun run test`).
- **No Playwright.** UI-only tasks are verified by typecheck (`bunx tsc --noEmit`) plus manual in-app checks the user performs.
- **Persist through the single write path.** Mutations go through `patchListing` / `useDataStore.getState().persist()`, never direct `setState` without persist.
- **The AI `updateDealStage` tool stays a direct data action** and bypasses the gate — do not route it through `StageGate`.

---

## File Structure

**Create:**
- `src/data/stageGates.ts` — pure gate logic: `resolveGate`, `canConfirm`, `buildTransitionInput`, types.
- `src/data/stageGates.test.ts` — unit tests for the pure logic.
- `src/components/deals/useStageGate.ts` — zustand store holding the pending `{ dealId, targetStage }` + open state.
- `src/components/deals/StageGate.tsx` — the controlled gate modal (renders field/confirm/dead bodies, commits).
- `src/components/deals/GlobalStageGateModal.tsx` — app-wide single mount, driven by `useStageGate`.

**Modify:**
- `src/data/types.ts` — add `aiGenerated?: boolean` to `DealDocument`; add `publishedAt: string | null` to `Listing`.
- `src/data/persistence.ts` — bump `SEED_VERSION` 6 → 7.
- `src/data/createListing.ts` — new proposals set `publishedAt: null`; `seedProposalDocuments` marks docs `aiGenerated: true`.
- `src/data/seed.ts` — seeded listings set `publishedAt` from stage.
- `src/data/actions.ts` — add `commitStageTransition`.
- `src/data/actions.test.ts` — tests for `commitStageTransition`.
- `src/components/layout/AppShell.tsx` — wrap content in `ToasterProvider`; mount `<GlobalStageGateModal />`.
- `src/components/deals/DealBoard.tsx` + `src/routes/listings/index.tsx` — `onRestage` opens the gate instead of committing.
- `src/components/properties/PropertyDetailHeader.tsx` — stage `<Select>` opens the gate; value stays bound to `listing.status`.
- `src/components/listings/SyndicationStatus.tsx` — publish-aware headline driven by `listing.publishedAt`.

---

## Task 1: Data-model fields (`aiGenerated`, `publishedAt`) + seed

**Files:**
- Modify: `src/data/types.ts` (`DealDocument`, `Listing`)
- Modify: `src/data/createListing.ts` (`seedProposalDocuments`, the `createProposalListing` literal)
- Modify: `src/data/seed.ts` (the `Listing` literal in the listings map)
- Modify: `src/data/persistence.ts` (`SEED_VERSION`)
- Test: `src/data/actions.test.ts` (append a test)

**Interfaces:**
- Produces: `DealDocument.aiGenerated?: boolean`; `Listing.publishedAt: string | null` (ISO string when the listing is published, else `null`). Consumed by Tasks 2–7.

- [ ] **Step 1: Write the failing test**

Append to `src/data/actions.test.ts` inside the top-level `describe('actions', …)` block:

```ts
  it('createDeal starts unpublished with AI-generated starter documents', () => {
    const draft = { ...emptyDraft(), name: 'Gate Test', address: '9 Gate St' }
    const { deal } = createDeal(draft)
    // A brand-new proposal is not published.
    expect(deal.publishedAt).toBeNull()
    // The auto-generated starter docs are flagged so the publish gate can require review.
    expect(deal.documents?.length ?? 0).toBeGreaterThan(0)
    expect(deal.documents?.every((d) => d.aiGenerated === true)).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/actions.test.ts`
Expected: FAIL — `deal.publishedAt` is `undefined` (property missing) and `aiGenerated` is `undefined`.

- [ ] **Step 3: Add the type fields**

In `src/data/types.ts`, add to `DealDocument` (after `size?`):

```ts
  /** File a human-readable size for display (e.g. "2.3 MB"). */
  size?: string
  /** True when Buildout auto-generated this document — the publish gate requires review of these. */
  aiGenerated?: boolean
```

In `src/data/types.ts`, add to `Listing` (immediately after `status: PropertyStatus // unified listing + deal stage`):

```ts
  status: PropertyStatus // unified listing + deal stage
  /** ISO timestamp when the listing was published (went live), or null when not published. Diverges from `status` so a backward move can keep the listing live. */
  publishedAt: string | null
```

- [ ] **Step 4: Flag the seeded starter documents and set `publishedAt` on new proposals**

In `src/data/createListing.ts`, update `seedProposalDocuments` so both docs carry `aiGenerated: true`:

```ts
function seedProposalDocuments(now: string): DealDocument[] {
  return [
    {
      id: crypto.randomUUID(),
      name: 'Offering-Memorandum.pdf',
      uploadedAt: now,
      size: '2.3 MB',
      aiGenerated: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Rent-Roll-2026.xlsx',
      uploadedAt: now,
      size: '86 KB',
      aiGenerated: true,
    },
  ]
}
```

In the `createProposalListing` returned `Listing` literal, add `publishedAt: null` next to `status: 'proposal'`:

```ts
    status: 'proposal',
    publishedAt: null,
```

- [ ] **Step 5: Set `publishedAt` on seeded listings**

In `src/data/seed.ts`, inside the `Array.from({ length: count }, (_, i): Listing => { … })` builder, after the `const status: ListingStage = …` assignment (around line 1063), add:

```ts
    // Published once the deal has gone live (Active or beyond); Pitching/Lost are not published.
    const publishedAt =
      status === 'active' || status === 'under-contract' || status === 'closed'
        ? stageStartedAt
        : null
```

Then in the returned object literal, add `publishedAt,` next to the `status` field. (`stageStartedAt` is already computed in this builder — confirm it is declared above this point; it is defined around line 1116. If `publishedAt` must reference it, move the `publishedAt` computation to just after `stageStartedAt` is declared.)

- [ ] **Step 6: Bump the seed version**

In `src/data/persistence.ts`, change:

```ts
export const SEED_VERSION = 7
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `bun --bun run test -- src/data/actions.test.ts`
Expected: PASS. Then run the full suite to catch type/consumer breaks: `bun --bun run test`
Expected: PASS (all existing tests still green).

- [ ] **Step 8: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors. (Adding required `publishedAt` to `Listing` should only affect the two literals updated above; if tsc reports another `Listing` literal missing `publishedAt`, add `publishedAt: null` there.)

- [ ] **Step 9: Commit**

```bash
git add src/data/types.ts src/data/createListing.ts src/data/seed.ts src/data/persistence.ts src/data/actions.test.ts
git commit -m "feat(data): add publishedAt + aiGenerated for stage-gate workflow"
```

---

## Task 2: Pure gate logic (`resolveGate`, `canConfirm`, `buildTransitionInput`)

**Files:**
- Create: `src/data/stageGates.ts`
- Test: `src/data/stageGates.test.ts`

**Interfaces:**
- Consumes: `PropertyStatus`, `DealSide` from `#/data/types`.
- Produces:
  - `type GateKind = 'field' | 'confirm' | 'dead'`
  - `type RequiredField = 'sellerLinked' | 'buyerLinked' | 'dealSide' | 'listedOnDate' | 'listingExpirationDate' | 'closeDate' | 'salePrice' | 'commissionAmount' | 'deadReason' | 'aiDocsReviewed' | 'sellerConfirmed'`
  - `interface GateFormState` (see code)
  - `interface GateConfig { kind; fromStage; targetStage; title; required: RequiredField[]; leavesActive: boolean; publishes: boolean }`
  - `interface StageTransitionInput` (see code) — matches Task 3's action input
  - `resolveGate(from: PropertyStatus, target: PropertyStatus): GateConfig`
  - `canConfirm(config: GateConfig, form: GateFormState): boolean`
  - `buildTransitionInput(config: GateConfig, form: GateFormState, dealId: string, actor: string): StageTransitionInput`

- [ ] **Step 1: Write the failing test**

Create `src/data/stageGates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  type GateFormState,
} from './stageGates'

const emptyForm: GateFormState = {
  sellerLinked: false,
  buyerLinked: false,
  dealSide: null,
  listedOnDate: null,
  listingExpirationDate: null,
  contractExecutedDate: null,
  closeDate: null,
  salePrice: null,
  commissionAmount: null,
  deadReason: null,
  aiDocsAllReviewed: true,
  sellerConfirmed: false,
  unpublishOnExit: true,
  sellerContactId: null,
  buyerContactId: null,
}

describe('resolveGate', () => {
  it('Pitching → Active is a publishing field gate', () => {
    const g = resolveGate('proposal', 'active')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(true)
    expect(g.required).toEqual(
      expect.arrayContaining([
        'sellerConfirmed',
        'aiDocsReviewed',
        'sellerLinked',
        'dealSide',
        'listedOnDate',
        'listingExpirationDate',
      ]),
    )
  })

  it('Active → Under Contract requires buyer + economics', () => {
    const g = resolveGate('active', 'under-contract')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(false)
    expect(g.required).toEqual(
      expect.arrayContaining(['buyerLinked', 'salePrice', 'commissionAmount']),
    )
  })

  it('Under Contract → Closed requires only the close date', () => {
    const g = resolveGate('under-contract', 'closed')
    expect(g.kind).toBe('field')
    expect(g.required).toEqual(['closeDate'])
  })

  it('any stage → Lost is a dead gate requiring reason + close date', () => {
    const g = resolveGate('active', 'inactive')
    expect(g.kind).toBe('dead')
    expect(g.required).toEqual(expect.arrayContaining(['deadReason', 'closeDate']))
  })

  it('a backward move is a confirm gate with no required fields', () => {
    const g = resolveGate('under-contract', 'active')
    expect(g.kind).toBe('confirm')
    expect(g.required).toEqual([])
    expect(g.leavesActive).toBe(false)
  })

  it('a backward move OUT of Active flags leavesActive', () => {
    const g = resolveGate('active', 'proposal')
    expect(g.kind).toBe('confirm')
    expect(g.leavesActive).toBe(true)
  })

  it('reopening from Lost into Active runs the publishing field gate', () => {
    const g = resolveGate('inactive', 'active')
    expect(g.kind).toBe('field')
    expect(g.publishes).toBe(true)
  })
})

describe('canConfirm', () => {
  it('confirm gates are always confirmable', () => {
    expect(canConfirm(resolveGate('under-contract', 'active'), emptyForm)).toBe(true)
  })

  it('a field gate blocks until all required fields are satisfied', () => {
    const g = resolveGate('proposal', 'active')
    expect(canConfirm(g, emptyForm)).toBe(false)
    const filled: GateFormState = {
      ...emptyForm,
      sellerConfirmed: true,
      aiDocsAllReviewed: true,
      sellerLinked: true,
      dealSide: 'seller',
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    expect(canConfirm(g, filled)).toBe(true)
  })

  it('the AI-doc checklist blocks the publish gate when not all reviewed', () => {
    const g = resolveGate('proposal', 'active')
    const filled: GateFormState = {
      ...emptyForm,
      sellerConfirmed: true,
      sellerLinked: true,
      dealSide: 'seller',
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
      aiDocsAllReviewed: false,
    }
    expect(canConfirm(g, filled)).toBe(false)
  })
})

describe('buildTransitionInput', () => {
  it('maps a publish gate form to the action input', () => {
    const g = resolveGate('proposal', 'active')
    const form: GateFormState = {
      ...emptyForm,
      sellerConfirmed: true,
      sellerLinked: true,
      sellerContactId: 'contact-1',
      dealSide: 'seller',
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    const input = buildTransitionInput(g, form, 'deal-1', 'Jane Broker')
    expect(input.targetStage).toBe('active')
    expect(input.publish).toBe(true)
    expect(input.dealSide).toBe('seller')
    expect(input.sellerContactId).toBe('contact-1')
    expect(input.transaction).toMatchObject({
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    })
  })

  it('maps a backward-out-of-Active gate with unpublish selected', () => {
    const g = resolveGate('active', 'proposal')
    const input = buildTransitionInput(g, { ...emptyForm, unpublishOnExit: true }, 'deal-1', 'Jane Broker')
    expect(input.unpublish).toBe(true)
    expect(input.publish).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/stageGates.test.ts`
Expected: FAIL — `Cannot find module './stageGates'`.

- [ ] **Step 3: Write the implementation**

Create `src/data/stageGates.ts`:

```ts
import type { DealSide, DealTransaction, PropertyStatus } from './types'

export type GateKind = 'field' | 'confirm' | 'dead'

export type RequiredField =
  | 'sellerLinked'
  | 'buyerLinked'
  | 'dealSide'
  | 'listedOnDate'
  | 'listingExpirationDate'
  | 'closeDate'
  | 'salePrice'
  | 'commissionAmount'
  | 'deadReason'
  | 'aiDocsReviewed'
  | 'sellerConfirmed'

/** The editable state the StageGate modal collects. Fields not relevant to a gate are ignored. */
export interface GateFormState {
  sellerLinked: boolean
  buyerLinked: boolean
  dealSide: DealSide | null
  listedOnDate: string | null
  listingExpirationDate: string | null
  contractExecutedDate: string | null
  closeDate: string | null
  salePrice: number | null
  commissionAmount: number | null
  deadReason: string | null
  /** True when every AI-generated doc is checked (or there are none). */
  aiDocsAllReviewed: boolean
  sellerConfirmed: boolean
  /** Backward-out-of-Active only: also pull the listing off-market. Default true. */
  unpublishOnExit: boolean
  /** Contact chosen to link as seller/buyer in this gate, if any. */
  sellerContactId: string | null
  buyerContactId: string | null
}

export interface GateConfig {
  kind: GateKind
  fromStage: PropertyStatus
  targetStage: PropertyStatus
  title: string
  required: RequiredField[]
  /** Whether the transition leaves the Active stage (drives the unpublish option). */
  leavesActive: boolean
  /** True for a forward move into Active (drives the publish side-effect + toast). */
  publishes: boolean
}

/** Input consumed by the `commitStageTransition` action (Task 3). */
export interface StageTransitionInput {
  dealId: string
  targetStage: PropertyStatus
  actor: string
  transaction?: Partial<DealTransaction>
  dealSide?: DealSide
  sellerContactId?: string
  buyerContactId?: string
  /** Set publishedAt to now (Pitching → Active). */
  publish?: boolean
  /** Clear publishedAt (backward out of Active with unpublish selected). */
  unpublish?: boolean
}

/** Forward ladder; `inactive` (Lost) is intentionally off-ladder. */
const LADDER: PropertyStatus[] = ['proposal', 'active', 'under-contract', 'closed']

const STAGE_LABEL: Record<PropertyStatus, string> = {
  proposal: 'Pitching',
  active: 'Active',
  'under-contract': 'Under Contract',
  closed: 'Closed',
  inactive: 'Lost',
}

export function resolveGate(from: PropertyStatus, target: PropertyStatus): GateConfig {
  const base = { fromStage: from, targetStage: target, leavesActive: from === 'active' }

  // Terminal: any stage → Lost.
  if (target === 'inactive') {
    return { ...base, kind: 'dead', title: 'Mark deal as Lost', required: ['deadReason', 'closeDate'], publishes: false }
  }

  const fi = LADDER.indexOf(from) // -1 when reopening from Lost
  const ti = LADDER.indexOf(target)
  const forward = fi === -1 || ti > fi

  if (!forward) {
    // Backward move — confirmation only.
    return { ...base, kind: 'confirm', title: `Move back to ${STAGE_LABEL[target]}`, required: [], publishes: false }
  }

  // Forward field gates, keyed by target stage.
  switch (target) {
    case 'active':
      return {
        ...base,
        kind: 'field',
        title: 'Approve & Publish',
        required: ['sellerConfirmed', 'aiDocsReviewed', 'sellerLinked', 'dealSide', 'listedOnDate', 'listingExpirationDate'],
        publishes: true,
      }
    case 'under-contract':
      return { ...base, kind: 'field', title: 'Move to Under Contract', required: ['buyerLinked', 'salePrice', 'commissionAmount'], publishes: false }
    case 'closed':
      return { ...base, kind: 'field', title: 'Move to Closed', required: ['closeDate'], publishes: false }
    case 'proposal':
    default:
      // Reopen from Lost into Pitching — no field requirements (behaves as a plain confirm).
      return { ...base, kind: 'field', title: `Reopen to ${STAGE_LABEL[target]}`, required: [], publishes: false }
  }
}

function fieldSatisfied(field: RequiredField, form: GateFormState): boolean {
  switch (field) {
    case 'sellerLinked':
      return form.sellerLinked
    case 'buyerLinked':
      return form.buyerLinked
    case 'dealSide':
      return form.dealSide != null
    case 'listedOnDate':
      return !!form.listedOnDate
    case 'listingExpirationDate':
      return !!form.listingExpirationDate
    case 'closeDate':
      return !!form.closeDate
    case 'salePrice':
      return form.salePrice != null && form.salePrice > 0
    case 'commissionAmount':
      return form.commissionAmount != null && form.commissionAmount > 0
    case 'deadReason':
      return !!form.deadReason && form.deadReason.trim().length > 0
    case 'aiDocsReviewed':
      return form.aiDocsAllReviewed
    case 'sellerConfirmed':
      return form.sellerConfirmed
  }
}

export function canConfirm(config: GateConfig, form: GateFormState): boolean {
  if (config.kind === 'confirm') return true
  return config.required.every((f) => fieldSatisfied(f, form))
}

export function buildTransitionInput(
  config: GateConfig,
  form: GateFormState,
  dealId: string,
  actor: string,
): StageTransitionInput {
  const transaction: Partial<DealTransaction> = {}
  if (form.listedOnDate) transaction.listedOnDate = form.listedOnDate
  if (form.listingExpirationDate) transaction.listingExpirationDate = form.listingExpirationDate
  if (form.contractExecutedDate) transaction.contractExecutedDate = form.contractExecutedDate
  if (form.closeDate) transaction.closeDate = form.closeDate
  if (form.salePrice != null) transaction.salePrice = form.salePrice
  if (form.commissionAmount != null) transaction.commissionAmount = form.commissionAmount
  if (form.deadReason) transaction.deadReason = form.deadReason

  const input: StageTransitionInput = {
    dealId,
    targetStage: config.targetStage,
    actor,
  }
  if (Object.keys(transaction).length > 0) input.transaction = transaction
  if (form.dealSide) input.dealSide = form.dealSide
  if (form.sellerContactId) input.sellerContactId = form.sellerContactId
  if (form.buyerContactId) input.buyerContactId = form.buyerContactId
  if (config.publishes) input.publish = true
  if (config.leavesActive && form.unpublishOnExit) input.unpublish = true
  return input
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test -- src/data/stageGates.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/data/stageGates.ts src/data/stageGates.test.ts
git commit -m "feat(data): resolveGate + canConfirm + buildTransitionInput for stage gates"
```

---

## Task 3: `commitStageTransition` action

**Files:**
- Modify: `src/data/actions.ts`
- Test: `src/data/actions.test.ts`

**Interfaces:**
- Consumes: `StageTransitionInput` from `#/data/stageGates`; `patchListing` (private, in `actions.ts`); `DealHistoryEntry`, `Listing` from `#/data/types`.
- Produces: `commitStageTransition(input: StageTransitionInput): { deal: Listing | null }` — applies the field patch, links contacts, flips `status`, sets/clears `publishedAt`, appends a `DealHistoryEntry`, and persists.

- [ ] **Step 1: Write the failing test**

Append to `src/data/actions.test.ts` (add `commitStageTransition` to the imports from `./actions`, and `resolveGate` + `buildTransitionInput` imports from `./stageGates` if you exercise them — the test below builds the input inline, so only `commitStageTransition` is needed):

```ts
  it('commitStageTransition publishes on Pitching → Active and logs history', () => {
    const draft = { ...emptyDraft(), name: 'Commit Test', address: '11 Commit Ave' }
    const { deal } = createDeal(draft)
    const seller = [...useDataStore.getState().contacts.values()][0]
    const before = deal.history.length

    const { deal: updated } = commitStageTransition({
      dealId: deal.id,
      targetStage: 'active',
      actor: 'Jane Broker',
      dealSide: 'seller',
      sellerContactId: seller.id,
      transaction: { listedOnDate: '2026-07-01', listingExpirationDate: '2026-12-31' },
      publish: true,
    })

    expect(updated?.status).toBe('active')
    expect(updated?.publishedAt).not.toBeNull()
    expect(updated?.dealSide).toBe('seller')
    expect(updated?.sellerContactIds).toContain(seller.id)
    expect(updated?.transaction.listedOnDate).toBe('2026-07-01')
    expect(updated?.history.length).toBe(before + 1)
    expect(updated?.history.at(-1)).toMatchObject({ fromStage: 'proposal', toStage: 'active' })
  })

  it('commitStageTransition clears publishedAt when unpublishing on a backward move', () => {
    const draft = { ...emptyDraft(), name: 'Unpublish Test', address: '12 Back St' }
    const { deal } = createDeal(draft)
    // Get it live first.
    commitStageTransition({ dealId: deal.id, targetStage: 'active', actor: 'Jane', publish: true })
    // Move back to Pitching and unpublish.
    const { deal: back } = commitStageTransition({
      dealId: deal.id,
      targetStage: 'proposal',
      actor: 'Jane',
      unpublish: true,
    })
    expect(back?.status).toBe('proposal')
    expect(back?.publishedAt).toBeNull()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test -- src/data/actions.test.ts`
Expected: FAIL — `commitStageTransition` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/data/actions.ts`, add the import at the top (near the other type imports):

```ts
import type { StageTransitionInput } from './stageGates'
import type { DealHistoryEntry } from './types'
```

(If `Listing`/`PropertyStatus` are already imported from `./types`, extend that import to also include `DealHistoryEntry` rather than adding a second line.)

Then add the action (place it directly after `updateDealStage`):

```ts
/**
 * Commit a gated stage transition: apply the captured field patch, link any
 * seller/buyer chosen in the gate, flip the status, set/clear the published
 * marker, and append a history entry. This is the single write path the
 * StageGate modal commits through.
 */
export function commitStageTransition(input: StageTransitionInput): { deal: Listing | null } {
  const now = new Date().toISOString()
  return {
    deal: patchListing(input.dealId, (l) => {
      const historyEntry: DealHistoryEntry = {
        id: crypto.randomUUID(),
        label: 'Moved to',
        fromStage: l.status,
        toStage: input.targetStage,
        actor: input.actor,
        timestamp: now,
      }

      const sellerContactIds =
        input.sellerContactId && !l.sellerContactIds.includes(input.sellerContactId)
          ? [...l.sellerContactIds, input.sellerContactId]
          : l.sellerContactIds
      const buyerContactIds =
        input.buyerContactId && !l.buyerContactIds.includes(input.buyerContactId)
          ? [...l.buyerContactIds, input.buyerContactId]
          : l.buyerContactIds

      const publishedAt = input.publish ? now : input.unpublish ? null : l.publishedAt

      return {
        ...l,
        status: input.targetStage,
        dealSide: input.dealSide ?? l.dealSide,
        sellerContactIds,
        buyerContactIds,
        publishedAt,
        transaction: { ...l.transaction, ...input.transaction },
        history: [...l.history, historyEntry],
        updatedAt: now,
      }
    }),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test -- src/data/actions.test.ts`
Expected: PASS. Then `bun --bun run test` — full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/data/actions.ts src/data/actions.test.ts
git commit -m "feat(data): commitStageTransition action for gated stage moves"
```

---

## Task 4: `StageGate` modal + `useStageGate` store + global mount

**Files:**
- Create: `src/components/deals/useStageGate.ts`
- Create: `src/components/deals/StageGate.tsx`
- Create: `src/components/deals/GlobalStageGateModal.tsx`
- Modify: `src/components/layout/AppShell.tsx`

**Interfaces:**
- Consumes: `resolveGate`, `canConfirm`, `buildTransitionInput`, `GateFormState` from `#/data/stageGates`; `commitStageTransition` from `#/data/actions`; `getListing`, `getContact` from `#/data/store`; `getSellerOptions` from `#/data/store`; `useToast`, `ToasterProvider` from `@buildoutinc/blueprint-react/ui/Toast`.
- Produces:
  - `useStageGate` store: `{ open: boolean; dealId: string | null; targetStage: PropertyStatus | null; openGate(dealId: string, targetStage: PropertyStatus): void; close(): void }`
  - `<StageGate dealId targetStage open onOpenChange onCommitted? />`
  - `<GlobalStageGateModal />` (no props)

**Verification:** UI task — no unit test (per the no-Playwright constraint). Verified by typecheck + manual in-app checks.

- [ ] **Step 1: Create the store**

Create `src/components/deals/useStageGate.ts`:

```ts
import { create } from 'zustand'
import type { PropertyStatus } from '#/data/types'

/**
 * App-wide open/close state for the stage-gate modal. Both entry points (the
 * Deals board and the deal detail header) call `openGate`; the single
 * GlobalStageGateModal renders it. Mirrors `useOmniSearch` / `useCreateDeal`.
 */
interface StageGateState {
  open: boolean
  dealId: string | null
  targetStage: PropertyStatus | null
  openGate: (dealId: string, targetStage: PropertyStatus) => void
  close: () => void
}

export const useStageGate = create<StageGateState>((set) => ({
  open: false,
  dealId: null,
  targetStage: null,
  openGate: (dealId, targetStage) => set({ open: true, dealId, targetStage }),
  close: () => set({ open: false, dealId: null, targetStage: null }),
}))
```

- [ ] **Step 2: Create the StageGate component**

Create `src/components/deals/StageGate.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { Modal } from '@buildoutinc/blueprint-react/ui/Modal'
import { Button } from '@buildoutinc/blueprint-react/ui/Button'
import { Field } from '@buildoutinc/blueprint-react/ui/Field'
import { Input } from '@buildoutinc/blueprint-react/ui/Input'
import { Checkbox } from '@buildoutinc/blueprint-react/ui/Checkbox'
import { RadioGroup } from '@buildoutinc/blueprint-react/ui/RadioGroup'
import { Select } from '@buildoutinc/blueprint-react/ui/Select'
import { Alert } from '@buildoutinc/blueprint-react/ui/Alert'
import { useToast } from '@buildoutinc/blueprint-react/ui/Toast'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpRightFromSquare, faRobot } from '@fortawesome/pro-regular-svg-icons'
import type { PropertyStatus } from '#/data/types'
import { getListing, getSellerOptions } from '#/data/store'
import {
  resolveGate,
  canConfirm,
  buildTransitionInput,
  type GateFormState,
} from '#/data/stageGates'
import { commitStageTransition } from '#/data/actions'

const EMPTY_FORM: GateFormState = {
  sellerLinked: false,
  buyerLinked: false,
  dealSide: null,
  listedOnDate: null,
  listingExpirationDate: null,
  contractExecutedDate: null,
  closeDate: null,
  salePrice: null,
  commissionAmount: null,
  deadReason: null,
  aiDocsAllReviewed: true,
  sellerConfirmed: false,
  unpublishOnExit: true,
  sellerContactId: null,
  buyerContactId: null,
}

export function StageGate({
  dealId,
  targetStage,
  open,
  onOpenChange,
  onCommitted,
}: {
  dealId: string
  targetStage: PropertyStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  onCommitted?: () => void
}) {
  const { toast } = useToast()
  const deal = getListing(dealId)
  const config = useMemo(
    () => (deal ? resolveGate(deal.status, targetStage) : null),
    [deal, targetStage],
  )

  // Seed the working form from the deal each time the gate opens.
  const initialForm = useMemo<GateFormState>(() => {
    if (!deal) return EMPTY_FORM
    return {
      ...EMPTY_FORM,
      dealSide: deal.dealSide,
      sellerLinked: deal.sellerContactIds.length > 0,
      buyerLinked: deal.buyerContactIds.length > 0,
      listedOnDate: deal.transaction.listedOnDate,
      listingExpirationDate: deal.transaction.listingExpirationDate,
      contractExecutedDate: deal.transaction.contractExecutedDate,
      closeDate: deal.transaction.closeDate,
      salePrice: deal.transaction.salePrice || null,
      commissionAmount: deal.transaction.commissionAmount || null,
      deadReason: deal.transaction.deadReason,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, open])

  const [form, setForm] = useState<GateFormState>(initialForm)
  const [reviewedDocIds, setReviewedDocIds] = useState<Set<string>>(new Set())
  // Re-seed when the modal (re)opens for a different deal/target — the accepted
  // React "reset state during render when a key changes" pattern. All hooks are
  // declared above this point, so this stays before the early return.
  const [seededKey, setSeededKey] = useState('')
  const key = `${dealId}:${targetStage}:${open}`
  if (open && key !== seededKey) {
    setForm(initialForm)
    setReviewedDocIds(new Set())
    setSeededKey(key)
  }

  if (!deal || !config) return null

  const set = <K extends keyof GateFormState>(k: K, v: GateFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const req = (f: string) => config.required.includes(f as never)

  const aiDocs = (deal.documents ?? []).filter((d) => d.aiGenerated)
  const allDocsReviewed = aiDocs.length === 0 || aiDocs.every((d) => reviewedDocIds.has(d.id))

  // Derive the effective form (checklist state folded in) at check/commit time
  // instead of syncing state during render.
  const effectiveForm: GateFormState = { ...form, aiDocsAllReviewed: allDocsReviewed }

  const sellerOptions = getSellerOptions(deal.propertyId)
  const confirmable = canConfirm(config, effectiveForm)

  const commit = () => {
    const input = buildTransitionInput(config, effectiveForm, deal.id, deal.internalBrokers[0]?.name ?? 'You')
    commitStageTransition(input)
    if (config.publishes) {
      toast.success({ title: 'Listing published', description: `${deal.name} is now live in market.` })
    }
    onOpenChange(false)
    onCommitted?.()
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content size="lg" scrollable centered>
        <Modal.Header>
          <Modal.Title>{config.title}</Modal.Title>
          <Modal.Description>{deal.name}</Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-3">
          {config.kind === 'confirm' && (
            <>
              <p className="mb-0">
                Move this deal back to <strong>{config.targetStage}</strong>?
              </p>
              {config.leavesActive && (
                <Field orientation="horizontal">
                  <Checkbox
                    checked={form.unpublishOnExit}
                    onCheckedChange={(c) => set('unpublishOnExit', c === true)}
                  />
                  <Field.Label>Also unpublish this listing (pull it off-market)</Field.Label>
                </Field>
              )}
            </>
          )}

          {(config.kind === 'field' || config.kind === 'dead') && (
            <>
              {config.publishes && (
                <Field orientation="horizontal">
                  <Checkbox
                    checked={form.sellerConfirmed}
                    onCheckedChange={(c) => set('sellerConfirmed', c === true)}
                  />
                  <Field.Label>Seller has confirmed (confirmed offline)</Field.Label>
                </Field>
              )}

              {config.publishes && aiDocs.length > 0 && (
                <Field>
                  <Field.Label>
                    <FontAwesomeIcon icon={faRobot} /> Review AI-generated documents
                  </Field.Label>
                  <div className="d-flex flex-column gap-2 border rounded p-2">
                    {aiDocs.map((d) => (
                      <div key={d.id} className="d-flex align-items-center justify-content-between gap-2">
                        <label className="d-flex align-items-center gap-2 mb-0">
                          <Checkbox
                            checked={reviewedDocIds.has(d.id)}
                            onCheckedChange={(c) =>
                              setReviewedDocIds((prev) => {
                                const next = new Set(prev)
                                if (c === true) next.add(d.id)
                                else next.delete(d.id)
                                return next
                              })
                            }
                          />
                          {d.name}
                        </label>
                        <a
                          href={`/listings/${deal.id}/documents`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-nowrap"
                        >
                          Open <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                        </a>
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              {req('sellerLinked') && (
                <Field>
                  <Field.Label>Seller</Field.Label>
                  <Select
                    value={form.sellerContactId ?? ''}
                    onValueChange={(v) => {
                      set('sellerContactId', v || null)
                      set('sellerLinked', !!v || deal.sellerContactIds.length > 0)
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select a seller…" />
                    </Select.Trigger>
                    <Select.Content>
                      {sellerOptions.map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                  {deal.sellerContactIds.length > 0 && (
                    <Field.Description>A seller is already linked to this deal.</Field.Description>
                  )}
                </Field>
              )}

              {req('dealSide') && (
                <Field>
                  <Field.Label>Side</Field.Label>
                  <RadioGroup
                    value={form.dealSide ?? ''}
                    onValueChange={(v) => set('dealSide', v as GateFormState['dealSide'])}
                  >
                    <RadioGroup.Item value="seller">Sell-side</RadioGroup.Item>
                    <RadioGroup.Item value="buyer">Buy-side</RadioGroup.Item>
                  </RadioGroup>
                </Field>
              )}

              {req('buyerLinked') && (
                <Field>
                  <Field.Label>Buyer</Field.Label>
                  <Select
                    value={form.buyerContactId ?? ''}
                    onValueChange={(v) => {
                      set('buyerContactId', v || null)
                      set('buyerLinked', !!v || deal.buyerContactIds.length > 0)
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select a buyer…" />
                    </Select.Trigger>
                    <Select.Content>
                      {getSellerOptions(deal.propertyId).map((o) => (
                        <Select.Item key={o.value} value={o.value}>
                          {o.label}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>
              )}

              {req('listedOnDate') && (
                <Field>
                  <Field.Label>Listing Executed</Field.Label>
                  <Input
                    type="date"
                    value={form.listedOnDate ?? ''}
                    onChange={(e) => set('listedOnDate', e.target.value || null)}
                  />
                </Field>
              )}

              {req('listingExpirationDate') && (
                <Field>
                  <Field.Label>Listing Expires</Field.Label>
                  <Input
                    type="date"
                    value={form.listingExpirationDate ?? ''}
                    onChange={(e) => set('listingExpirationDate', e.target.value || null)}
                  />
                </Field>
              )}

              {req('salePrice') && (
                <Field>
                  <Field.Label>Sale Price</Field.Label>
                  <Input
                    type="number"
                    value={form.salePrice ?? ''}
                    onChange={(e) => set('salePrice', e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
              )}

              {req('commissionAmount') && (
                <Field>
                  <Field.Label>Gross Commission ($)</Field.Label>
                  <Input
                    type="number"
                    value={form.commissionAmount ?? ''}
                    onChange={(e) => set('commissionAmount', e.target.value ? Number(e.target.value) : null)}
                  />
                </Field>
              )}

              {req('closeDate') && (
                <Field>
                  <Field.Label>Close Date</Field.Label>
                  <Input
                    type="date"
                    value={form.closeDate ?? ''}
                    onChange={(e) => set('closeDate', e.target.value || null)}
                  />
                </Field>
              )}

              {req('deadReason') && (
                <Field>
                  <Field.Label>Lost Reason</Field.Label>
                  <Input
                    value={form.deadReason ?? ''}
                    onChange={(e) => set('deadReason', e.target.value || null)}
                    placeholder="Why is this deal lost?"
                  />
                </Field>
              )}

              {config.targetStage === 'closed' && (
                <Alert severity="info" withIcon>
                  <Alert.Title>Economics carried from Under Contract</Alert.Title>
                  The voucher and receivables are created in Back Office after close.
                </Alert>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="primary" disabled={!confirmable} onClick={commit}>
            {config.publishes ? 'Approve & Publish' : 'Confirm'}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  )
}
```

> **Note on Blueprint prop names:** `Checkbox`/`RadioGroup`/`Select`/`Input`/`Field` prop shapes (e.g. `onCheckedChange` vs `onChange`, `orientation` on `Field`, `RadioGroup.Item` children) should be confirmed against the live components — mirror how `CreateDealModal.tsx` (Side `RadioGroup`, contact `Combobox`) and `SyndicationStatus.tsx` (`Switch`, `Modal`) use them. Adjust names to match; the logic (which fields render, `confirmable`, `commit`) does not change.

- [ ] **Step 3: Create the global mount**

Create `src/components/deals/GlobalStageGateModal.tsx`:

```tsx
import { StageGate } from '#/components/deals/StageGate'
import { useStageGate } from '#/components/deals/useStageGate'

/** The single, app-wide stage-gate modal, driven by the useStageGate store. */
export function GlobalStageGateModal() {
  const open = useStageGate((s) => s.open)
  const dealId = useStageGate((s) => s.dealId)
  const targetStage = useStageGate((s) => s.targetStage)
  const close = useStageGate((s) => s.close)

  if (!dealId || !targetStage) return null

  return (
    <StageGate
      dealId={dealId}
      targetStage={targetStage}
      open={open}
      onOpenChange={(o) => {
        if (!o) close()
      }}
    />
  )
}
```

- [ ] **Step 4: Mount it in AppShell under a ToasterProvider**

In `src/components/layout/AppShell.tsx`, add imports:

```tsx
import { ToasterProvider } from '@buildoutinc/blueprint-react/ui/Toast'
import { GlobalStageGateModal } from '#/components/deals/GlobalStageGateModal'
```

Wrap the shell's returned tree in `<ToasterProvider>` and add the modal next to `<GlobalCreateDealModal />`:

```tsx
  return (
    <ToasterProvider>
      <div className="app-shell vh-100 d-flex flex-column overflow-hidden">
        <GlobalNavbar />
        <div className="flex-grow-1 d-flex overflow-hidden">
          <main className="app-shell__main flex-grow-1 overflow-auto">
            {hydrated ? (
              <Outlet />
            ) : (
              <div className="d-flex justify-content-center align-items-center py-8 w-100 h-100">
                <FontAwesomeIcon icon={faSpinnerThird} spin size="2x" className="text-muted" />
              </div>
            )}
          </main>
          {hydrated && <AssistantSidebar />}
        </div>
        {hydrated && <OmniSearch />}
        {hydrated && <GlobalCreateDealModal />}
        {hydrated && <GlobalStageGateModal />}
      </div>
    </ToasterProvider>
  )
```

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors. Fix any Blueprint prop-name mismatches flagged (see the note in Step 2).

- [ ] **Step 6: Commit**

```bash
git add src/components/deals/useStageGate.ts src/components/deals/StageGate.tsx src/components/deals/GlobalStageGateModal.tsx src/components/layout/AppShell.tsx
git commit -m "feat(deals): StageGate modal + global mount driven by useStageGate"
```

---

## Task 5: Wire the Deals board entry point

**Files:**
- Modify: `src/routes/listings/index.tsx` (`onRestage`)

**Interfaces:**
- Consumes: `useStageGate` from `#/components/deals/useStageGate`.
- The board (`DealBoard`) already calls `onRestage(listingId, stage)` on drop; only `onRestage`'s body changes. No `DealBoard.tsx` change is needed — it neither commits nor moves the card itself.

**Verification:** UI task — typecheck + manual.

- [ ] **Step 1: Replace the commit with a gate open**

In `src/routes/listings/index.tsx`, add the import:

```ts
import { useStageGate } from '#/components/deals/useStageGate'
```

Remove the now-unused `updateDealStage` import if nothing else uses it. Replace the `onRestage` callback body:

```ts
  const onRestage = useCallback((listingId: string, stage: PropertyStatus) => {
    const listing = getStore().listings.get(listingId)
    if (!listing || listing.status === stage) return
    // Open the gate instead of committing. The card is never optimistically
    // moved, so a cancelled gate leaves the board unchanged. The board
    // re-derives when the gate commits (Task: onCommitted → setVersion).
    useStageGate.getState().openGate(listingId, stage)
  }, [])
```

- [ ] **Step 2: Recompute the board after a commit**

The gate commits from the global modal, so the board needs to know to re-derive. Subscribe the board's `version` bump to the store. Add, inside `PropertyListings`, an effect that bumps `version` when the listings map identity changes:

```ts
  // Re-derive the board whenever the store's listings change (e.g. a gate commit).
  useEffect(() => {
    const unsub = useDataStore.subscribe((s, prev) => {
      if (s.listings !== prev.listings) setVersion((v) => v + 1)
    })
    return unsub
  }, [])
```

Add the imports if missing: `import { useEffect } from 'react'` and `import { useDataStore } from '#/data/dataStore'`.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `bun --bun run dev` and open http://localhost:3000/listings (board view). Then:
- Drag a Pitching card onto **Active** → the **Approve & Publish** gate opens; the card has **not** moved.
- Cancel → the card stays in Pitching.
- Drag again, fill Seller + Side + both dates, check Seller-confirmed and every AI-doc row → **Approve & Publish** enables; confirm → toast appears, card is now in Active.
- Drag an Active card back to **Pitching** → confirm gate with the unpublish checkbox; confirm → card moves back.

(Ask the user to perform these if you cannot drive the browser.)

- [ ] **Step 5: Commit**

```bash
git add src/routes/listings/index.tsx
git commit -m "feat(deals): board drag opens the stage gate instead of committing"
```

---

## Task 6: Wire the deal detail header entry point

**Files:**
- Modify: `src/components/properties/PropertyDetailHeader.tsx`

**Interfaces:**
- Consumes: `useStageGate` from `#/components/deals/useStageGate`.
- The stage `<Select>` value binds to `listing.status` (the live store value), so a cancelled gate auto-reverts.

**Verification:** UI task — typecheck + manual.

- [ ] **Step 1: Bind the Select to the live status and open the gate on change**

In `src/components/properties/PropertyDetailHeader.tsx`, add the import:

```ts
import { useStageGate } from '#/components/deals/useStageGate'
```

Remove the local stage state (`const [stage, setStage] = useState<ListingStage>(listing.status)`) and drive the Select from `listing.status` directly. Update the `<Select>`:

```tsx
            <Select
              value={listing.status}
              onValueChange={(v) => {
                if (v && v !== listing.status) {
                  useStageGate.getState().openGate(listing.id, v as ListingStage)
                }
              }}
            >
```

Replace the two `stage` references inside `Select.Trigger` (the dot color and `Select.Value`) with `listing.status`:

```tsx
              <Select.Trigger style={{ minWidth: 168 }}>
                <span className="d-inline-flex align-items-center gap-2">
                  <span
                    className="rounded-circle"
                    style={{ width: 8, height: 8, backgroundColor: STATUS_COLORS[listing.status] }}
                  />
                  <Select.Value>{(v) => STATUS_LABELS[v as ListingStage]}</Select.Value>
                </span>
              </Select.Trigger>
```

> Because the value is bound to `listing.status`, choosing a stage opens the gate but the Select snaps back to the current status until a commit updates the store — this IS the "cancel auto-reverts" behavior.

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors. Remove the now-unused `useState` import if nothing else in the file uses it.

- [ ] **Step 3: Manual verification**

Run: `bun --bun run dev`, open a deal detail page (e.g. `/listings/<id>`). Then:
- Change the header stage `<Select>` to a forward stage → the correct gate opens.
- Cancel → the Select shows the original stage (unchanged).
- Complete the gate → the Select reflects the new stage and the store persists.

- [ ] **Step 4: Commit**

```bash
git add src/components/properties/PropertyDetailHeader.tsx
git commit -m "feat(deals): detail-header stage select opens the stage gate"
```

---

## Task 7: Publish-aware SyndicationStatus

**Files:**
- Modify: `src/components/listings/SyndicationStatus.tsx`

**Interfaces:**
- Consumes: `listing.publishedAt` (Task 1).

**Verification:** UI task — typecheck + manual.

- [ ] **Step 1: Add the published headline**

In `src/components/listings/SyndicationStatus.tsx`, derive the published state from `listing.publishedAt` and show it as the headline. Replace the `label` computation and the trailing status pill:

```tsx
  const published = listing.publishedAt != null
  const activeCount = networks.filter((n) => n.active).length
  const label = !published
    ? 'Not published'
    : activeCount === 0
      ? 'Published'
      : `Published · syndicating to ${activeCount}/${networks.length}`
```

Update the `statusColor` so an unpublished listing reads muted:

```tsx
  const statusColor = !published
    ? 'var(--stage-inactive)'
    : needsAttention
      ? 'var(--bp-warning)'
      : activeCount > 0
        ? 'var(--stage-active)'
        : 'var(--stage-active)'
```

(Keep the existing `needsAttention` computation. The per-network modal contents are unchanged.)

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `bun --bun run dev`:
- Open a Pitching deal → header reads **Not published**.
- Publish it via the gate → header flips to **Published · syndicating to N/M** (and the toast fires).
- Move it back to Pitching with the unpublish box checked → header returns to **Not published**; with the box unchecked → header stays **Published** even though the stage is Pitching.

- [ ] **Step 4: Commit**

```bash
git add src/components/listings/SyndicationStatus.tsx
git commit -m "feat(listings): publish-aware SyndicationStatus driven by publishedAt"
```

---

## Self-Review Notes

**Spec coverage** — every design section maps to a task:
- `resolveGate` / three gate kinds / direction rules → Task 2.
- Five gates (approve-and-publish, →Under Contract, →Closed, →Lost, backward confirm) → Task 2 (config) + Task 4 (rendering).
- AI-doc checklist + open link + `aiGenerated` flag → Task 1 (flag) + Task 4 (checklist).
- `publishedAt` + broker-choice unpublish → Task 1 (field) + Task 3 (commit) + Task 4 (checkbox) + Task 7 (indicator).
- Both entry points route through one modal; cancel reverts → Tasks 4–6.
- Blueprint toast on publish → Task 4.
- History entry on commit → Task 3.
- SEED_VERSION bump → Task 1.
- Non-goal: AI `updateDealStage` untouched → not modified by any task (confirmed).

**Type consistency** — `GateFormState`, `GateConfig`, `StageTransitionInput`, `RequiredField` are defined once in Task 2 and reused verbatim in Tasks 3–4; `commitStageTransition`'s signature matches `StageTransitionInput`; `useStageGate.openGate(dealId, targetStage)` is the identical call in Tasks 5 and 6.

**Known follow-up flagged in the plan:** Blueprint form-primitive prop names (`Checkbox.onCheckedChange`, `RadioGroup.Item`, `Field.orientation`) must be verified against the installed component versions during Task 4 (Step 2 note) — the logic is fixed; only prop spellings may need adjustment.
