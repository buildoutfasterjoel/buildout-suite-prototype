import { describe, it, expect } from 'vitest'
import { suitePanelPath, legacySubPath } from './suitePanelPath'
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

describe('legacySubPath', () => {
  it('returns null for a bare listing URL', () => {
    expect(legacySubPath('/listings/L1', 'L1')).toBeNull()
  })

  it('treats a trailing slash on a bare URL as bare', () => {
    expect(legacySubPath('/listings/L1/', 'L1')).toBeNull()
  })

  it('extracts a single sub-segment', () => {
    expect(legacySubPath('/listings/L1/financials', 'L1')).toBe('financials')
    expect(legacySubPath('/listings/L1/financial-documents', 'L1')).toBe('financial-documents')
  })

  it('strips a trailing slash from a sub-segment', () => {
    expect(legacySubPath('/listings/L1/leads/', 'L1')).toBe('leads')
  })

  it('keeps a deeper path intact rather than truncating it', () => {
    expect(legacySubPath('/listings/L1/spaces/S1/overview', 'L1')).toBe('spaces/S1/overview')
  })

  it('returns null when the listing id is not in the path', () => {
    expect(legacySubPath('/contacts/C1', 'L1')).toBeNull()
  })
})
