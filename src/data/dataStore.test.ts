import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDataStore } from './dataStore'
import 'fake-indexeddb/auto'
import { clearSnapshot, loadSnapshot } from './persistence'
import * as persistence from './persistence'

describe('useDataStore', () => {
  it('seeds all four entity maps deterministically on creation', () => {
    const s = useDataStore.getState()
    // 20 pipeline properties + 8 tracked (no-deal) properties + Rosa's
    // story-owned building (see applyHeroes).
    expect(s.properties.size).toBe(29)
    expect(s.contacts.size).toBe(80)
    // One deal per pipeline property (see DEAL_PIPELINE), plus the 7 child space
    // deals the two lease shells are split into (see leaseSpaceFixtures.ts).
    expect(s.listings.size).toBe(27)
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
      contactShares: new Map(),
      tasks: new Map(),
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
      dealFiles: new Map(), emails: new Map(), callLists: new Map(), contactShares: new Map(),
      tasks: new Map(),
    })
    await useDataStore.getState().reset()
    expect(useDataStore.getState().properties.size).toBe(29)
    const snap = await loadSnapshot()
    expect(snap?.properties.size).toBe(29)
  })

  it('hydrate loads a prior snapshot over the seed', async () => {
    const { saveSnapshot } = await import('./persistence')
    await saveSnapshot({
      properties: new Map([['only', { id: 'only' } as any]]),
      listings: new Map(), comps: new Map(), contacts: new Map(),
      dealFiles: new Map(), emails: new Map(), callLists: new Map(), contactShares: new Map(),
      tasks: new Map(),
    })
    await useDataStore.getState().hydrate()
    // The snapshot's property, plus Rosa's building layered back in by the
    // demo-reset pass (hydrate is snapshot + Rosa's pristine slice).
    expect(useDataStore.getState().properties.has('only')).toBe(true)
    expect(useDataStore.getState().properties.size).toBe(2)
    expect(useDataStore.getState().hydrated).toBe(true)
  })
})

describe('Rosa demo reset on hydrate', () => {
  it('a hard refresh resets Rosa and the deals on her building, keeps the rest', async () => {
    // Start from a clean seed (also persists it).
    await useDataStore.getState().reset()
    const seed = useDataStore.getState()
    const rosa = [...seed.contacts.values()].find((c) => c.heroKey === 'rosa')!
    const buildingId = rosa.ownedPropertyIds![0]
    const otherContact = [...seed.contacts.values()].find((c) => !c.heroKey)!

    // Simulate a played demo + an unrelated edit, persisted as the snapshot.
    const { saveSnapshot } = await import('./persistence')
    const contacts = new Map(seed.contacts)
    contacts.set(rosa.id, { ...rosa, relationship: 'pitching', dealStage: 'pitching' })
    contacts.set(otherContact.id, { ...otherContact, notes: 'kept edit' })
    const listings = new Map(seed.listings)
    listings.set('demo-deal', { id: 'demo-deal', propertyId: buildingId } as never)
    const tasks = new Map(seed.tasks)
    tasks.set('t-rosa', { id: 't-rosa', contactId: rosa.id } as never)
    await saveSnapshot({
      properties: seed.properties, listings, comps: seed.comps, contacts,
      dealFiles: seed.dealFiles, emails: seed.emails, callLists: seed.callLists,
      contactShares: seed.contactShares, tasks,
    })

    await useDataStore.getState().hydrate()

    const after = useDataStore.getState()
    // Rosa + her building's deals reset to seed…
    expect(after.contacts.get(rosa.id)?.relationship).toBe('nurturing')
    expect(after.listings.has('demo-deal')).toBe(false)
    expect(after.tasks.has('t-rosa')).toBe(false)
    // …while unrelated snapshot edits survive.
    expect(after.contacts.get(otherContact.id)?.notes).toBe('kept edit')
  })

  it('restores Rosa\'s signal and her building\'s occupancy gap even from a stale snapshot', async () => {
    await useDataStore.getState().reset()
    const seed = useDataStore.getState()
    const rosa = [...seed.contacts.values()].find((c) => c.heroKey === 'rosa')!
    const buildingId = rosa.ownedPropertyIds![0]
    const freshBuilding = seed.properties.get(buildingId)!
    // Sanity on the fresh seed: this is the state the reset should restore to.
    expect(rosa.signal).toBeDefined()
    expect(freshBuilding.occupancyPct).not.toBe(freshBuilding.financialRecords[0]?.occupancyPct)

    // Simulate a stale snapshot (e.g. predating the signal, or a played demo
    // that overwrote her building's numbers) where Rosa's signal is gone and
    // her building's stated/actual occupancy gap has been flattened.
    const { saveSnapshot } = await import('./persistence')
    const contacts = new Map(seed.contacts)
    contacts.set(rosa.id, { ...rosa, signal: undefined })
    const properties = new Map(seed.properties)
    properties.set(buildingId, { ...freshBuilding, occupancyPct: 50 })
    await saveSnapshot({
      properties, listings: seed.listings, comps: seed.comps, contacts,
      dealFiles: seed.dealFiles, emails: seed.emails, callLists: seed.callLists,
      contactShares: seed.contactShares, tasks: seed.tasks,
    })

    await useDataStore.getState().hydrate()

    const after = useDataStore.getState()
    expect(after.contacts.get(rosa.id)?.signal).toEqual(rosa.signal)
    expect(after.properties.get(buildingId)?.occupancyPct).toBe(freshBuilding.occupancyPct)
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
