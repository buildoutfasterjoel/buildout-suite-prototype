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
