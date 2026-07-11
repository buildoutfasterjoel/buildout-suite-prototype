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
