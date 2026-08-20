import { describe, expect, it } from 'vitest'
import { buildPropertyDescriptionPage } from './templates/designer'
import { buildTemplatePage } from './templates'
import { buildDocumentPages } from './presets'
import { pageHasDynamicContent } from './tree'
import type { ColumnsBlock, ImageBlock, TextBlock } from './types'
import { PAGE_PADDING, PAGE_WIDTH } from './types'

function body(): ColumnsBlock {
  const page = buildPropertyDescriptionPage()
  const columns = page.blocks.find((b) => b.type === 'columns')
  if (!columns || columns.type !== 'columns') throw new Error('no columns block')
  return columns
}

describe('buildPropertyDescriptionPage', () => {
  it('titles the page and identifies the property under it', () => {
    const page = buildPropertyDescriptionPage()
    expect(page.name).toBe('Property Description')
    expect(page.blocks[0]).toMatchObject({ type: 'heading', text: 'Property Description' })
    expect(page.blocks[1].type).toBe('text')
    expect(page.locked).toBe(true)
  })

  it('splits the body: one image column, one copy column', () => {
    const columns = body()
    expect(columns.columnCount).toBe(2)
    expect(columns.columns[0].map((b) => b.type)).toEqual(['image'])
    expect(columns.columns[1].map((b) => b.type)).toEqual(['text', 'text'])
  })

  // The photo is requested at exactly half the content column so it lands in
  // its column at native size — asking for the full width would render it
  // downscaled and soft.
  it('requests the photo at column width and portrait height', () => {
    const image = body().columns[0][0] as ImageBlock
    const half = (PAGE_WIDTH - PAGE_PADDING * 2 - 16) / 2
    expect(image.src).toContain(`w=${half}`)
    expect(image.src).toContain('h=640')
  })

  // Typed copy would fork from the listing the moment either side changed.
  it('binds both the title and the description to the deal’s marketing copy', () => {
    const [title, description] = body().columns[1] as TextBlock[]
    expect(title.text).toBe('{{marketing.saleTitle}}')
    expect(description.text).toBe('{{marketing.saleDescription}}')
    expect(description.style.lineHeight).toBeGreaterThan(description.style.fontSize)
  })

  it('reads as a page with live data, so the Pages panel flags it', () => {
    expect(pageHasDynamicContent(buildPropertyDescriptionPage())).toBe(true)
  })

  it('is offered in the template gallery under Property', () => {
    const page = buildTemplatePage('propertyDescription')
    expect(page.name).toBe('Property Description')
  })

  it('replaces the stub page of the same name in the seeded proposal', () => {
    const pages = buildDocumentPages(undefined)
    const description = pages.filter((p) => p.name === 'Property Description')
    expect(description).toHaveLength(1)
    expect(description[0].blocks.some((b) => b.type === 'columns')).toBe(true)
  })
})
