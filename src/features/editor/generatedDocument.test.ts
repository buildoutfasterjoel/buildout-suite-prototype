import { describe, expect, it } from 'vitest'
import { EMITTABLE_TEMPLATE_KEYS, SECTION_NAME } from '#/data/documentGeneration'
import { TEMPLATES } from './templates'
import { buildGeneratedDocumentPages } from './presets'
import { buildGeneratedDocument } from './sampleDocument'
import type { DocumentGeneration, GeneratedSection } from '#/data/types'

const SECTIONS: GeneratedSection[] = [
  { templateKey: 'cover', name: 'Cover Page', origin: 'spine' },
  { templateKey: 'contents', name: 'Table of Contents', origin: 'spine' },
  {
    templateKey: 'rentRollSummary',
    name: 'Rent Roll Summary',
    origin: 'file',
    sourceFileName: 'Rent Roll 2026.xlsx',
  },
  { templateKey: 'advisorBios', name: 'Advisor Bios', origin: 'spine' },
]

describe('templateKey contract', () => {
  // The generator lives in src/data and must not import the editor, so these
  // two assertions are the only thing keeping that coupling honest.
  it('resolves every key documentGeneration can emit', () => {
    const registered = new Set(TEMPLATES.map((t) => t.key))
    for (const key of EMITTABLE_TEMPLATE_KEYS) {
      expect(registered.has(key), `${key} is not a registered template`).toBe(true)
    }
  })

  it('names every key documentGeneration can emit', () => {
    for (const key of EMITTABLE_TEMPLATE_KEYS) {
      expect(SECTION_NAME[key], `${key} has no display name`).toBeTruthy()
    }
  })
})

describe('buildGeneratedDocumentPages', () => {
  it('builds one page per section, in order', () => {
    const pages = buildGeneratedDocumentPages(undefined, SECTIONS)
    expect(pages).toHaveLength(SECTIONS.length)
    expect(pages.map((p) => p.name)).toEqual([
      'Cover Page',
      'Table of Contents',
      'Rent Roll Summary',
      'Advisor Bios',
    ])
  })

  it('gives every page a unique id and some blocks', () => {
    const pages = buildGeneratedDocumentPages(undefined, SECTIONS)
    expect(new Set(pages.map((p) => p.id)).size).toBe(pages.length)
    for (const page of pages) expect(page.blocks.length).toBeGreaterThan(0)
  })

  it('returns an empty list for an empty outline', () => {
    expect(buildGeneratedDocumentPages(undefined, [])).toEqual([])
  })

  it('skips a section whose template no longer exists rather than throwing', () => {
    const pages = buildGeneratedDocumentPages(undefined, [
      { templateKey: 'cover', name: 'Cover Page', origin: 'spine' },
      { templateKey: 'no-such-template', name: 'Gone', origin: 'spine' },
    ])
    expect(pages.map((p) => p.name)).toEqual(['Cover Page'])
  })
})

describe('buildGeneratedDocument', () => {
  const generation: DocumentGeneration = {
    templateName: 'Offering Memorandum',
    sourceFileIds: ['f1'],
    sourceFileNames: ['Rent Roll 2026.xlsx'],
    instructions: '',
    sections: SECTIONS,
    generatedAt: '2026-08-19T00:00:00.000Z',
  }

  it('names the document and builds its outline', () => {
    const doc = buildGeneratedDocument(undefined, 'OM — 1650 Market St', generation)
    expect(doc.name).toBe('OM — 1650 Market St')
    expect(doc.pages.map((p) => p.name)).toEqual([
      'Cover Page',
      'Table of Contents',
      'Rent Roll Summary',
      'Advisor Bios',
    ])
  })
})
