import { describe, expect, it } from 'vitest'
import { recommendDocsFromUploads } from './uploadIntelligence'
import type { DealDocument } from './types'

function doc(name: string): DealDocument {
  return { id: name, name, uploadedAt: '2026-07-24T00:00:00.000Z' }
}

describe('recommendDocsFromUploads', () => {
  it('returns nothing for no files', () => {
    expect(recommendDocsFromUploads([])).toEqual([])
  })

  it('maps a rent roll to the rent roll plus marketing deliverables, in catalog order', () => {
    expect(recommendDocsFromUploads([doc('2026 Rent Roll.xlsx')])).toEqual([
      'om',
      'bov',
      'rent-roll',
    ])
  })

  it('maps a T-12 to financials it derives plus marketing deliverables', () => {
    expect(recommendDocsFromUploads([doc('T-12 Operating Statement.pdf')])).toEqual([
      'om',
      'bov',
      't12',
      'proforma',
      'noi',
    ])
  })

  it('maps a listing agreement without adding marketing deliverables', () => {
    expect(recommendDocsFromUploads([doc('Listing Agreement.pdf')])).toEqual([
      'listing-agreement',
    ])
  })

  it('unions recommendations across multiple files with no duplicates', () => {
    const result = recommendDocsFromUploads([
      doc('Rent Roll.xlsx'),
      doc('Signed Listing Agreement.pdf'),
    ])
    expect(result).toEqual(['om', 'bov', 'rent-roll', 'listing-agreement'])
  })
})
