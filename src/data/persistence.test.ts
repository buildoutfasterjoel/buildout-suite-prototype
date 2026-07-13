import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSnapshot, loadSnapshot, saveSnapshot, SEED_VERSION } from './persistence'
import type { DataSlice } from './dataStore'

const slice = (): DataSlice => ({
  properties: new Map([['p1', { id: 'p1' } as any]]),
  listings: new Map(),
  comps: new Map(),
  contacts: new Map(),
  dealFiles: new Map(),
  emails: new Map(),
  callLists: new Map(),
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
