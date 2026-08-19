import { describe, expect, it } from 'vitest'
import { buildInitialFiles } from './dealFiles'
import { classifyFile, type FileKind } from './documentGeneration'
import type { Listing } from './types'

/** A minimal listing — buildInitialFiles reads only these three fields. */
const listing = {
  id: 'deal-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  documents: undefined,
} as unknown as Listing

describe('buildInitialFiles', () => {
  it('seeds one source file for every kind the generator acts on', () => {
    const kinds = new Set<FileKind>(
      buildInitialFiles(listing)
        .filter((i) => i.kind === 'file')
        .map((i) => classifyFile(i.name)),
    )
    for (const kind of ['financials', 'rent-roll', 'market', 'comps', 'photos'] as FileKind[]) {
      expect(kinds.has(kind)).toBe(true)
    }
  })

  it('gives every seeded file a size so the picker can show one', () => {
    for (const item of buildInitialFiles(listing).filter((i) => i.kind === 'file')) {
      expect(item.sizeBytes).toBeGreaterThan(0)
    }
  })

  it('uses unique ids', () => {
    const ids = buildInitialFiles(listing).map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is deterministic', () => {
    expect(buildInitialFiles(listing)).toEqual(buildInitialFiles(listing))
  })
})
