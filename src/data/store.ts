import type { DataStore } from './types'
import { generateDataset } from './seed'

let _store: DataStore | null = null

export function getStore(): DataStore {
  if (_store !== null) return _store

  const { properties, comps, contacts } = generateDataset()

  _store = {
    properties: new Map(properties.map((p) => [p.id, p])),
    comps: new Map(comps.map((c) => [c.id, c])),
    contacts: new Map(contacts.map((ct) => [ct.id, ct])),
  }

  return _store
}

export function _resetStore(): void {
  _store = null
}
