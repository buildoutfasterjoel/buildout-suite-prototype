import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDataStore } from './dataStore'
import 'fake-indexeddb/auto'
import { clearSnapshot, loadSnapshot } from './persistence'
import * as persistence from './persistence'

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
      dealFiles: new Map(),
      emails: new Map(),
      callLists: new Map(),
    })
    const after = useDataStore.getState().properties
    expect(after).not.toBe(before)
    expect(after.size).toBe(0)
  })
})

describe('hydrate / reset', () => {
  it('reset reseeds and writes an identical snapshot', async () => {
    await clearSnapshot()
    useDataStore.getState()._replaceAll({
      properties: new Map(), listings: new Map(), comps: new Map(), contacts: new Map(),
      dealFiles: new Map(), emails: new Map(), callLists: new Map(),
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
      dealFiles: new Map(), emails: new Map(), callLists: new Map(),
    })
    await useDataStore.getState().hydrate()
    expect(useDataStore.getState().properties.size).toBe(1)
    expect(useDataStore.getState().hydrated).toBe(true)
  })
})

describe('persist debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('collapses rapid persist() calls into a single saveSnapshot after 300ms', () => {
    vi.useFakeTimers()
    const saveSnapshotSpy = vi.spyOn(persistence, 'saveSnapshot').mockResolvedValue(undefined)

    useDataStore.getState().persist()
    useDataStore.getState().persist()

    expect(saveSnapshotSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(300)

    expect(saveSnapshotSpy).toHaveBeenCalledTimes(1)
  })
})
