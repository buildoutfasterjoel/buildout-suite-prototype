import { useDataStore } from './dataStore'
import { buildInitialFiles } from './dealFiles'
import type { DealFileItem } from './types'

export function getDealFiles(dealId: string): DealFileItem[] {
  const { dealFiles, listings } = useDataStore.getState()
  if (dealFiles.has(dealId)) return dealFiles.get(dealId)!
  const listing = listings.get(dealId)
  const seeded = listing ? buildInitialFiles(listing) : []
  useDataStore.setState((s) => {
    const next = new Map(s.dealFiles)
    next.set(dealId, seeded)
    return { dealFiles: next }
  })
  return seeded
}

function write(dealId: string, mut: (items: DealFileItem[]) => DealFileItem[]): void {
  const current = getDealFiles(dealId)
  useDataStore.setState((s) => {
    const next = new Map(s.dealFiles)
    next.set(dealId, mut(current))
    return { dealFiles: next }
  })
  useDataStore.getState().persist()
}

export function addDealFile(dealId: string, item: DealFileItem): void {
  write(dealId, (items) => [...items, item])
}

export function softDeleteDealFile(dealId: string, fileId: string): void {
  write(dealId, (items) =>
    items.map((i) => (i.id === fileId ? { ...i, deletedAt: new Date().toISOString() } : i)),
  )
}

export function createDealFolder(dealId: string, folder: DealFileItem): void {
  write(dealId, (items) => [...items, folder])
}

export function renameDealFile(dealId: string, fileId: string, name: string): void {
  write(dealId, (items) => items.map((i) => (i.id === fileId ? { ...i, name } : i)))
}

export function moveDealFile(dealId: string, fileId: string, newParentId: string | null): void {
  write(dealId, (items) =>
    items.map((i) => (i.id === fileId ? { ...i, parentId: newParentId } : i)),
  )
}

export function restoreDealFile(dealId: string, fileId: string): void {
  write(dealId, (items) =>
    items.map((i) => (i.id === fileId ? { ...i, deletedAt: null } : i)),
  )
}

export function permanentlyDeleteDealFile(dealId: string, fileId: string): void {
  write(dealId, (items) => items.filter((i) => i.id !== fileId))
}
