import { describe, it, expect } from 'vitest'
import {
  SPACE_PANEL_TABS,
  SPACE_PANEL_LEAVES,
  DEFAULT_SPACE_PANEL_LEAF,
  tabForLeaf,
  leafFromPathname,
} from './spacePanelTabs'

describe('SPACE_PANEL_TABS', () => {
  it('has four tabs in design order', () => {
    expect(SPACE_PANEL_TABS.map((t) => t.id)).toEqual([
      'deal', 'terms', 'interest', 'back-office',
    ])
  })

  it('never uses the word Marketing — that ambiguity is what the panel removes', () => {
    const labels = SPACE_PANEL_TABS.flatMap((t) => [
      t.label, ...t.leaves.map((l) => l.label),
    ])
    for (const label of labels) expect(label).not.toMatch(/marketing/i)
  })

  it('exposes nine leaves, each owned by exactly one tab', () => {
    expect(SPACE_PANEL_LEAVES).toHaveLength(9)
    expect(new Set(SPACE_PANEL_LEAVES).size).toBe(9)
  })

  it('keeps leaf slugs identical to the building routes they mirror', () => {
    expect(SPACE_PANEL_LEAVES).toEqual([
      'overview', 'activities', 'history',
      'terms',
      'leads', 'media',
      'financials', 'financial-documents', 'notes',
    ])
  })

  it('opens on Deal > Details', () => {
    expect(DEFAULT_SPACE_PANEL_LEAF).toBe('overview')
    expect(tabForLeaf(DEFAULT_SPACE_PANEL_LEAF)).toBe('deal')
  })
})

describe('tabForLeaf', () => {
  it('routes each leaf to its owning tab', () => {
    expect(tabForLeaf('activities')).toBe('deal')
    expect(tabForLeaf('terms')).toBe('terms')
    expect(tabForLeaf('media')).toBe('interest')
    expect(tabForLeaf('financial-documents')).toBe('back-office')
  })
})

describe('leafFromPathname', () => {
  it('reads the active leaf off the last segment', () => {
    expect(leafFromPathname('/listings/L1/spaces/S1/financials')).toBe('financials')
    expect(leafFromPathname('/listings/L1/spaces/S1/financial-documents')).toBe(
      'financial-documents',
    )
  })

  it('tolerates a trailing slash', () => {
    expect(leafFromPathname('/listings/L1/spaces/S1/leads/')).toBe('leads')
  })

  it('returns null when the last segment is not a leaf', () => {
    expect(leafFromPathname('/listings/L1/spaces/S1')).toBeNull()
    expect(leafFromPathname('/listings/L1/website')).toBeNull()
    expect(leafFromPathname('')).toBeNull()
  })
})
