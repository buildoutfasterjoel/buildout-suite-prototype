import { describe, expect, it } from 'vitest'
import { contentsEntries, contentsIndexLabel } from './contents'
import { buildTemplatePage } from './templates'
import { buildDocumentPages } from './presets'
import { uid } from './blocks/blockFactory'
import type { ColumnsBlock, ContentsBlock, Page } from './types'

/** A minimal listable page — a name is all the contents derivation reads. */
function page(name: string, extra: Partial<Page> = {}): Page {
  return { id: uid('page'), name, blocks: [], ...extra }
}

describe('contentsEntries', () => {
  it('numbers every listable page in document order', () => {
    const entries = contentsEntries([page('Property'), page('Location'), page('Financials')])
    expect(entries.map((e) => [e.index, e.label])).toEqual([
      [1, 'Property'],
      [2, 'Location'],
      [3, 'Financials'],
    ])
  })

  // Hidden pages don't print, so listing them would send a reader to a page
  // that isn't in the document they received.
  it('skips hidden pages and closes the gap in the numbering', () => {
    const entries = contentsEntries([
      page('Property'),
      page('Draft Notes', { hidden: true }),
      page('Financials'),
    ])
    expect(entries.map((e) => e.label)).toEqual(['Property', 'Financials'])
    expect(entries.map((e) => e.index)).toEqual([1, 2])
  })

  it('skips front matter flagged omitFromContents', () => {
    const entries = contentsEntries([
      page('Cover Page', { omitFromContents: true }),
      page('Property'),
    ])
    expect(entries.map((e) => e.label)).toEqual(['Property'])
  })

  // The contents page finds itself by its own block rather than by a flag, so a
  // contents block dropped on any page excludes that page.
  it('skips the page carrying the contents block, nested or not', () => {
    const contents: ContentsBlock = buildTemplatePage('contents')
      .blocks.filter((b): b is ColumnsBlock => b.type === 'columns')
      .flatMap((c) => c.columns.flat())
      .find((b): b is ContentsBlock => b.type === 'contents')!
    const nested = buildTemplatePage('contents')
    const topLevel = page('Contents (top level)', { blocks: [contents] })

    const entries = contentsEntries([nested, topLevel, page('Property')])
    expect(entries.map((e) => e.label)).toEqual(['Property'])
  })

  it('returns nothing when the document has no listable pages', () => {
    expect(contentsEntries([page('Cover', { omitFromContents: true })])).toEqual([])
  })
})

describe('contentsIndexLabel', () => {
  it('zero-pads single digits and leaves the rest alone', () => {
    expect(contentsIndexLabel(1)).toBe('01')
    expect(contentsIndexLabel(9)).toBe('09')
    expect(contentsIndexLabel(12)).toBe('12')
  })
})

describe('Table of Contents template', () => {
  it('splits the page: generated contents left, editable opening right', () => {
    const toc = buildTemplatePage('contents')
    expect(toc.name).toBe('Table of Contents')
    expect(toc.blocks[0]).toMatchObject({ type: 'heading', text: 'Table of Contents' })

    const body = toc.blocks[1] as ColumnsBlock
    expect(body.type).toBe('columns')
    expect(body.columnCount).toBe(2)
    expect(body.columns[0].map((b) => b.type)).toEqual(['contents'])
    expect(body.columns[1].map((b) => b.type)).toEqual(['heading', 'text'])
  })

  // The contents block stores no entries — it derives them — so a stale copy
  // can never ship inside the document.
  it('stores no entry text of its own', () => {
    const body = buildTemplatePage('contents').blocks[1] as ColumnsBlock
    expect(Object.keys(body.columns[0][0]).sort()).toEqual(['id', 'style', 'type'])
  })
})

describe('the seeded proposal document', () => {
  it('leads with a cover and a real contents page, and lists the sections', () => {
    const pages = buildDocumentPages(undefined)
    expect(pages[0].name).toBe('Cover Page')
    expect(pages[1].name).toBe('Table of Contents')

    const entries = contentsEntries(pages)
    expect(entries.map((e) => e.label)).not.toContain('Cover Page')
    expect(entries.map((e) => e.label)).not.toContain('Table of Contents')
    // Every remaining page is a section, numbered from one.
    expect(entries).toHaveLength(pages.length - 2)
    expect(entries[0]).toMatchObject({ index: 1, label: pages[2].name })
  })
})
