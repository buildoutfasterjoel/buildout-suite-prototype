import { describe, it, expect } from 'vitest'
import { suitePanelPath } from './suitePanelPath'
import type { Listing } from './types'

const suite = { id: 'S1', parentDealId: 'L1' } as unknown as Listing
const topLevel = { id: 'L1', parentDealId: null } as unknown as Listing

describe('suitePanelPath', () => {
  it('returns null for a deal that is not a space — nothing to rewrite', () => {
    expect(suitePanelPath(topLevel, 'website')).toBeNull()
    expect(suitePanelPath(topLevel, null)).toBeNull()
  })

  it('sends a bare suite URL to the default leaf', () => {
    expect(suitePanelPath(suite, null)).toBe('/listings/L1/spaces/S1/overview')
    expect(suitePanelPath(suite, '')).toBe('/listings/L1/spaces/S1/overview')
  })

  it('rewrites a known leaf straight through, because the slugs are unchanged', () => {
    expect(suitePanelPath(suite, 'financials')).toBe(
      '/listings/L1/spaces/S1/financials',
    )
    expect(suitePanelPath(suite, 'financial-documents')).toBe(
      '/listings/L1/spaces/S1/financial-documents',
    )
    expect(suitePanelPath(suite, 'leads')).toBe('/listings/L1/spaces/S1/leads')
  })

  it('maps the edit form to Terms — the one slug that changed', () => {
    expect(suitePanelPath(suite, 'edit')).toBe('/listings/L1/spaces/S1/terms')
  })

  it('falls back to the default leaf for a building-only surface', () => {
    // A suite has no website of its own; land on Details rather than 404.
    expect(suitePanelPath(suite, 'website')).toBe(
      '/listings/L1/spaces/S1/overview',
    )
    expect(suitePanelPath(suite, 'property-marketing')).toBe(
      '/listings/L1/spaces/S1/overview',
    )
  })
})
