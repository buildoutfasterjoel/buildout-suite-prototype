import { describe, expect, it } from 'vitest'
import { createGeneratedDocument, resolveGeneratedDocument } from './actions'
import { useDataStore } from './dataStore'
import type { GeneratedSection } from './types'

const SECTIONS: GeneratedSection[] = [
  { templateKey: 'cover', name: 'Cover Page', origin: 'spine' },
  {
    templateKey: 'financialSummary',
    name: 'Financial Summary',
    origin: 'file',
    sourceFileName: 'T-12 2025.pdf',
  },
]

/** The store is seeded in the test environment; this is the idiom the other action tests use. */
function anyDealId(): string {
  return [...useDataStore.getState().listings.values()][0].id
}

const input = {
  name: 'Offering Memorandum — Test',
  docType: 'Offering Memorandum',
  sourceFileIds: ['f1'],
  sourceFileNames: ['T-12 2025.pdf'],
  instructions: 'Lead with the trailing-12 NOI growth.',
  sections: SECTIONS,
}

describe('createGeneratedDocument', () => {
  it('appends an aiGenerated document carrying its generation', () => {
    const dealId = anyDealId()
    const before = useDataStore.getState().listings.get(dealId)?.documents?.length ?? 0

    const { documentId } = createGeneratedDocument(dealId, input)
    expect(documentId).toBeTruthy()

    const deal = useDataStore.getState().listings.get(dealId)
    expect(deal?.documents?.length).toBe(before + 1)

    const doc = deal?.documents?.find((d) => d.id === documentId)
    expect(doc?.name).toBe(input.name)
    expect(doc?.aiGenerated).toBe(true)
    expect(doc?.generation?.sections).toEqual(SECTIONS)
    expect(doc?.generation?.instructions).toBe(input.instructions)
    expect(doc?.generation?.generatedAt).toBeTruthy()
  })

  it('returns a null id for an unknown deal and writes nothing', () => {
    expect(createGeneratedDocument('no-such-deal', input).documentId).toBeNull()
  })

  it('mints a collision-resistant id rather than a per-session sequence', () => {
    const dealId = anyDealId()
    const a = createGeneratedDocument(dealId, input).documentId
    const b = createGeneratedDocument(dealId, input).documentId
    expect(a).not.toBe(b)
    // A UUID, not a counter: an in-memory sequence resets to 0 on page reload
    // while documents persist in IndexedDB, so a second session would remint an
    // existing id and resolveGeneratedDocument would return the stale document.
    for (const id of [a, b]) {
      expect(id).toMatch(
        /^gendoc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }
  })
})

describe('resolveGeneratedDocument', () => {
  it('finds the generation for a document id', () => {
    const dealId = anyDealId()
    const { documentId } = createGeneratedDocument(dealId, input)
    const deal = useDataStore.getState().listings.get(dealId)
    expect(resolveGeneratedDocument(deal, documentId ?? undefined)?.docType).toBe(
      'Offering Memorandum',
    )
  })

  it('returns undefined for a missing id, a missing deal, or a plain document', () => {
    const deal = useDataStore.getState().listings.get(anyDealId())
    expect(resolveGeneratedDocument(deal, undefined)).toBeUndefined()
    expect(resolveGeneratedDocument(deal, 'no-such-doc')).toBeUndefined()
    expect(resolveGeneratedDocument(undefined, 'anything')).toBeUndefined()
  })
})
