# Data Layer Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the prototype's data onto a single relational, client-owned Zustand store that persists across refresh (IndexedDB) and resets to an identical clean state, with a typed action + selector catalog a future AI layer can consume — while preserving today's behavior exactly.

**Architecture:** A Zustand store (`dataStore.ts`) holds the four entity Maps, seeded synchronously from the existing deterministic `generateDataset()` (so SSR and first client render match). A client-only hydrator replaces the seed with the persisted IndexedDB snapshot after mount. All writes go through named actions (`actions.ts`); all reads through named selectors (`store.ts`, signatures unchanged so existing consumers don't move). Reset clears the snapshot and reseeds.

**Tech Stack:** React 19 · TypeScript · TanStack Start · Zustand `^5.0.14` · `idb-keyval` (new) · Vitest `^4.1.9`.

## Global Constraints

- **State library: Zustand only.** Match the existing pattern in `src/features/editor/store.ts` (`create` + `useShallow`). Do NOT add or import `@tanstack/store` (transitive only, used nowhere in `src`).
- **Persistence: IndexedDB via `idb-keyval`.** IndexedDB's structured clone serializes `Map` and `File`/`Blob` natively — do not hand-convert Maps to arrays.
- **Single seed source:** `generateDataset()` in `src/data/seed.ts`, `SEED = 20240101`. Never introduce a second seed path.
- **Behavior parity is a success criterion.** Existing screens/flows must work exactly as today. `src/data/seed.test.ts` must keep passing unchanged after every task.
- **`store.ts` public selector signatures stay stable** (`getProperty`, `getListing`, `getContact`, `getListingsForProperty`, `getContactsForProperty`, `getOwnersForProperty`, `getPropertyOptions`, `getContactOptions`, `getSellerOptions`, `contactLabel`, `addProperty`, `updateProperty`, `addListing`, `getStore`). Changing their signatures is out of scope — 24 files depend on them.
- **Do NOT touch** `src/routes/login.tsx` or `src/lib/auth.ts`.
- **Package manager / commands:** `bun --bun run test` (→ `vitest run`), `bun --bun run dev`, `bun --bun run build`. Install deps with `bun add`.
- **Icons:** default `pro-regular`; never pass `fixedWidth` to `FontAwesomeIcon`.
- **Do not use Playwright.** Verify via `bun --bun run test`, `bun --bun run build`, and by asking the user to click through when a runtime check is needed.

---

## File Structure

- **Create** `src/data/dataStore.ts` — the Zustand store: four entity Maps + `hydrated` flag + internal setters. Seeded from `generateDataset()`.
- **Create** `src/data/persistence.ts` — `saveSnapshot` / `loadSnapshot` / `clearSnapshot` over `idb-keyval`, guarded by `SEED_VERSION`.
- **Create** `src/data/actions.ts` — the write path (named mutation actions).
- **Create** `src/data/selectors.ts` — reverse-relationship + search selectors (new reads; existing reads stay in `store.ts`).
- **Create** `src/components/system/DataStoreHydrator.tsx` — client hydration effect + optional reset control.
- **Modify** `src/data/store.ts` — back existing selectors with `useDataStore.getState()` instead of the module singleton.
- **Modify** `src/components/deals/CreateDealModal.tsx` — create deals via `actions.createDeal`.
- **Modify** `src/routes/backoffice/contacts/index.tsx`, `src/routes/backoffice/contacts/$contactId.tsx` — read via client selectors, not server functions.
- **Phase 4** — `dealFiles` into the store; deterministic read-only fixtures; display-metadata extraction (file lists in each task).

---

## Phase 1 — Reactive client store, persistence, hydration, reset

### Task 1: Zustand data store seeded from `generateDataset()`

**Files:**
- Create: `src/data/dataStore.ts`
- Test: `src/data/dataStore.test.ts`
- Modify: `package.json` (add `idb-keyval`)

**Interfaces:**
- Produces: `useDataStore` (Zustand hook/store), `type DataSlice = { properties: Map<string,Property>; listings: Map<string,Listing>; comps: Map<string,Comp>; contacts: Map<string,Contact> }`, and store methods `_replaceAll(slice: DataSlice): void`, `_setHydrated(v: boolean): void`, `hydrated: boolean`.

- [ ] **Step 1: Install idb-keyval**

Run: `bun add idb-keyval`
Expected: `package.json` gains `"idb-keyval": "^6.x"`; lockfile updates.

- [ ] **Step 2: Write the failing test**

```ts
// src/data/dataStore.test.ts
import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'

describe('useDataStore', () => {
  it('seeds all four entity maps deterministically on creation', () => {
    const s = useDataStore.getState()
    expect(s.properties.size).toBe(50)
    expect(s.contacts.size).toBe(80)
    expect(s.listings.size).toBeGreaterThan(0)
    expect(s.hydrated).toBe(false)
  })

  it('_replaceAll swaps the maps and preserves referential replacement', () => {
    const before = useDataStore.getState().properties
    useDataStore.getState()._replaceAll({
      properties: new Map(),
      listings: new Map(),
      comps: new Map(),
      contacts: new Map(),
    })
    const after = useDataStore.getState().properties
    expect(after).not.toBe(before)
    expect(after.size).toBe(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun --bun run test src/data/dataStore.test.ts`
Expected: FAIL — cannot find module `./dataStore`.

- [ ] **Step 4: Implement the store**

```ts
// src/data/dataStore.ts
import { create } from 'zustand'
import type { Comp, Contact, Listing, Property } from './types'
import { generateDataset } from './seed'

export interface DataSlice {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
}

export interface DataState extends DataSlice {
  /** True once the persisted IndexedDB snapshot has been loaded on the client. */
  hydrated: boolean
  /** Replace every entity map at once (hydration, reset, bulk import). */
  _replaceAll: (slice: DataSlice) => void
  _setHydrated: (v: boolean) => void
}

/** Build the deterministic seed slice. Same source on server and client. */
export function seedSlice(): DataSlice {
  const { properties, listings, comps, contacts } = generateDataset()
  return {
    properties: new Map(properties.map((p) => [p.id, p])),
    listings: new Map(listings.map((l) => [l.id, l])),
    comps: new Map(comps.map((c) => [c.id, c])),
    contacts: new Map(contacts.map((ct) => [ct.id, ct])),
  }
}

export const useDataStore = create<DataState>((set) => ({
  ...seedSlice(),
  hydrated: false,
  _replaceAll: (slice) => set({ ...slice }),
  _setHydrated: (v) => set({ hydrated: v }),
}))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --bun run test src/data/dataStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/data/dataStore.ts src/data/dataStore.test.ts
git commit -m "feat(data): add Zustand data store seeded from generateDataset"
```

### Task 2: IndexedDB snapshot persistence with version guard

**Files:**
- Create: `src/data/persistence.ts`
- Test: `src/data/persistence.test.ts`

**Interfaces:**
- Consumes: `DataSlice` from `src/data/dataStore.ts`.
- Produces: `SEED_VERSION: number`, `saveSnapshot(slice: DataSlice): Promise<void>`, `loadSnapshot(): Promise<DataSlice | null>` (returns `null` when absent or version-mismatched), `clearSnapshot(): Promise<void>`.

- [ ] **Step 1: Write the failing test** (uses `fake-indexeddb` so IDB exists under Vitest)

Run first: `bun add -d fake-indexeddb`

```ts
// src/data/persistence.test.ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSnapshot, loadSnapshot, saveSnapshot, SEED_VERSION } from './persistence'
import type { DataSlice } from './dataStore'

const slice = (): DataSlice => ({
  properties: new Map([['p1', { id: 'p1' } as any]]),
  listings: new Map(),
  comps: new Map(),
  contacts: new Map(),
})

describe('persistence', () => {
  beforeEach(async () => { await clearSnapshot() })

  it('round-trips a slice through IndexedDB (Maps survive structured clone)', async () => {
    await saveSnapshot(slice())
    const loaded = await loadSnapshot()
    expect(loaded?.properties.get('p1')).toEqual({ id: 'p1' })
  })

  it('returns null when no snapshot exists', async () => {
    expect(await loadSnapshot()).toBeNull()
  })

  it('ignores a snapshot written under a different SEED_VERSION', async () => {
    const { set } = await import('idb-keyval')
    await set('bo-proto:datastore', { version: SEED_VERSION + 1, slice: slice() })
    expect(await loadSnapshot()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/persistence.test.ts`
Expected: FAIL — cannot find module `./persistence`.

- [ ] **Step 3: Implement persistence**

```ts
// src/data/persistence.ts
import { del, get, set } from 'idb-keyval'
import type { DataSlice } from './dataStore'

/** Bump when seed logic changes so stale snapshots are auto-discarded on load. */
export const SEED_VERSION = 1

const SNAPSHOT_KEY = 'bo-proto:datastore'

interface Snapshot {
  version: number
  slice: DataSlice
}

export async function saveSnapshot(slice: DataSlice): Promise<void> {
  const snapshot: Snapshot = { version: SEED_VERSION, slice }
  await set(SNAPSHOT_KEY, snapshot)
}

export async function loadSnapshot(): Promise<DataSlice | null> {
  const snapshot = (await get(SNAPSHOT_KEY)) as Snapshot | undefined
  if (!snapshot || snapshot.version !== SEED_VERSION) return null
  return snapshot.slice
}

export async function clearSnapshot(): Promise<void> {
  await del(SNAPSHOT_KEY)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/persistence.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock src/data/persistence.ts src/data/persistence.test.ts
git commit -m "feat(data): add IndexedDB snapshot persistence with version guard"
```

### Task 3: Hydrate + persist wiring and reset

**Files:**
- Modify: `src/data/dataStore.ts`
- Test: `src/data/dataStore.test.ts` (extend)

**Interfaces:**
- Produces on the store: `hydrate(): Promise<void>` (client-only: load snapshot → `_replaceAll` → mark hydrated; if none, persist the current seed), `persist(): void` (debounced snapshot write), `reset(): Promise<void>` (clear snapshot → reseed → persist).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/data/dataStore.test.ts
import 'fake-indexeddb/auto'
import { clearSnapshot, loadSnapshot } from './persistence'

describe('hydrate / reset', () => {
  it('reset reseeds and writes an identical snapshot', async () => {
    await clearSnapshot()
    useDataStore.getState()._replaceAll({
      properties: new Map(), listings: new Map(), comps: new Map(), contacts: new Map(),
    })
    await useDataStore.getState().reset()
    expect(useDataStore.getState().properties.size).toBe(50)
    const snap = await loadSnapshot()
    expect(snap?.properties.size).toBe(50)
  })

  it('hydrate loads a prior snapshot over the seed', async () => {
    const { saveSnapshot } = await import('./persistence')
    await saveSnapshot({
      properties: new Map([['only', { id: 'only' } as any]]),
      listings: new Map(), comps: new Map(), contacts: new Map(),
    })
    await useDataStore.getState().hydrate()
    expect(useDataStore.getState().properties.size).toBe(1)
    expect(useDataStore.getState().hydrated).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/dataStore.test.ts`
Expected: FAIL — `reset`/`hydrate` is not a function.

- [ ] **Step 3: Extend the store**

Add to the `create<DataState>` object in `src/data/dataStore.ts`, and extend the `DataState` interface with `hydrate: () => Promise<void>`, `persist: () => void`, `reset: () => Promise<void>`:

```ts
// add imports at top:
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persistence'

// helper above create():
let _persistTimer: ReturnType<typeof setTimeout> | null = null

// inside the create() object, after _setHydrated:
  hydrate: async () => {
    const slice = await loadSnapshot()
    if (slice) {
      set({ ...slice, hydrated: true })
    } else {
      // First visit: persist the seed so the world is stable from here on.
      const { properties, listings, comps, contacts } = useDataStore.getState()
      await saveSnapshot({ properties, listings, comps, contacts })
      set({ hydrated: true })
    }
  },

  persist: () => {
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => {
      const { properties, listings, comps, contacts } = useDataStore.getState()
      void saveSnapshot({ properties, listings, comps, contacts })
    }, 300)
  },

  reset: async () => {
    await clearSnapshot()
    const slice = seedSlice()
    set({ ...slice })
    await saveSnapshot(slice)
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/dataStore.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/data/dataStore.ts src/data/dataStore.test.ts
git commit -m "feat(data): add hydrate, debounced persist, and reset to the data store"
```

### Task 4: Client auto-hydration + reset control

**Decision (supersedes the earlier `__root.tsx` mount):** `src/routes/__root.tsx` is bo-spark-CLI-managed (same overwrite warning as `login.tsx`), so mounting a hydrator component there risks silently disabling persistence on a CLI regen. Instead, trigger hydration from the non-route `dataStore.ts` module, guarded to the client. **Do NOT modify `src/routes/__root.tsx`.**

**Files:**
- Modify: `src/data/dataStore.ts` (append a client-only auto-hydration trigger at the bottom)
- Create: `src/components/system/ResetDemoButton.tsx` (the reset control, mounted into demo chrome later — not auto-mounted here)

**Interfaces:**
- Consumes: `useDataStore` (`hydrate`, `reset`).
- Produces: side-effecting auto-hydration on first client import of `dataStore.ts`; `ResetDemoButton` named export.

**Why the client guard is test-safe:** Vitest has no configured environment, so it runs in `node` where `typeof window === 'undefined'` — the guard skips auto-hydration during tests, leaving the existing store/persistence tests deterministic. In the browser, `window` exists and hydration runs once when the singleton module is first imported.

- [ ] **Step 1: Append the auto-hydration trigger** to the very bottom of `src/data/dataStore.ts` (after the `create(...)` call):

```ts
// Kick off hydration once, on the client only. `__root.tsx` is CLI-managed, so
// hydration lives here (a non-route module) rather than in a mounted component,
// so a bo-spark regen can never silently disable persistence. In tests
// (node env, no `window`) this is skipped, keeping the suite deterministic.
if (typeof window !== 'undefined') {
  void useDataStore.getState().hydrate()
}
```

- [ ] **Step 2: Run the full suite to confirm the guard doesn't disturb tests**

Run: `bun --bun run test`
Expected: PASS (same count as after Task 3; auto-hydration is skipped under node).

- [ ] **Step 3: Implement the reset control**

```tsx
// src/components/system/ResetDemoButton.tsx
import { Button } from '@buildoutinc/blueprint-react/ui/Button'
import { faArrowsRotate } from '@fortawesome/pro-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useDataStore } from '#/data/dataStore'

/** Wipes the demo world back to the deterministic clean state (keeps the session). */
export function ResetDemoButton() {
  const reset = useDataStore((s) => s.reset)
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        await reset()
        window.location.reload()
      }}
    >
      <FontAwesomeIcon icon={faArrowsRotate} />
      Reset demo
    </Button>
  )
}
```

- [ ] **Step 4: Verify build + existing tests**

Run: `bun --bun run test && bun --bun run build`
Expected: tests PASS; build succeeds.

- [ ] **Step 5: Runtime check (deferred to final user verification)**

The browser round-trip (add a deal → refresh persists → Reset demo restores clean state) is verified by the user at the plan's Final Verification, not in this task. We do not use Playwright.

- [ ] **Step 6: Commit**

```bash
git add src/data/dataStore.ts src/components/system/ResetDemoButton.tsx
git commit -m "feat(data): auto-hydrate persisted world on client and add Reset demo control"
```

---

## Phase 2 — Selectors and actions catalog

### Task 5: Back existing `store.ts` selectors with the Zustand store

**Files:**
- Modify: `src/data/store.ts`
- Test: `src/data/store.test.ts` (new)

**Interfaces:**
- Produces: unchanged public signatures. `getStore()` now returns the live slice `{ properties, listings, comps, contacts }` from `useDataStore.getState()` (so `src/lib/*.ts` keeps working). `addProperty` / `updateProperty` / `addListing` mutate via the store and call `persist()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/store.test.ts
import { describe, expect, it } from 'vitest'
import { getStore, getProperty, addProperty } from './store'
import { useDataStore } from './dataStore'

describe('store selectors backed by useDataStore', () => {
  it('getStore reflects the live Zustand slice', () => {
    const anyId = [...useDataStore.getState().properties.keys()][0]
    expect(getProperty(anyId)).toBe(useDataStore.getState().properties.get(anyId))
  })

  it('addProperty writes through the Zustand store', () => {
    const before = useDataStore.getState().properties.size
    addProperty({ id: 'p-test' } as any)
    expect(useDataStore.getState().properties.size).toBe(before + 1)
    expect(getProperty('p-test')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/store.test.ts`
Expected: FAIL — current `getStore()` returns the module singleton, not the Zustand slice (`getProperty('p-test')` after `addProperty` won't match store state, or the import shape differs).

- [ ] **Step 3: Rewrite the store internals** (keep every exported signature identical). Replace the singleton block at the top of `src/data/store.ts`:

```ts
import { useDataStore } from './dataStore'
import type { DataStore, Property, Listing, Contact, PropertyType, RelationshipStage } from './types'

/** Live view of the four entity maps from the Zustand store. */
export function getStore(): DataStore {
  const { properties, listings, comps, contacts } = useDataStore.getState()
  return { properties, listings, comps, contacts }
}

export function addProperty(property: Property): void {
  useDataStore.setState((s) => {
    const properties = new Map(s.properties)
    properties.set(property.id, property)
    return { properties }
  })
  useDataStore.getState().persist()
}

export function updateProperty(propertyId: string, patch: Partial<Property>): Property | undefined {
  const existing = useDataStore.getState().properties.get(propertyId)
  if (!existing) return undefined
  const updated: Property = { ...existing, ...patch, updatedAt: new Date().toISOString() }
  useDataStore.setState((s) => {
    const properties = new Map(s.properties)
    properties.set(propertyId, updated)
    return { properties }
  })
  useDataStore.getState().persist()
  return updated
}

export function addListing(listing: Listing): void {
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    listings.set(listing.id, listing)
    return { listings }
  })
  useDataStore.getState().persist()
}
```

Leave the read selectors (`getProperty`, `getListing`, `getListingsForProperty`, `getContact`, `getContactsForProperty`, `getOwnersForProperty`, `contactLabel`, `getPropertyOptions`, `getContactOptions`, `getSellerOptions`, and the re-export of `createProposalListing`) as-is — they already call `getStore()`, which now returns the live slice. Delete the old `_store` singleton, `_resetStore`, and the `generateDataset` import.

- [ ] **Step 4: Update `_resetStore` callers** — search and replace test usages.

Run: `grep -rn "_resetStore" src`
For each hit, replace with `useDataStore.getState().reset()` (async) or delete if the test no longer needs it.

- [ ] **Step 5: Run tests**

Run: `bun --bun run test`
Expected: all PASS (including `seed.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/data/store.ts src/data/store.test.ts
git commit -m "refactor(data): back store selectors with the Zustand store"
```

### Task 6: Reverse-relationship and search selectors

**Files:**
- Create: `src/data/selectors.ts`
- Test: `src/data/selectors.test.ts`

**Interfaces:**
- Produces: `listContactsForDeal(dealId: string): Contact[]`, `listDealsForContact(contactId: string): Listing[]`, `listDealsForProperty(propertyId: string): Listing[]`, `searchAll(query: string): { properties: Property[]; deals: Listing[]; contacts: Contact[] }`. Reverse links are computed from `listing.sellerContactIds`/`buyerContactIds`/`otherContactIds` (single source of truth) — no stored `dealIds`.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/selectors.test.ts
import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { listContactsForDeal, listDealsForContact } from './selectors'

describe('reverse-relationship selectors', () => {
  it('listContactsForDeal and listDealsForContact are consistent', () => {
    const listing = [...useDataStore.getState().listings.values()].find(
      (l) => l.sellerContactIds.length + l.buyerContactIds.length > 0,
    )!
    const contactId = [...listing.sellerContactIds, ...listing.buyerContactIds][0]
    expect(listContactsForDeal(listing.id).map((c) => c.id)).toContain(contactId)
    expect(listDealsForContact(contactId).map((l) => l.id)).toContain(listing.id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/selectors.test.ts`
