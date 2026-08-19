import { describe, expect, it } from 'vitest'
import {
  buildOutline,
  classifyFile,
  MAX_CONCISE_SECTIONS,
  suggestionsFor,
  suggestTemplates,
  TEMPLATE_NAMES,
} from './documentGeneration'

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
  const noFiles = { templateName: 'Offering Memorandum' as const, files: [], instructions: '' }

  it('produces the spine alone when no files are selected', () => {
    const keys = buildOutline(noFiles).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'contents', 'propertySummary', 'advisorBios'])
  })

  it('marks every spine section with the spine origin', () => {
    expect(buildOutline(noFiles).every((s) => s.origin === 'spine')).toBe(true)
  })

  it('builds a non-empty outline for every document type', () => {
    for (const templateName of TEMPLATE_NAMES) {
      const sections = buildOutline({ templateName, files: [], instructions: '' })
      expect(sections.length).toBeGreaterThan(0)
      expect(sections[0].templateKey).toBe('cover')
    }
  })

  it('inserts sourced sections between the openers and the closers', () => {
    const keys = buildOutline({
      templateName: 'Offering Memorandum',
      files: [{ id: 'f1', name: 'Site Photos.zip' }],
      instructions: '',
    }).map((s) => s.templateKey)
    expect(keys).toEqual(['cover', 'contents', 'propertySummary', 'photoGallery', 'advisorBios'])
  })

  it('credits each sourced section to the file that contributed it', () => {
    const sections = buildOutline({
      templateName: 'Brochure',
      files: [{ id: 'f1', name: 'Rent Roll 2026.xlsx' }],
      instructions: '',
    })
    const rentRoll = sections.find((s) => s.templateKey === 'rentRollSummary')
    expect(rentRoll?.origin).toBe('file')
    expect(rentRoll?.sourceFileName).toBe('Rent Roll 2026.xlsx')
  })

  it('emits sourced sections in a fixed kind order regardless of selection order', () => {
    const forward = buildOutline({
      templateName: 'Brochure',
      files: [
        { id: 'a', name: 'Site Photos.zip' },
        { id: 'b', name: 'T-12.pdf' },
      ],
      instructions: '',
    }).map((s) => s.templateKey)
    const reversed = buildOutline({
      templateName: 'Brochure',
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
      templateName: 'Brochure',
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
      templateName: 'Brochure',
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
      templateName: "Owner's Report",
      files: [{ id: 'a', name: 'T-12 2025.pdf' }],
      instructions: '',
    })
    const summaries = sections.filter((s) => s.templateKey === 'financialSummary')
    expect(summaries).toHaveLength(1)
    expect(summaries[0].origin).toBe('spine')
  })

  it('is deterministic across repeated calls', () => {
    const input = {
      templateName: 'Proposal' as const,
      files: [{ id: 'a', name: 'Rent Roll 2026.xlsx' }],
      instructions: '',
    }
    expect(buildOutline(input)).toEqual(buildOutline(input))
  })
})

const ALL_KINDS = [
  { id: 'f1', name: 'T-12 2025.pdf' },
  { id: 'f2', name: 'Rent Roll 2026.xlsx' },
  { id: 'f3', name: 'Submarket Report.pdf' },
  { id: 'f4', name: 'Sale Comparables.xlsx' },
  { id: 'f5', name: 'Site Photos.zip' },
]

