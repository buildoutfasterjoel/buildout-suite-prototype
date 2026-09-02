import { describe, it, expect } from 'vitest'
import type { PayableStatus } from './payableIndex'
import {
  clearedPayableFilters,
  countActivePayableFilters,
  emptyPayableFilters,
  matchesPayableFilters,
  payableFilterChips,
  type PayableFilterInput,
} from './payableFilters'

const NOW = new Date(2026, 7, 24) // 24 Aug 2026

function row(over: Partial<PayableFilterInput> = {}): PayableFilterInput {
  return {
    searchText: 'nikos buse 205 s. peoria 899.96',
    date: '2026-05-22',
    status: 'Outstanding',
    ...over,
  }
}

describe('emptyPayableFilters', () => {
  it('opens on Outstanding, all time', () => {
    const filters = emptyPayableFilters(NOW)
    expect(filters.year).toBe('all')
    expect([...filters.statuses]).toEqual(['Outstanding'])
    expect(filters.search).toBe('')
  })
})

describe('clearedPayableFilters', () => {
  it('takes Outstanding off too — clear means clear', () => {
    expect(clearedPayableFilters().statuses.size).toBe(0)
    expect(countActivePayableFilters(clearedPayableFilters())).toBe(0)
  })
})

describe('matchesPayableFilters', () => {
  it('keeps everything when nothing is set', () => {
    expect(matchesPayableFilters(row(), clearedPayableFilters())).toBe(true)
  })

  it('matches the search term against the haystack', () => {
    const filters = { ...clearedPayableFilters(), search: 'peoria' }
    expect(matchesPayableFilters(row(), filters)).toBe(true)
    expect(matchesPayableFilters(row(), { ...filters, search: 'kline' })).toBe(
      false,
    )
  })

  it('finds a row by an unformatted amount', () => {
    const filters = { ...clearedPayableFilters(), search: '899.96' }
    expect(matchesPayableFilters(row(), filters)).toBe(true)
  })

  it('ignores case and surrounding space in the search term', () => {
    const filters = { ...clearedPayableFilters(), search: '  NIKOS  ' }
    expect(matchesPayableFilters(row(), filters)).toBe(true)
  })

  it('narrows to one creation year', () => {
    const filters = { ...clearedPayableFilters(), year: 2026 }
    expect(matchesPayableFilters(row({ date: '2026-05-22' }), filters)).toBe(true)
    expect(matchesPayableFilters(row({ date: '2025-05-22' }), filters)).toBe(false)
  })

  it('keeps every year under "all"', () => {
    const filters = { ...clearedPayableFilters(), year: 'all' as const }
    expect(matchesPayableFilters(row({ date: '2019-01-01' }), filters)).toBe(true)
  })

  it('narrows by status, and an empty set means every status', () => {
    const outstanding = emptyPayableFilters(NOW)
    expect(matchesPayableFilters(row({ status: 'Outstanding' }), outstanding)).toBe(
      true,
    )
    expect(matchesPayableFilters(row({ status: 'Fully Paid' }), outstanding)).toBe(
      false,
    )

    const none = clearedPayableFilters()
    expect(matchesPayableFilters(row({ status: 'Fully Paid' }), none)).toBe(true)
  })

  it('requires every filter to pass, not just one', () => {
    const filters = {
      search: 'peoria',
      year: 2025,
      statuses: new Set<PayableStatus>(['Outstanding']),
    }
    // Right term, right status, wrong year.
    expect(matchesPayableFilters(row({ date: '2026-05-22' }), filters)).toBe(false)
  })
})

describe('payableFilterChips', () => {
  it('renders one chip per status and one for a chosen year', () => {
    const chips = payableFilterChips({
      search: '',
      year: 2026,
      statuses: new Set<PayableStatus>(['Outstanding', 'Fully Paid']),
    })
    expect(chips.map((c) => c.label)).toEqual([
      'Outstanding',
      'Fully Paid',
      '2026',
    ])
  })

  it('does not chip the search term — the box already shows it', () => {
    const chips = payableFilterChips({
      search: 'peoria',
      year: 'all',
      statuses: new Set<PayableStatus>(),
    })
    expect(chips).toEqual([])
  })

  it('clears just its own filter, leaving the rest alone', () => {
    const state = {
      search: 'peoria',
      year: 2026 as const,
      statuses: new Set<PayableStatus>(['Outstanding']),
    }
    const statusChip = payableFilterChips(state).find(
      (c) => c.label === 'Outstanding',
    )!
    const next = statusChip.clear(state)
    expect(next.statuses.size).toBe(0)
    expect(next.year).toBe(2026)
    expect(next.search).toBe('peoria')
    // Never mutates the state it was handed.
    expect(state.statuses.size).toBe(1)
  })
})

describe('countActivePayableFilters', () => {
  it('counts the search term alongside the chips', () => {
    expect(countActivePayableFilters(emptyPayableFilters(NOW))).toBe(1)
    expect(
      countActivePayableFilters({
        ...emptyPayableFilters(NOW),
        search: 'peoria',
        year: 2026,
      }),
    ).toBe(3)
  })

  it('ignores a search box holding only spaces', () => {
    expect(
      countActivePayableFilters({ ...clearedPayableFilters(), search: '   ' }),
    ).toBe(0)
  })
})