Expected: FAIL — cannot find module `./selectors`.

- [ ] **Step 3: Implement selectors**

```ts
// src/data/selectors.ts
import { useDataStore } from './dataStore'
import type { Contact, Listing, Property } from './types'

/** All contacts attached to a deal (seller + buyer + other), deduped. */
export function listContactsForDeal(dealId: string): Contact[] {
  const { listings, contacts } = useDataStore.getState()
  const listing = listings.get(dealId)
  if (!listing) return []
  const ids = new Set([
    ...listing.sellerContactIds,
    ...listing.buyerContactIds,
    ...listing.otherContactIds,
  ])
  return [...ids].map((id) => contacts.get(id)).filter((c): c is Contact => !!c)
}

/** All deals a contact is attached to, in any role. Reverse of the listing arrays. */
export function listDealsForContact(contactId: string): Listing[] {
  const { listings } = useDataStore.getState()
  return [...listings.values()].filter(
    (l) =>
      l.sellerContactIds.includes(contactId) ||
      l.buyerContactIds.includes(contactId) ||
      l.otherContactIds.includes(contactId),
  )
}

/** All deals (listings) for a property. */
export function listDealsForProperty(propertyId: string): Listing[] {
  const { listings } = useDataStore.getState()
  return [...listings.values()].filter((l) => l.propertyId === propertyId)
}

/** Simple case-insensitive omnisearch over the in-memory world. */
export function searchAll(query: string): {
  properties: Property[]
  deals: Listing[]
  contacts: Contact[]
} {
  const q = query.trim().toLowerCase()
  const { properties, listings, contacts } = useDataStore.getState()
  if (!q) return { properties: [], deals: [], contacts: [] }
  return {
    properties: [...properties.values()].filter((p) =>
      [p.street, p.city, p.state].filter(Boolean).join(' ').toLowerCase().includes(q),
    ),
    deals: [...listings.values()].filter((l) => l.name.toLowerCase().includes(q)),
    contacts: [...contacts.values()].filter((c) =>
      `${c.firstName} ${c.lastName} ${c.company}`.toLowerCase().includes(q),
    ),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/selectors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/selectors.ts src/data/selectors.test.ts
git commit -m "feat(data): add reverse-relationship and search selectors"
```