describe('instruction effects', () => {
  it('moves financial highlights directly after the cover', () => {
    const keys = buildOutline({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Lead with the trailing-12 NOI growth.',
    }).map((s) => s.templateKey)
    expect(keys[0]).toBe('cover')
    expect(keys[1]).toBe('financialHero')
  })

  it('adds financial highlights when no financial file was selected', () => {
    const sections = buildOutline({
      templateName: 'Brochure',
      files: [],
      instructions: 'Lead with the trailing-12 NOI growth.',
    })
    const hero = sections.find((s) => s.templateKey === 'financialHero')
    expect(hero?.origin).toBe('instruction')
    expect(hero?.instructionLabel).toBeTruthy()
  })

  it('adds the rent roll summary on request', () => {
    const sections = buildOutline({
      templateName: 'Brochure',
      files: [],
      instructions: 'Summarize the tenant roster.',
    })
    const rentRoll = sections.find((s) => s.templateKey === 'rentRollSummary')
    expect(rentRoll?.origin).toBe('instruction')
  })

  it('adds the location page on request', () => {
    const keys = buildOutline({
      templateName: 'Flyer',
      files: [],
      instructions: 'Emphasize the location and surrounding submarket.',
    }).map((s) => s.templateKey)
    expect(keys).toContain('locationMap')
  })

  it('removes the comparables on request', () => {
    const keys = buildOutline({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Skip the sale comparables.',
    }).map((s) => s.templateKey)
    expect(keys).not.toContain('comparables')
  })

  it('recognizes a hand-typed phrase, not just the canonical sentence', () => {
    const keys = buildOutline({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'no comps please, and keep it short',
    }).map((s) => s.templateKey)
    expect(keys).not.toContain('comparables')
    expect(keys.length).toBeLessThanOrEqual(MAX_CONCISE_SECTIONS)
  })

  it('caps a concise outline and trims only sourced sections', () => {
    const sections = buildOutline({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Keep it concise.',
    })
    expect(sections.length).toBe(MAX_CONCISE_SECTIONS)
    const keys = sections.map((s) => s.templateKey)
    // Openers and the closer survive the trim.
    expect(keys.slice(0, 3)).toEqual(['cover', 'contents', 'propertySummary'])
    expect(keys).toContain('advisorBios')
  })

  it('ignores unrecognized instructions without changing the outline', () => {
    const base = buildOutline({ templateName: 'Proposal', files: ALL_KINDS, instructions: '' })
    const withText = buildOutline({
      templateName: 'Proposal',
      files: ALL_KINDS,
      instructions: 'Make it feel premium and mention the roof deck.',
    })
    expect(withText).toEqual(base)
  })

  it('does not depend on the order phrases appear in the text', () => {
    const a = buildOutline({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Keep it concise. Skip the sale comparables.',
    })
    const b = buildOutline({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Skip the sale comparables. Keep it concise.',
    })
    expect(a).toEqual(b)
  })

  it('never emits a duplicate section key', () => {
    const keys = buildOutline({
      templateName: "Owner's Report",
      files: ALL_KINDS,
      instructions: 'Lead with the trailing-12 NOI growth. Summarize the tenant roster.',
    }).map((s) => s.templateKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never breaches the concise cap, even when a phrase adds a section', () => {
    // 'lead with NOI' must ensure financialHero exists; if that ensure happened
    // after the cap it would push every document to MAX_CONCISE_SECTIONS + 1.
    for (const templateName of TEMPLATE_NAMES) {
      const sections = buildOutline({
        templateName,
        files: ALL_KINDS.filter((f) => !/t-?12/i.test(f.name)),
        instructions: 'Keep it concise. Lead with the trailing-12 NOI growth.',
      })
      expect(sections.length, `${templateName} breached the cap`).toBeLessThanOrEqual(
        MAX_CONCISE_SECTIONS,
      )
      expect(sections.map((s) => s.templateKey)).toContain('financialHero')
    }
  })
})

describe('suggestionsFor', () => {
  it('offers the NOI card only when a financial file is selected', () => {
    const withFin = suggestionsFor({
      templateName: 'Brochure',
      files: [{ id: 'a', name: 'T-12 2025.pdf' }],
      instructions: '',
    })
    expect(withFin.some((c) => c.id === 'lead-with-noi')).toBe(true)

    const without = suggestionsFor({
      templateName: 'Brochure',
      files: [{ id: 'a', name: 'Buyer Q&A Thread.pdf' }],
      instructions: '',
    })
    expect(without.some((c) => c.id === 'lead-with-noi')).toBe(false)
  })

  it('offers the roster card only when the outline lacks a rent roll page', () => {
    // No rent-roll file: the card is the only way to get that page.
    expect(
      suggestionsFor({ templateName: 'Brochure', files: [], instructions: '' }).some(
        (c) => c.id === 'tenant-roster',
      ),
    ).toBe(true)
    // Rent-roll file selected: the page is already there, so the card would be a no-op.
    expect(
      suggestionsFor({
        templateName: 'Brochure',
        files: [{ id: 'a', name: 'Rent Roll 2026.xlsx' }],
        instructions: '',
      }).some((c) => c.id === 'tenant-roster'),
    ).toBe(false)
  })

  it('offers the location card only when the outline lacks a location page', () => {
    expect(
      suggestionsFor({ templateName: 'Flyer', files: [], instructions: '' }).some(
        (c) => c.id === 'emphasize-location',
      ),
    ).toBe(true)
    expect(
      suggestionsFor({
        templateName: 'Flyer',
        files: [{ id: 'a', name: 'Submarket Report.pdf' }],
        instructions: '',
      }).some((c) => c.id === 'emphasize-location'),
    ).toBe(false)
  })

  it('keeps offering a card whose effect has already been applied', () => {
    // Judged against the base outline, so "skip comps" does not vanish the
    // moment it is added — otherwise the selected card would disappear.
    const cards = suggestionsFor({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: 'Skip the sale comparables.',
    })
    expect(cards.some((c) => c.id === 'skip-comps')).toBe(true)
  })

  it('gives every card a sentence and a stated effect', () => {
    for (const card of suggestionsFor({
      templateName: 'Offering Memorandum',
      files: ALL_KINDS,
      instructions: '',
    })) {
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.sentence.length).toBeGreaterThan(0)
      expect(card.effect.length).toBeGreaterThan(0)
    }
  })

  it('never offers a card that would not change the outline, for any input', () => {
    for (const templateName of TEMPLATE_NAMES) {
      // Every subset of the five file kinds.
      for (let mask = 0; mask < 1 << ALL_KINDS.length; mask++) {
        const files = ALL_KINDS.filter((_, i) => mask & (1 << i))
        const input = { templateName, files, instructions: '' }
        const base = buildOutline(input)
        const cards = suggestionsFor(input)
        expect(cards.length).toBeLessThanOrEqual(4)
        for (const card of cards) {
          const applied = buildOutline({ ...input, instructions: card.sentence })
          expect(applied, `${card.id} on ${templateName} changed nothing`).not.toEqual(base)
        }
      }
    }
  })
})

