import { create } from 'zustand'
import type { Comp, Contact, DealFileItem, Listing, Property } from './types'
import { generateDataset } from './seed'
import { clearSnapshot, loadSnapshot, saveSnapshot } from './persistence'

export interface DataSlice {
  properties: Map<string, Property>
  listings: Map<string, Listing>
  comps: Map<string, Comp>
  contacts: Map<string, Contact>
  /** Deal Files workspace per listing/deal id — lazily seeded on first read via dealFilesActions. */
  dealFiles: Map<string, DealFileItem[]>
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
      set({ ...slice, dealFiles: slice.dealFiles ?? new Map(), hydrated: true })
    } else {
      // First visit: persist the seed so the world is stable from here on.
      const { properties, listings, comps, contacts, dealFiles } = useDataStore.getState()
      await saveSnapshot({ properties, listings, comps, contacts, dealFiles })
      set({ hydrated: true })
    }
  },

  persist: () => {
    if (_persistTimer) clearTimeout(_persistTimer)
    _persistTimer = setTimeout(() => {
      const { properties, listings, comps, contacts, dealFiles } = useDataStore.getState()
      void saveSnapshot({ properties, listings, comps, contacts, dealFiles })
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