### Task 7: Action layer (single write path) + migrate CreateDealModal

**Files:**
- Create: `src/data/actions.ts`
- Test: `src/data/actions.test.ts`
- Modify: `src/components/deals/CreateDealModal.tsx`

**Interfaces:**
- Consumes: `createProposalListing` (`src/data/createListing.ts`), `addListing`/`updateProperty` (`src/data/store.ts`), `useDataStore`.
- Produces: `createDeal(draft: NewListingDraft): { deal: Listing }`, `updateDealStage(dealId: string, status: PropertyStatus): { deal: Listing | null }`, `linkContactToDeal(dealId: string, contactId: string, role: 'seller' | 'buyer' | 'other'): { deal: Listing | null }`, `unlinkContactFromDeal(dealId: string, contactId: string): { deal: Listing | null }`. All args JSON-serializable; all return structured results; all call `persist()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/data/actions.test.ts
import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { linkContactToDeal, updateDealStage } from './actions'
import { listContactsForDeal } from './selectors'

describe('actions', () => {
  it('linkContactToDeal attaches a contact and shows in the reverse selector', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const contact = [...useDataStore.getState().contacts.values()][0]
    linkContactToDeal(deal.id, contact.id, 'other')
    expect(listContactsForDeal(deal.id).map((c) => c.id)).toContain(contact.id)
  })

  it('updateDealStage changes the deal status', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const { deal: updated } = updateDealStage(deal.id, 'closed')
    expect(updated?.status).toBe('closed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --bun run test src/data/actions.test.ts`
