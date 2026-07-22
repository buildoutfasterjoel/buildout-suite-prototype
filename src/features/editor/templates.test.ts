import { describe, expect, it } from 'vitest'
import { TEMPLATES, buildTemplatePage } from './presets'
import { BRAND } from './brand'

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
    const cover = buildTemplatePage('cover')
    const heading = cover.blocks.find((b) => b.type === 'heading') as { style: { fontFamily: string } }
    expect(heading.style.fontFamily).toBe(BRAND.fonts.heading)
  })
})
