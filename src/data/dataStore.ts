import { create } from 'zustand'
import type { Comp, Contact, DealFileItem, Listing, Property, Task } from './types'
import { generateDataset, seedCallLists, seedContactShares } from './seed'
import { getEmails, type Email } from './emails'
import type { CallList } from './contactLists'
import type { ContactShare } from './teammates'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persistence'
import { registerPinnedPhotoResolver } from '#/components/properties/propertyDisplay'

export interface DataSlice {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
  /** Deal Files workspace per listing/deal id — lazily seeded on first read via dealFilesActions. */
  dealFiles: Map<string, DealFileItem[]>
  /** Email campaigns — seeded from the deterministic mock; AI/user drafts are prepended here. */
  emails: Map<string, Email>
  /** User/AI-created contact "call lists" (membership snapshots). Built-in lists stay static in contactLists.ts. */
  callLists: Map<string, CallList>
  /** Contact sharing: teammates granted access per contact id. Absent id ⇒ the default seed. */
  contactShares: Map<string, ContactShare[]>
  /** Standalone tasks created via the Add Task modal, keyed by id. Seeded empty. */
  tasks: Map<string, Task>
}

export interface DataState extends DataSlice {
  /** True once the persisted IndexedDB snapshot has been loaded on the client. */
  hydrated: boolean
  /** Replace every entity map at once (hydration, reset, bulk import). */
  _replaceAll: (slice: DataSlice) => void
  _setHydrated: (v: boolean) => void
  /** Load the persisted IndexedDB snapshot on the client; seeds and persists if none exists. */
  hydrate: () => Promise<void>
  /** Debounced (300ms) snapshot write of the current state. */
  persist: () => void
  /** Clear the persisted snapshot, reseed, and persist the fresh seed. */
  reset: () => Promise<void>
}

/** Build the deterministic seed slice. Same source on server and client. */
export function seedSlice(): DataSlice {
  const { properties, listings, comps, contacts } = generateDataset()
  return {
    properties: new Map(properties.map((p) => [p.id, p])),
    listings: new Map(listings.map((l) => [l.id, l])),
    comps: new Map(comps.map((c) => [c.id, c])),
    contacts: new Map(contacts.map((ct) => [ct.id, ct])),
    dealFiles: new Map(),
    emails: new Map(getEmails().map((e) => [e.id, e])),
    callLists: new Map(seedCallLists().map((l) => [l.id, l])),
    contactShares: seedContactShares(contacts),
    tasks: new Map(),
  }
}

/**
 * Id prefix for contacts a demo beat conjures into the book mid-session — the
 * inbound leads that land when a listing goes live (see rosaLeads.ts). They're
 * not in the seed, so `resetRosaDemoState` clears them by prefix on a hard
 * refresh rather than leaving them behind for the next run.
 */
export const SIM_LEAD_ID_PREFIX = 'sim-lead-'

/**
 * Rosa's demo arc (call back → her email → Start a Deal → the BOV wizard →
 * activate → call the leads) is built to be replayed. On every hydrate — i.e. a
 * hard refresh — her slice of the world resets to the seed: her contact record,
 * any deals on her owned building (the seed ships none, so everything there is
 * demo-created), their files/tasks, the simulated leads the activation dropped
 * onto the deal, and her sharing state. The rest of the world keeps its
 * persisted snapshot; Reset Demo remains the full wipe. Ids line up because
 * generation is deterministic and snapshots only load under a matching
 * SEED_VERSION.
 */