Expected: FAIL — cannot find module `./actions`.

- [ ] **Step 3: Implement actions**

```ts
// src/data/actions.ts
import { useDataStore } from './dataStore'
import { addListing } from './store'
import { createProposalListing, type NewListingDraft } from './createListing'
import type { Listing, PropertyStatus } from './types'

function patchListing(dealId: string, patch: (l: Listing) => Listing): Listing | null {
  const existing = useDataStore.getState().listings.get(dealId)
  if (!existing) return null
  const updated = patch(existing)
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    listings.set(dealId, updated)
    return { listings }
  })
  useDataStore.getState().persist()
  return updated
}

/** Create a proposal-stage deal (1:1 with a listing) from the New Deal flow. */
export function createDeal(draft: NewListingDraft): { deal: Listing } {
  const deal = createProposalListing(draft)
  addListing(deal) // addListing already persists
  return { deal }
}

export function updateDealStage(
  dealId: string,
  status: PropertyStatus,
): { deal: Listing | null } {
  return { deal: patchListing(dealId, (l) => ({ ...l, status, updatedAt: new Date().toISOString() })) }
}

export function linkContactToDeal(
  dealId: string,
  contactId: string,
  role: 'seller' | 'buyer' | 'other',
): { deal: Listing | null } {
  const key =
    role === 'seller' ? 'sellerContactIds' : role === 'buyer' ? 'buyerContactIds' : 'otherContactIds'
  return {
    deal: patchListing(dealId, (l) =>
      l[key].includes(contactId) ? l : { ...l, [key]: [...l[key], contactId] },
    ),
  }
}

export function unlinkContactFromDeal(dealId: string, contactId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      sellerContactIds: l.sellerContactIds.filter((id) => id !== contactId),
      buyerContactIds: l.buyerContactIds.filter((id) => id !== contactId),
      otherContactIds: l.otherContactIds.filter((id) => id !== contactId),
    })),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --bun run test src/data/actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Migrate CreateDealModal to the action**

Read `src/components/deals/CreateDealModal.tsx` around line 164. Replace the direct `createProposalListing(draft)` + `addListing(...)` sequence with:

```ts
import { createDeal } from '#/data/actions'
// ...
const { deal: listing } = createDeal(draft)
```

Remove now-unused imports of `createProposalListing`/`addListing` from `#/data/store` if they are no longer referenced elsewhere in the file.

