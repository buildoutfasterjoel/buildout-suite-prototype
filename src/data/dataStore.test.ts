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