describe('suggestTemplates', () => {
  const file = (name: string) => ({ id: name, name })

  it('suggests an Offering Memorandum for financial paperwork', () => {
    const [best] = suggestTemplates([file('T-12 2025.pdf'), file('Rent Roll 2026.xlsx')])
    expect(best.name).toBe('Offering Memorandum')
    expect(best.bestFit).toBe(true)
  })

  it('suggests a Brochure when the deal only has photography', () => {
    const [best] = suggestTemplates([file('Site Photos.zip')])
    expect(best.name).toBe('Brochure')
  })

  it('names the selected files each suggestion actually uses', () => {
    const [best] = suggestTemplates([
      file('T-12 2025.pdf'),
      file('Master Lease Agreement.docx'),
    ])
    // The lease contributes nothing, so no suggestion should claim it.
    expect(best.usesFileNames).toEqual(['T-12 2025.pdf'])
  })

  it('marks exactly one suggestion as the best fit', () => {
    const suggestions = suggestTemplates(ALL_KINDS)
    expect(suggestions.filter((s) => s.bestFit)).toHaveLength(1)
    expect(suggestions[0].bestFit).toBe(true)
  })

  it('offers alternatives beside the best fit, without repeating one', () => {
    const suggestions = suggestTemplates(ALL_KINDS)
    expect(suggestions.length).toBeGreaterThan(1)
    expect(new Set(suggestions.map((s) => s.name)).size).toBe(suggestions.length)
  })

  it('suggests nothing until a file is selected', () => {
    // A suggestion with no files behind it is a guess dressed as a reading of
    // the deal. The deck stays empty until there is something to read.
    expect(suggestTemplates([])).toEqual([])
  })

  it('is deterministic and order-independent across the selection', () => {
    const forward = suggestTemplates([file('T-12 2025.pdf'), file('Site Photos.zip')])
    const reversed = suggestTemplates([file('Site Photos.zip'), file('T-12 2025.pdf')])
    expect(forward).toEqual(reversed)
  })

  it('only ever suggests a template the outline builder can shape', () => {
    for (const suggestion of suggestTemplates(ALL_KINDS)) {
      expect(TEMPLATE_NAMES).toContain(suggestion.name)
      expect(buildOutline({ templateName: suggestion.name, files: ALL_KINDS, instructions: '' }).length)
        .toBeGreaterThan(0)
    }
  })
})