- [ ] **Step 6: Verify tests + build**

Run: `bun --bun run test && bun --bun run build`
Expected: PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/data/actions.ts src/data/actions.test.ts src/components/deals/CreateDealModal.tsx
git commit -m "feat(data): add action write-path and route deal creation through it"
```

---

## Phase 3 — Repoint the server-function routes

### Task 8: People routes read via client selectors

**Files:**
- Modify: `src/routes/backoffice/contacts/index.tsx`
- Modify: `src/routes/backoffice/contacts/$contactId.tsx`
- (Leave `src/lib/contacts.ts` in place; it stays valid but unused by these routes.)

**Why:** these two routes are the only consumers of the server functions (`listContacts`, `getContactDetail`). Server functions read the server-side seed and never see client mutations, so a contact linked to a new deal wouldn't appear. Reading via client selectors fixes that and preserves parity for the existing (unmutated) data.

**Interfaces:**
- Consumes: `getStore`, `getContact` (`src/data/store.ts`); `listDealsForContact` (`src/data/selectors.ts`); existing `getContactDetail` logic (reproduce as a client selector `getContactDetailClient(id)` if the route needs the composed shape).

- [ ] **Step 1: Read both routes**

Run: `sed -n '1,80p' src/routes/backoffice/contacts/index.tsx` and `sed -n '1,80p' src/routes/backoffice/contacts/\$contactId.tsx`
Expected: identify where `listContacts()` / `getContactDetail()` are awaited (loader or component).

- [ ] **Step 2: If the composed `ContactDetail` shape is needed, add a client selector**

Port the body of `getContactDetail` from `src/lib/contacts.ts` into `src/data/selectors.ts` as a synchronous `getContactDetailClient(id: string): ContactDetail | null` (same logic, reading `useDataStore.getState()` instead of `getStore()` inside a server fn). Add a test mirroring the existing linkage.

- [ ] **Step 3: Replace the calls**

In `index.tsx`: replace `await listContacts({ data })` with `Array.from(getStore().contacts.values())` (apply the same `role`/`propertyId` filters inline). In `$contactId.tsx`: replace `await getContactDetail({ data: { id } })` with `getContactDetailClient(id)`.

- [ ] **Step 4: Verify tests + build**

Run: `bun --bun run test && bun --bun run build`
Expected: PASS; build succeeds.

- [ ] **Step 5: Runtime check (ask the user)**

Ask the user to open a contact from within a deal and from the People page and confirm it is the same record; add a deal linking a contact and confirm it appears on that contact.

- [ ] **Step 6: Commit**

```bash
git add src/routes/backoffice/contacts/index.tsx src/routes/backoffice/contacts/\$contactId.tsx src/data/selectors.ts src/data/selectors.test.ts
git commit -m "refactor(contacts): read People routes from client store so mutations reflect"
```

---

## Phase 4 — Consolidate the sprawl

### Task 9: Fold `dealFiles` into the persisted store

**Files:**
- Modify: `src/data/dataStore.ts` (add `dealFiles: Map<string, DealFileItem[]>` to `DataSlice`/`DataState`, seed empty)
- Modify: `src/data/persistence.ts` (include `dealFiles` — it already round-trips via structured clone; just add it to the `DataSlice` type usage)
- Create: `src/data/dealFilesActions.ts` (`getDealFiles(dealId)`, `addDealFile(dealId, item)`, `softDeleteDealFile(dealId, fileId)`) seeding lazily from `buildInitialFiles(listing)` on first read
- Modify: `src/components/properties/PropertyDetailFiles.tsx` (read/write via the actions)
- Test: `src/data/dealFilesActions.test.ts`

**Why:** deal files are mutable (added/deleted, carry real `File` blobs) so they must persist through the same snapshot. IndexedDB structured clone stores `File` natively.

- [ ] **Step 1: Add `dealFiles` to `DataSlice`** in `dataStore.ts` (initialize `dealFiles: new Map()` in `seedSlice`) and to the destructured persist payloads in `hydrate`/`persist`/`reset`.

- [ ] **Step 2: Write the failing test**

```ts
// src/data/dealFilesActions.test.ts
import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { addDealFile, getDealFiles } from './dealFilesActions'

