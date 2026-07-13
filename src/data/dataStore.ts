import { create } from 'zustand'
import type { Comp, Contact, DealFileItem, Listing, Property } from './types'
import { generateDataset } from './seed'
import { getEmails, type Email } from './emails'
import type { CallList } from './contactLists'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persistence'

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
    callLists: new Map(),
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
      set({
        ...slice,
        dealFiles: slice.dealFiles ?? new Map(),
        emails: slice.emails ?? new Map(getEmails().map((e) => [e.id, e])),
        callLists: slice.callLists ?? new Map(),
        hydrated: true,
      })
    } else {
      // First visit: persist the seed so the world is stable from here on.
      const { properties, listings, comps, contacts, dealFiles, emails, callLists } =
        useDataStore.getState()
      await saveSnapshot({ properties, listings, comps, contacts, dealFiles, emails, callLists })
      set({ hydrated: true })
    }
  },

  persist: () => {
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => {
      const { properties, listings, comps, contacts, dealFiles, emails, callLists } =
        useDataStore.getState()
      void saveSnapshot({ properties, listings, comps, contacts, dealFiles, emails, callLists })
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

// Kick off hydration once, on the client only. `__root.tsx` is CLI-managed, so
// hydration lives here (a non-route module) rather than in a mounted component,
// so a bo-spark regen can never silently disable persistence. In tests
// (node env, no `window`) this is skipped, keeping the suite deterministic.
if (typeof window !== 'undefined') {
  void useDataStore.getState().hydrate()
}
