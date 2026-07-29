import { describe, it, expect } from 'vitest'
import { channelBadge, channelMetaSegments } from './syndicationDisplay'
import type { SyndicationChannel } from '#/data/listingSyndication'

function channel(over: Partial<SyndicationChannel> = {}): SyndicationChannel {
  return {
    id: 'commercialedge-network',
    name: 'CommercialEdge Network',
    delivery: 'direct',
    state: 'updated',
    active: true,
    // Midday UTC deliberately: these dates are asserted as MM/DD/YYYY, and an
    // evening-UTC timestamp would roll to the next day for a runner at UTC+9.
    publishedAt: '2026-07-22T12:00:00.000Z',
    lastUpdatedAt: '2026-07-22T14:21:00.000Z',
    expiresInDays: 177,
    adminUrl: 'https://admin.buildout.com/syndication/commercialedge-network/oak-street-plaza',
    ...over,
  }
}

/** Segments are joined by the card, so assert on the clause list. */
const texts = (c: SyndicationChannel) => channelMetaSegments(c).map((s) => s.text)

describe('channelBadge', () => {
  it('confirms a direct push in success green', () => {
    expect(channelBadge('updated')).toMatchObject({ label: 'Updated', color: 'var(--bp-success)' })
  })

  it('uses the informational token for in-flight states, not brand primary', () => {
    expect(channelBadge('pending').color).toBe('var(--channel-info)')
    expect(channelBadge('send-pending').color).toBe('var(--channel-info)')
  })

  it('never dresses a completed email send as a confirmation', () => {
    const sent = channelBadge('update-sent')
    expect(sent.label).toBe('Update sent')
    expect(sent.color).toBe('var(--stage-inactive)')
    expect(sent.color).not.toBe('var(--bp-success)')
  })

  it('flags a broken connection with warning', () => {
    expect(channelBadge('needs-attention')).toMatchObject({
      label: 'Needs attention',
      color: 'var(--bp-warning)',
    })
  })
})

describe('channelMetaSegments — direct', () => {
  it('reports published, last updated, and expiration', () => {
    expect(texts(channel())).toEqual([
      'Published 07/22/2026',
      expect.stringContaining('Updated 07/22/2026'),
      'Expires in 177 days',
    ])
  })

  it('warns when the expiration is within 30 days', () => {
    const segs = channelMetaSegments(channel({ expiresInDays: 12 }))
    expect(segs.at(-1)).toEqual({ text: 'Expires in 12 days', tone: 'warning' })
  })

  it('does not warn at 31 days', () => {
    expect(channelMetaSegments(channel({ expiresInDays: 31 })).at(-1)?.tone).toBeUndefined()
  })

  it('singularises a one-day countdown', () => {
    expect(texts(channel({ expiresInDays: 1 }))).toContain('Expires in 1 day')
  })

  it('omits expiration entirely when there is nothing to expire', () => {
    expect(texts(channel({ expiresInDays: null }))).toEqual([
      'Published 07/22/2026',
      expect.stringContaining('Updated 07/22/2026'),
    ])
  })

  it('keeps history for a paused channel', () => {
    expect(texts(channel({ state: 'off', active: false }))).toEqual([
      'Not syndicating',
      'Last published 07/22/2026',
    ])
  })

  it('says so plainly when a paused channel never published', () => {
    expect(
      texts(channel({ state: 'off', active: false, publishedAt: null, lastUpdatedAt: null, expiresInDays: null })),
    ).toEqual(['Not syndicating', 'Never published'])
  })

  it('explains an unavailable channel instead of showing empty dates', () => {
    expect(
      texts(channel({ state: 'not-available', active: false, publishedAt: null, lastUpdatedAt: null, expiresInDays: null, adminUrl: null })),
    ).toEqual(['No connection configured for this account'])
  })
})

describe('channelMetaSegments — email', () => {
  const email = (over: Partial<SyndicationChannel> = {}) =>
    channel({ id: 'loopnet', name: 'LoopNet', delivery: 'email', state: 'update-sent', expiresInDays: null, adminUrl: null, ...over })

  it('reports the last send and refuses to imply the posting is confirmed', () => {
    expect(texts(email())).toEqual([
      expect.stringContaining('Last sent 07/22/2026'),
      'Posting not confirmed',
    ])
  })

  it('reports a queued send', () => {
    expect(texts(email({ state: 'send-pending' }))).toEqual(['Update queued to send'])
  })

  it('keeps send history for a paused email channel', () => {
    expect(texts(email({ state: 'off', active: false }))).toEqual([
      'Not sending',
      expect.stringContaining('Last sent 07/22/2026'),
    ])
  })

  it('says so plainly when nothing was ever sent', () => {
    expect(texts(email({ state: 'off', active: false, publishedAt: null, lastUpdatedAt: null }))).toEqual([
      'Not sending',
      'No updates sent',
    ])
  })
})
