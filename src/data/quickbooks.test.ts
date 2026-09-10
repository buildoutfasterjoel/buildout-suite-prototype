import { describe, expect, it } from 'vitest'
import { isQuickbooksSynced } from './quickbooks'

describe('isQuickbooksSynced', () => {
  it('gives one id the same answer every time', () => {
    // The whole reason this hashes rather than draws: a reseed must not
    // reshuffle which contacts are connected to QuickBooks.
    const id = '5a0d5f6e-3f6a-4d2b-9c1e-77b2a1c4e8f0'
    const first = isQuickbooksSynced(id)
    for (let i = 0; i < 5; i++) expect(isQuickbooksSynced(id)).toBe(first)
  })

  it('produces both states across a set of ids', () => {
    // A badge on every row would carry no information — the mix is the point.
    const ids = Array.from({ length: 200 }, (_, i) => `receivable-${i}-abc`)
    const synced = ids.filter(isQuickbooksSynced)
    expect(synced.length).toBeGreaterThan(0)
    expect(synced.length).toBeLessThan(ids.length)
  })

  it('leans synced, so a badge reads as the normal state', () => {
    const ids = Array.from({ length: 400 }, (_, i) => `c-${i}-${i * 7}`)
    const ratio = ids.filter(isQuickbooksSynced).length / ids.length
    expect(ratio).toBeGreaterThan(0.5)
    expect(ratio).toBeLessThan(0.95)
  })

  it('does not degenerate on ids that share a long prefix', () => {
    // The fixtures name records `recv-space-1`, `recv-space-2` and so on. A
    // weaker hash returns one answer for a whole run of those.
    const ids = Array.from({ length: 24 }, (_, i) => `recv-space-${i}`)
    const synced = ids.filter(isQuickbooksSynced)
    expect(synced.length).toBeGreaterThan(0)
    expect(synced.length).toBeLessThan(ids.length)
  })

  it('answers for an empty id without throwing', () => {
    expect(typeof isQuickbooksSynced('')).toBe('boolean')
  })
})
