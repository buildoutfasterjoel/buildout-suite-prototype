import { describe, it, expect } from 'vitest'
import {
  getListingSyndication,
  withChannelActive,
  SYNDICATION_NETWORK_NAMES,
  type SyndicationChannel,
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

  it('never claims a confirmed posting for a listing that was never published', () => {
    for (let i = 0; i < 200; i++) {
      const { channels } = getListingSyndication(listingFor(`unpublished-${i}`, null))
      for (const c of channels) {
        expect(c.state).not.toBe('updated')
        expect(c.state).not.toBe('update-sent')
      }
    }
  })

  it('never dates a channel in the future', () => {
    // publishedAt right at "now", the same anchor commitStageTransition writes
    // on publish — the case most likely to overshoot without a clamp. Checked
    // against a `Date.now()` taken *after* generation so the assertion's own
    // bound can only be later than (never earlier than) whatever the
    // generator clamped against — no flakiness from the clock ticking between
    // the two calls.
    for (let i = 0; i < 200; i++) {
      const l = listingFor(`fresh-${i}`, new Date().toISOString())
      const { channels } = getListingSyndication(l)
      const checkedAt = Date.now()
      for (const c of channels) {
        if (c.publishedAt) expect(new Date(c.publishedAt).getTime()).toBeLessThanOrEqual(checkedAt)
        if (c.lastUpdatedAt) expect(new Date(c.lastUpdatedAt).getTime()).toBeLessThanOrEqual(checkedAt)
      }
    }
  })

  it('never gives a paused direct channel an expiration to render', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'direct' && c.state === 'off') {
          expect(c.expiresInDays).toBeNull()
        }
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

  it('never gives an email channel an expiration', () => {
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        if (c.delivery === 'email') expect(c.expiresInDays).toBeNull()
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

  it('never exposes an admin console link', () => {
    // Admin dashboards are internal-only, so no channel may carry one.
    for (const l of populatedListings()) {
      for (const c of getListingSyndication(l).channels) {
        expect(c).not.toHaveProperty('adminUrl')
      }
    }
  })

  it('flags blocksSyndication exactly when the primary-photo issue is present', () => {
    for (const l of populatedListings()) {
      const { blockingIssues, blocksSyndication } = getListingSyndication(l)
      const hasPrimaryIssue = blockingIssues.some((i) => i.includes('set as primary'))
      expect(blocksSyndication).toBe(hasPrimaryIssue)
    }
  })

  it('leads with the rejection issue, not the reach issue', () => {
    const both = populatedListings().filter(
      (l) => getListingSyndication(l).blockingIssues.length === 2,
    )
    // A listing carrying both must exist, or this asserts nothing.
    expect(both.length).toBeGreaterThan(0)
    for (const l of both) {
      expect(getListingSyndication(l).blockingIssues[0]).toContain('set as primary')
    }
  })

  it('reports no issues and no block when no channels are configured', () => {
    // hash % 6 === 0 short-circuits before issues are rolled.
    const empty = Array.from({ length: 200 }, (_, i) => listingFor(`listing-${i}`)).filter(
      (l) => getListingSyndication(l).channels.length === 0,
    )
    expect(empty.length).toBeGreaterThan(0)
    for (const l of empty) {
      expect(getListingSyndication(l)).toMatchObject({
        blockingIssues: [],
        blocksSyndication: false,
      })
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

describe('withChannelActive', () => {
  function direct(over: Partial<SyndicationChannel> = {}): SyndicationChannel {
    return {
      id: 'commercialedge-network',
      name: 'CommercialEdge Network',
      delivery: 'direct',
      state: 'updated',
      active: true,
      publishedAt: '2026-07-22T12:00:00.000Z',
      lastUpdatedAt: '2026-07-22T14:21:00.000Z',
      expiresInDays: 177,
      ...over,
    }
  }

  it('turning a channel off always lands on the "off" state', () => {
    expect(withChannelActive(direct({ state: 'updated' }), false)).toMatchObject({ active: false, state: 'off' })
    expect(withChannelActive(direct({ state: 'pending' }), false)).toMatchObject({ active: false, state: 'off' })
  })

  it('turning a previously-off direct channel on lands on "pending", not "updated"', () => {
    expect(withChannelActive(direct({ state: 'off', active: false }), true)).toMatchObject({
      active: true,
      state: 'pending',
    })
  })

  it('turning a previously-off email channel on lands on "send-pending"', () => {
    const email = direct({ delivery: 'email', state: 'off', active: false, expiresInDays: null })
    expect(withChannelActive(email, true)).toMatchObject({ active: true, state: 'send-pending' })
  })

  it('leaves a broken connection broken no matter which way the switch flips', () => {
    const broken = direct({ state: 'needs-attention', active: true })
    expect(withChannelActive(broken, false)).toMatchObject({ active: false, state: 'needs-attention' })
    expect(withChannelActive(broken, true)).toMatchObject({ active: true, state: 'needs-attention' })
  })

  it('is a no-op on a channel with no connection to toggle', () => {
    const unavailable = direct({ state: 'not-available', active: false })
    expect(withChannelActive(unavailable, true)).toEqual(unavailable)
  })
})
