import { describe, expect, it } from 'vitest'
import { TEMPLATES, buildTemplatePage, buildBlankPage } from './templates'
import { BRAND } from './brand'
import type { ImageBlock, SectionBlock } from './types'
import { PAGE_HEIGHT, PAGE_WIDTH } from './types'

describe('TEMPLATES registry', () => {
  it('exposes at least 7 templates, each with unique key + metadata', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(7)
    const keys = TEMPLATES.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const t of TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0)
      expect(t.description.length).toBeGreaterThan(0)
      expect(t.category).toBeTruthy()
    }
  })

  it('builds every template without throwing and produces blocks', () => {
    for (const t of TEMPLATES) {
      const page = buildTemplatePage(t.key)
      expect(page.name.length).toBeGreaterThan(0)
      expect(Array.isArray(page.blocks)).toBe(true)
    }
  })

  it('covers the expected categories', () => {
    const cats = new Set(TEMPLATES.map((t) => t.category))
    for (const c of ['Cover', 'Financials', 'Property', 'Location', 'Comparables', 'Team']) {
      expect(cats.has(c as never)).toBe(true)
    }
  })

  it('styles headings with the brand heading font', () => {
    const page = buildTemplatePage('financialHero')
    const heading = page.blocks.find((b) => b.type === 'heading') as { style: { fontFamily: string } }
    expect(heading.style.fontFamily).toBe(BRAND.fonts.heading)
  })

  // The cover deliberately opts out of the header/footer chrome and margin
  // every other page carries: its hero and title band have to reach the paper's
  // edge, matching the BOV preview shown before sending.
  it('builds the cover as a full-bleed hero over a navy title band', () => {
    const cover = buildTemplatePage('cover')
    expect(cover.bleed).toBe(true)
    expect(cover.chrome).toBe('none')
    expect(cover.logoSrc).toBeUndefined()
    expect(cover.blocks[0].type).toBe('image')

    const band = cover.blocks[1] as SectionBlock
    expect(band.type).toBe('section')
    expect(band.background).toBe('#1d3a5f')
    expect(band.blocks.some((b) => b.type === 'heading')).toBe(true)
  })

  // The hero is sized so the band lands flush on the bottom edge — a hero that
  // drifts from the page height leaves a white strip under the cover.
  it('sizes the cover hero to leave exactly the band below it', () => {
    const cover = buildTemplatePage('cover')
    const hero = cover.blocks[0] as ImageBlock
    expect(hero.src).toContain(`w=${PAGE_WIDTH}`)
    expect(hero.src).toContain(`h=${PAGE_HEIGHT - 203}`)
  })
})

describe('buildBlankPage', () => {
  it('is freeform (not locked) but carries the brand logo', () => {
    const page = buildBlankPage()
    expect(page.locked ?? false).toBe(false)
    expect(page.logoSrc).toBe(BRAND.logoSrc)
  })

  // The header and footer are page chrome, not blocks — so a blank page starts
  // with an empty body and still reads as the company's.
  it('starts with no blocks and takes the default base chrome', () => {
    const page = buildBlankPage()
    expect(page.blocks).toEqual([])
    expect(page.chrome ?? 'base').toBe('base')
  })
})
