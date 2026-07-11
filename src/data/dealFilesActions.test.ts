import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import {
  addDealFile,
  createDealFolder,
  getDealFiles,
  moveDealFile,
  permanentlyDeleteDealFile,
  renameDealFile,
  restoreDealFile,
  softDeleteDealFile,
} from './dealFilesActions'

describe('dealFiles', () => {
  it('lazily seeds from the listing then persists added files', () => {
    const listing = [...useDataStore.getState().listings.values()][0]
    const initial = getDealFiles(listing.id).length
    addDealFile(listing.id, { id: 'f-x', name: 'x.pdf', kind: 'file', parentId: null, createdAt: '2026-01-01T00:00:00.000Z' })
    expect(getDealFiles(listing.id).length).toBe(initial + 1)
  })

  it('round-trips softDeleteDealFile through the store', () => {
    const listing = [...useDataStore.getState().listings.values()][1]
    const items = getDealFiles(listing.id)
    const target = items.find((i) => i.kind === 'file') ?? items[0]

    softDeleteDealFile(listing.id, target.id)

    const reread = getDealFiles(listing.id)
    const found = reread.find((i) => i.id === target.id)
    expect(found?.deletedAt).toBeTruthy()
  })

  it('round-trips restoreDealFile through the store (soft-delete then restore clears deletedAt)', () => {
    const listing = [...useDataStore.getState().listings.values()][2]
    const items = getDealFiles(listing.id)
    const target = items.find((i) => i.kind === 'file') ?? items[0]

    softDeleteDealFile(listing.id, target.id)
    expect(getDealFiles(listing.id).find((i) => i.id === target.id)?.deletedAt).toBeTruthy()

    restoreDealFile(listing.id, target.id)

    const reread = getDealFiles(listing.id)
    const found = reread.find((i) => i.id === target.id)
    expect(found?.deletedAt).toBeFalsy()
  })

  it('round-trips permanentlyDeleteDealFile through the store (item is gone on reread)', () => {
    const listing = [...useDataStore.getState().listings.values()][3]
    const items = getDealFiles(listing.id)
    const target = items[0]

    softDeleteDealFile(listing.id, target.id)
    permanentlyDeleteDealFile(listing.id, target.id)

    const reread = getDealFiles(listing.id)
    expect(reread.find((i) => i.id === target.id)).toBeUndefined()
  })

  it('round-trips createDealFolder + renameDealFile + moveDealFile through the store', () => {
    const listing = [...useDataStore.getState().listings.values()][4]
    const before = getDealFiles(listing.id)

    const destinationFolder = {
      id: 'folder-round-trip-destination',
      name: 'Destination Folder',
      kind: 'folder' as const,
      parentId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    createDealFolder(listing.id, destinationFolder)

    const folder = {
      id: 'folder-round-trip',
      name: 'New Folder',
      kind: 'folder' as const,
      parentId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    createDealFolder(listing.id, folder)

    let reread = getDealFiles(listing.id)
    expect(reread.length).toBe(before.length + 2)
    expect(reread.find((i) => i.id === folder.id)?.name).toBe('New Folder')
    expect(reread.find((i) => i.id === destinationFolder.id)).toBeDefined()

    renameDealFile(listing.id, folder.id, 'Renamed Folder')
    reread = getDealFiles(listing.id)
    expect(reread.find((i) => i.id === folder.id)?.name).toBe('Renamed Folder')

    moveDealFile(listing.id, folder.id, destinationFolder.id)
    reread = getDealFiles(listing.id)
    expect(reread.find((i) => i.id === folder.id)?.parentId).toBe(destinationFolder.id)
  })
})
