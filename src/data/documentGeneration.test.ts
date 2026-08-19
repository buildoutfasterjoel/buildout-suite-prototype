import { describe, expect, it } from 'vitest'
import { buildOutline, classifyFile, DOC_TYPES } from './documentGeneration'

describe('classifyFile', () => {
  it('recognizes financial statements', () => {
    expect(classifyFile('T-12 Operating Statement 2025.pdf')).toBe('financials')
    expect(classifyFile('t12.xlsx')).toBe('financials')
    expect(classifyFile('NOI Statement.pdf')).toBe('financials')
    expect(classifyFile('Pro Forma Cash Flow.xlsx')).toBe('financials')
  })

  it('recognizes a rent roll ahead of the generic financial match', () => {
    expect(classifyFile('Rent Roll 2026.xlsx')).toBe('rent-roll')
    expect(classifyFile('rentroll.csv')).toBe('rent-roll')
  })

  it('recognizes photos, market material, and comps', () => {
    expect(classifyFile('Site Photos.zip')).toBe('photos')
    expect(classifyFile('exterior.jpg')).toBe('photos')
    expect(classifyFile('Submarket Report.pdf')).toBe('market')
    expect(classifyFile('Demographics Report.pdf')).toBe('market')
    expect(classifyFile('Sale Comparables.xlsx')).toBe('comps')
  })

  it('recognizes legal paperwork', () => {
    expect(classifyFile('Master Lease Agreement.docx')).toBe('legal')
    expect(classifyFile('Tenant Estoppel - Suite 100.pdf')).toBe('legal')
  })

  it('falls back to other', () => {
    expect(classifyFile('Buyer Q&A Thread.pdf')).toBe('other')
    expect(classifyFile('')).toBe('other')
  })
})

describe('buildOutline base structure', () => {
  const noFiles = { docType: 'Offering Memorandum' as const, files: [], instructions: '' }

  it('produces the spine alone when no files are selected', () => {
    const keys = buildOutline(noFiles).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'contents', 'propertySummary', 'advisorBios'])
  })

  it('marks every spine section with the spine origin', () => {
    expect(buildOutline(noFiles).every((s) => s.origin === 'spine')).toBe(true)
  })

  it('builds a non-empty outline for every document type', () => {
    for (const docType of DOC_TYPES) {
      const sections = buildOutline({ docType, files: [], instructions: '' })
      expect(sections.length).toBeGreaterThan(0)
      expect(sections[0].templateKey).toBe('cover')
    }
  })

  it('inserts sourced sections between the openers and the closers', () => {
    const keys = buildOutline({
      docType: 'Offering Memorandum',
      files: [{ id: 'f1', name: 'Site Photos.zip' }],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'contents', 'propertySummary', 'photoGallery', 'advisorBios'])
  })

  it('credits each sourced section to the file that contributed it', () => {
    const sections = buildOutline({
      docType: 'Brochure',
      files: [{ id: 'f1', name: 'Rent Roll 2026.xlsx' }],
      instructions: '',
    })
    const rentRoll = sections.find((s) => s.templateKey === 'rentRollSummary')
    expect(rentRoll?.origin).toBe('file')
    expect(rentRoll?.sourceFileName).toBe('Rent Roll 2026.xlsx')
  })

  it('emits sourced sections in a fixed kind order regardless of selection order', () => {
    const forward = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'a', name: 'Site Photos.zip' },
        { id: 'b', name: 'T-12.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    const reversed = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'b', name: 'T-12.pdf' },
        { id: 'a', name: 'Site Photos.zip' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(forward).toEqual(reversed)
    expect(forward.indexOf('financialSummary')).toBeLessThan(forward.indexOf('photoGallery'))
  })

  it('contributes nothing for legal and other files', () => {
    const keys = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'a', name: 'Master Lease Agreement.docx' },
        { id: 'b', name: 'Buyer Q&A Thread.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'propertyDescription', 'advisorBios'])
  })

  it('deduplicates when two files contribute the same section', () => {
    const keys = buildOutline({
      docType: 'Brochure',
      files: [
        { id: 'a', name: 'T-12 2025.pdf' },
        { id: 'b', name: 'NOI Statement.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys.filter((k) => k === 'financialSummary')).toHaveLength(1)
  })

  it('lets the spine keep a section a file would also have contributed', () => {
    const sections = buildOutline({
      docType: "Owner's Report",
      files: [{ id: 'a', name: 'T-12 2025.pdf' }],
      instructions: '',
    })
    const summaries = sections.filter((s) => s.templateKey === 'financialSummary')
    expect(summaries).toHaveLength(1)
    expect(summaries[0].origin).toBe('spine')
  })

  it('is deterministic across repeated calls', () => {
    const input = {
      docType: 'Proposal' as const,
      files: [{ id: 'a', name: 'Rent Roll 2026.xlsx' }],
      instructions: '',
    }
    expect(buildOutline(input)).toEqual(buildOutline(input))
  })
})