describe('dealFiles', () => {
  it('lazily seeds from the listing then persists added files', () => {
    const listing = [...useDataStore.getState().listings.values()][0]
    const initial = getDealFiles(listing.id).length
    addDealFile(listing.id, { id: 'f-x', name: 'x.pdf', kind: 'file', parentId: null, createdAt: '2026-01-01T00:00:00.000Z' })
    expect(getDealFiles(listing.id).length).toBe(initial + 1)
  })
})
```

- [ ] **Step 3: Implement `dealFilesActions.ts`**

```ts
// src/data/dealFilesActions.ts
import { useDataStore } from './dataStore'
import { buildInitialFiles } from './dealFiles'
import type { DealFileItem } from './types'

export function getDealFiles(dealId: string): DealFileItem[] {
  const { dealFiles, listings } = useDataStore.getState()
  if (dealFiles.has(dealId)) return dealFiles.get(dealId)!
  const listing = listings.get(dealId)
  const seeded = listing ? buildInitialFiles(listing) : []
  useDataStore.setState((s) => {
    const next = new Map(s.dealFiles)
    next.set(dealId, seeded)
    return { dealFiles: next }
  })
  return seeded
}

function write(dealId: string, mut: (items: DealFileItem[]) => DealFileItem[]): void {
  const current = getDealFiles(dealId)
  useDataStore.setState((s) => {
    const next = new Map(s.dealFiles)
    next.set(dealId, mut(current))
    return { dealFiles: next }
  })
  useDataStore.getState().persist()
}

