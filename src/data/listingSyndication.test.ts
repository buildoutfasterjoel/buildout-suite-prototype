import { describe, it, expect } from 'vitest'
import {
  getListingSyndication,
  SYNDICATION_NETWORK_NAMES,
  type SyndicationListing,
} from './listingSyndication'

/** A listing whose id survives the "no channels configured" branch (hash % 6 !== 0). */
function listingFor(id: string, publishedAt: string | null = '2026-07-20T15:00:00.000Z'): SyndicationListing {
  return { id, slug: 'oak-street-plaza', publishedAt, dealType: 'Sale' }
}

/** Ids that produce a populated roster — the generator returns [] for hash % 6 === 0. */
function populatedListings(): SyndicationListing[] {
  const found: SyndicationListing[] = []
  for (let i = 0; i < 60; i++) {
    const l = listingFor(`listing-${i}`)
    if (getListingSyndication(l).channels.length > 0) found.push(l)
  }
  return found
}

describe('roster', () => {
  it('exposes every channel name for the traffic-source pool', () => {
    expect(SYNDICATION_NETWORK_NAMES).toContain('CoStar')
    expect(SYNDICATION_NETWORK_NAMES).toContain('CommercialEdge Network')
    expect(SYNDICATION_NETWORK_NAMES).toHaveLength(8)
  })

  it('produces both delivery methods for a populated listing', () => {
    const { channels } = getListingSyndication(populatedListings()[0])
    expect(channels.filter((c) => c.delivery === 'direct')).toHaveLength(4)
    expect(channels.filter((c) => c.delivery === 'email')).toHaveLength(4)
  })
})

describe('determinism', () => {
  it('returns identical data for the same listing id', () => {
    const l = listingFor('stable-id')
    expect(getListingSyndication(l)).toEqual(getListingSyndication(l))
  })
})

describe('invariants', () => {
  it('never dates a channel before the listing went live', () => {
    const publishedAt = '2026-07-20T15:00:00.000Z'
    const anchor = new Date(publishedAt).getTime()
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.publishedAt) expect(new Date(c.publishedAt).getTime()).toBeGreaterThanOrEqual(anchor)
        if (c.lastUpdatedAt) expect(new Date(c.lastUpdatedAt).getTime()).toBeGreaterThanOrEqual(anchor)
      }
    }
  })

  it('reports no channel dates when the listing was never published', () => {
    for (let i = 0; i < 60; i++) {
      const { channels } = getListingSyndication(listingFor(`unpublished-${i}`, null))
      for (const c of channels) {
        expect(c.publishedAt).toBeNull()
        expect(c.lastUpdatedAt).toBeNull()
        expect(c.expiresInDays).toBeNull()
      }
    }
  })

  it('never gives an email channel a connection-health state', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'email') {
          expect(['update-sent', 'send-pending', 'off']).toContain(c.state)
        }
      }
    }
  })

  it('never gives an email channel an expiration or admin console', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'email') {
          expect(c.expiresInDays).toBeNull()
          expect(c.adminUrl).toBeNull()
        }
      }
    }
  })

  it('never marks an unavailable channel active', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.state === 'not-available') expect(c.active).toBe(false)
      }
    }
  })

  it('only ever uses off or not-available for an inactive channel', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (!c.active) expect(['off', 'not-available']).toContain(c.state)
      }
    }
  })

  it('builds admin URLs on a Buildout host, scoped to the listing slug', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.adminUrl) {
          expect(c.adminUrl).toBe(`https://admin.buildout.com/syndication/${c.id}/${l.slug}`)
        }
      }
    }
  })

  it('covers every direct state across the id space', () => {
    const seen = new Set<string>()
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'direct') seen.add(c.state)
      }
    }
    for (const state of ['updated', 'pending', 'needs-attention', 'off', 'not-available']) {
      expect(seen).toContain(state)
    }
  })
})
