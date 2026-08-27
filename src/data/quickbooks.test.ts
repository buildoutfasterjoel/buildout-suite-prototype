import { describe, expect, it } from 'vitest'
import { invoiceQuickbooksSynced, isQuickbooksSynced } from './quickbooks'

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

describe('invoiceQuickbooksSynced', () => {
  const receivables = [
    { id: 'r1', quickbooksSynced: true },
    { id: 'r2', quickbooksSynced: true },
    { id: 'r3', quickbooksSynced: false },
    { id: 'r4' },
  ]

  it('is synced when every billed receivable is', () => {
    expect(
      invoiceQuickbooksSynced([{ receivableId: 'r1' }, { receivableId: 'r2' }], receivables),
    ).toBe(true)
  })

  it('is not synced when any one line is not', () => {
    // One missing line is enough: the document as a whole is not in QuickBooks.
    expect(
      invoiceQuickbooksSynced([{ receivableId: 'r1' }, { receivableId: 'r3' }], receivables),
    ).toBe(false)
  })

  it('treats an absent flag as not synced', () => {
    expect(invoiceQuickbooksSynced([{ receivableId: 'r4' }], receivables)).toBe(false)
  })

  it('is not synced when a billed receivable has been deleted', () => {
    // The line still names it, but there is nothing left to prove it is there.
    expect(invoiceQuickbooksSynced([{ receivableId: 'gone' }], receivables)).toBe(false)
  })

  it('is not synced with no lines at all', () => {
    // `every` on an empty array is vacuously true, which would have made an
    // empty invoice claim to be in QuickBooks.
    expect(invoiceQuickbooksSynced([], receivables)).toBe(false)
  })
})