export function addDealFile(dealId: string, item: DealFileItem): void {
  write(dealId, (items) => [...items, item])
}

export function softDeleteDealFile(dealId: string, fileId: string): void {
  write(dealId, (items) =>
    items.map((i) => (i.id === fileId ? { ...i, deletedAt: new Date().toISOString() } : i)),
  )
}
```

- [ ] **Step 4: Repoint `PropertyDetailFiles.tsx`** from `buildInitialFiles(listing)` local state to `getDealFiles`/`addDealFile`/`softDeleteDealFile`. Read the file first, preserve its UI exactly.

- [ ] **Step 5: Verify + commit**

Run: `bun --bun run test && bun --bun run build`

```bash
git add src/data/dataStore.ts src/data/persistence.ts src/data/dealFilesActions.ts src/data/dealFilesActions.test.ts src/components/properties/PropertyDetailFiles.tsx
git commit -m "feat(data): persist deal files in the store"
```

### Task 10: Make read-only fixtures deterministic

**Files (audit each for `Math.random(` or unseeded `faker`):**
- `src/data/listingTraffic.ts`, `src/data/listingDemographics.ts`, `src/data/listingWebsiteActivity.ts`, `src/data/listingSyndication.ts`, `src/data/listingWebsiteSettings.ts`, `src/data/listingClientReport.ts`
- Create: `src/data/rng.ts` (a small seeded RNG)
- Test: `src/data/rng.test.ts`

**Why:** a fixture that uses `Math.random` reshuffles on every visit, which reads as flakiness in a demo. Seeding each generator off its entity id makes it stable across refresh with no persistence needed.

- [ ] **Step 1: Audit**

Run: `grep -rnE "Math\.random\(|faker\." src/data/listing*.ts`
Expected: a list of nondeterministic call sites. If empty, this task is a no-op — record that and skip to commit.

- [ ] **Step 2: Write the failing test for the RNG**

```ts
// src/data/rng.test.ts
import { describe, expect, it } from 'vitest'
import { seededRng } from './rng'

describe('seededRng', () => {
  it('is deterministic for the same seed string', () => {
    const a = seededRng('listing-42'); const b = seededRng('listing-42')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
})
```

- [ ] **Step 3: Implement `rng.ts`**

```ts
// src/data/rng.ts
/** Deterministic 0..1 generator seeded from a string (mulberry32 over a hashed seed). */
export function seededRng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

- [ ] **Step 4:** For each nondeterministic call site found in Step 1, thread the entity id into a `seededRng(id)` instance and replace `Math.random()` with `rng()`. Preserve output ranges. Add one determinism test per generator touched (call it twice with the same id, expect equal output).

- [ ] **Step 5: Verify + commit**

Run: `bun --bun run test && bun --bun run build`

```bash
git add src/data/rng.ts src/data/rng.test.ts src/data/listing*.ts
git commit -m "refactor(data): make read-only listing fixtures deterministic per id"
```

### Task 11: Extract display metadata out of `src/data/`

**Files:**
- Create: `src/components/contacts/contactDisplay.ts` — move the non-data exports out of `src/data/contacts.ts` (`RELATIONSHIP_DISPLAY`, `SIDE_DISPLAY`, `DEAL_STAGE_DISPLAY`, `PHONE_STATUS_DOT`, `LISTING_STATUS_PILL`, `contactFullName`, `contactInitials`, `contactAddressLines`, `buildActivity`, `buildBriefing`, the label/source constant arrays).
- Create: `src/components/email/emailDisplay.ts` — move `EMAIL_STATUS_DISPLAY` and other pure display maps out of `src/data/emails.ts` (keep the `Email` type + data generators in `src/data/emails.ts`).
- Modify importers (from the grep in planning):
  - contacts: `src/components/contacts/ContactDetailHeader.tsx`, `ContactDetailsCard.tsx`, `ContactEngagementPanel.tsx`, `ContactsTable.tsx`, `pills.tsx`, `src/routes/backoffice/contacts/index.tsx`
  - emails: `src/components/email/EmailCampaignHeader.tsx`, `EmailMetaCard.tsx`, `EmailPerformanceTab.tsx`, `EmailsCalendar.tsx`, `EmailsTable.tsx`, `src/components/listings/ListingEmail.tsx`, `src/routes/email/$emailId.tsx`, `src/routes/email/index.tsx`

**Why:** these are presentation mappings, not data. Moving them out leaves `src/data/` holding only actual data, which is the core de-clutter.

- [ ] **Step 1: Move the contact display exports** to `src/components/contacts/contactDisplay.ts` verbatim (they are pure — no store access). Re-export nothing from `data/contacts.ts`; delete the moved code there.

- [ ] **Step 2: Update contact importers** — change `from "#/data/contacts"` to `from "#/components/contacts/contactDisplay"` in the six files above. Run `grep -rn '#/data/contacts' src` to confirm zero remain.

- [ ] **Step 3: Move the email display maps** to `src/components/email/emailDisplay.ts`; keep the `Email` interface and generators in `src/data/emails.ts`. Update the eight email importers, splitting each import between `#/data/emails` (types/data) and `#/components/email/emailDisplay` (display) as needed.

- [ ] **Step 4: Verify build + tests**

Run: `bun --bun run test && bun --bun run build`
Expected: PASS; no unresolved imports.

- [ ] **Step 5: Commit**

```bash
git add src/components/contacts/contactDisplay.ts src/components/email/emailDisplay.ts src/data/contacts.ts src/data/emails.ts src/components src/routes
git commit -m "refactor(data): move display metadata out of src/data into components"
```

---

## Final verification

- [ ] `bun --bun run test` — all green, including `seed.test.ts` (parity guard).
- [ ] `bun --bun run build` — succeeds.
- [ ] Ask the user to run `bun --bun run dev` and confirm: (1) every existing screen looks/works as before; (2) adding a deal persists across refresh; (3) a contact opened from a deal matches the People page; (4) **Reset demo** restores the clean state without logging out.

## Notes carried forward to the AI spec (not built here)

- The `actions.ts` + `selectors.ts` catalogs are the AI's future toolset. Keep action args JSON-serializable and returns structured.
- **Deferred actions (YAGNI):** the spec listed `createContact`, `updateContact`, `addComp`, and `navigateTo` as examples of the catalog. No current UI flow creates contacts/comps or needs programmatic navigation, so these are intentionally not built now — add each when a flow (or the AI tool loop) first needs it, following the same shape as the Task 7 actions. `updateProperty` already exists (Task 5).
- A stateless server stream-relay (holding the model key) is the only new server surface AI will need.