export function resetRosaDemoState(
  snapshot: DataSlice,
  fresh: DataSlice,
): DataSlice {
  const freshRosa = [...fresh.contacts.values()].find(
    (c) => c.heroKey === 'rosa',
  )
  if (!freshRosa) return snapshot
  const rosaPropertyIds = new Set(freshRosa.ownedPropertyIds ?? [])

  const contacts = new Map(snapshot.contacts)
  contacts.set(freshRosa.id, freshRosa)
  // Simulated inbound leads are re-created by the beat that spawned them.
  const removedContactIds = new Set<string>()
  for (const id of contacts.keys()) {
    if (id.startsWith(SIM_LEAD_ID_PREFIX)) {
      contacts.delete(id)
      removedContactIds.add(id)
    }
  }

  const listings = new Map(snapshot.listings)
  const removedDealIds = new Set<string>()
  for (const [id, l] of listings) {
    if (rosaPropertyIds.has(l.propertyId)) {
      listings.delete(id)
      removedDealIds.add(id)
    }
  }

  const properties = new Map(snapshot.properties)
  for (const pid of rosaPropertyIds) {
    const p = fresh.properties.get(pid)
    if (p) properties.set(pid, p)
  }

  const tasks = new Map(snapshot.tasks)
  for (const [id, t] of tasks) {
    if (
      t.contactId === freshRosa.id ||
      (t.contactId != null && removedContactIds.has(t.contactId)) ||
      (t.dealId != null && removedDealIds.has(t.dealId))
    ) {
      tasks.delete(id)
    }
  }

  const dealFiles = new Map(snapshot.dealFiles)
  for (const id of removedDealIds) dealFiles.delete(id)

  const contactShares = new Map(snapshot.contactShares)
  const freshShares = fresh.contactShares.get(freshRosa.id)
  if (freshShares) contactShares.set(freshRosa.id, freshShares)
  else contactShares.delete(freshRosa.id)
  for (const id of removedContactIds) contactShares.delete(id)

  return {
    ...snapshot,
    contacts,
    listings,
    properties,
    tasks,
    dealFiles,
    contactShares,
  }
}

let _persistTimer: ReturnType<typeof setTimeout> | null = null

export const useDataStore = create<DataState>((set) => ({
  ...seedSlice(),
  hydrated: false,
  _replaceAll: (slice) => set({ ...slice }),
  _setHydrated: (v) => set({ hydrated: v }),

  hydrate: async () => {
    if (_persistTimer) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
    const slice = await loadSnapshot()
    if (slice) {
      const normalized: DataSlice = {
        ...slice,
        dealFiles: slice.dealFiles ?? new Map(),
        emails: slice.emails ?? new Map(getEmails().map((e) => [e.id, e])),
        callLists: slice.callLists ?? new Map(),
        contactShares: slice.contactShares ?? new Map(),
        tasks: slice.tasks ?? new Map(),
      }
      // Rosa's demo arc resets on every hard refresh — the pre-hydrate state
      // is the fresh seed, so it supplies her pristine records.
      const fresh = useDataStore.getState()
      set({ ...resetRosaDemoState(normalized, fresh), hydrated: true })
    } else {
      // First visit: persist the seed so the world is stable from here on.
      const { properties, listings, comps, contacts, dealFiles, emails, callLists, contactShares, tasks } =
        useDataStore.getState()
      await saveSnapshot({ properties, listings, comps, contacts, dealFiles, emails, callLists, contactShares, tasks })
      set({ hydrated: true })
    }
  },

  persist: () => {
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => {
      const { properties, listings, comps, contacts, dealFiles, emails, callLists, contactShares, tasks } =
        useDataStore.getState()
      void saveSnapshot({ properties, listings, comps, contacts, dealFiles, emails, callLists, contactShares, tasks })
    }, 300)
  },

  reset: async () => {
    if (_persistTimer) {
      clearTimeout(_persistTimer)
      _persistTimer = null
    }
    await clearSnapshot()
    const slice = seedSlice()
    set({ ...slice })
    await saveSnapshot(slice)
  },
}))

// Photo pinning: story properties carry a `photoId` that overrides the
// hash-picked pool photo. getPhotoUrl consults the live store through this
// resolver (registered here, after store creation, because propertyDisplay is
// already in this module's import graph via emails.ts). Resolves listing ids
// through to their parent property, so deal thumbnails match too.
registerPinnedPhotoResolver((id) => {
  const s = useDataStore.getState()
  const property =
    s.properties.get(id) ??
    s.properties.get(s.listings.get(id)?.propertyId ?? '')
  return property?.photoId
})

// Kick off hydration once, on the client only. `__root.tsx` is CLI-managed, so
// hydration lives here (a non-route module) rather than in a mounted component,
// so a bo-spark regen can never silently disable persistence. In tests
// (node env, no `window`) this is skipped, keeping the suite deterministic.
if (typeof window !== 'undefined') {
  void useDataStore.getState().hydrate()
}
