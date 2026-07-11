import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { addDealFile, getDealFiles } from './dealFilesActions'

describe('dealFiles', () => {
  it('lazily seeds from the listing then persists added files', () => {
    const listing = [...useDataStore.getState().listings.values()][0]
    const initial = getDealFiles(listing.id).length
    addDealFile(listing.id, { id: 'f-x', name: 'x.pdf', kind: 'file', parentId: null, createdAt: '2026-01-01T00:00:00.000Z' })
    expect(getDealFiles(listing.id).length).toBe(initial + 1)
  })
})
