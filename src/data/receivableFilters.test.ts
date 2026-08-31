import { describe, it, expect } from 'vitest'
import {
  countActiveReceivableFilters,
  emptyReceivableFilters,
  matchesReceivableFilters,
  type ReceivableFilterInput,
} from './receivableFilters'

/** Fixed "today" so every year assertion is deterministic. */
const NOW = new Date(2026, 7, 24) // 24 Aug 2026

function row(overrides: Partial<ReceivableFilterInput> = {}): ReceivableFilterInput {
  return {
    searchText: 'acme company 1135 kline st due on receipt 30000 30000.00',
    dueDate: '2026-06-09',
    status: 'Open',
    brokerNames: ['Colleen Little', 'Sarah Chen'],
    dealStage: 'closed',
    dealType: 'Sale',
    propertyType: 'office',
    ...overrides,
  }
}

/** Every filter cleared, and no year restriction. */
function anyYear() {
  return { ...emptyReceivableFilters(NOW), year: 'all' as const }
}

describe('emptyReceivableFilters', () => {
  it('defaults to monthly buckets and the current year', () => {
    const s = emptyReceivableFilters(NOW)
    expect(s.grain).toBe('monthly')
    expect(s.year).toBe(2026)
  })

  it('starts with every facet cleared', () => {
    const s = emptyReceivableFilters(NOW)
    expect(s.search).toBe('')
    expect(s.statuses.size).toBe(0)
    expect(s.brokers.size).toBe(0)
    expect(s.stages.size).toBe(0)
    expect(s.dealTypes.size).toBe(0)
    expect(s.propertyTypes.size).toBe(0)
  })
})

describe('matchesReceivableFilters — search', () => {
  it('matches the payer, the voucher, the description and the amount', () => {
    const s = anyYear()
    for (const q of ['acme', 'ACME', 'kline', 'receipt', '30000', '30000.00']) {
      expect(matchesReceivableFilters(row(), { ...s, search: q })).toBe(true)
    }
  })

  it('rejects a term that appears nowhere in the row', () => {
    expect(
      matchesReceivableFilters(row(), { ...anyYear(), search: 'portland' }),
    ).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(
      matchesReceivableFilters(row(), { ...anyYear(), search: '   ' }),
    ).toBe(true)
  })
})

describe('matchesReceivableFilters — year', () => {
  it('keeps a row due in the chosen year', () => {
    expect(
      matchesReceivableFilters(row({ dueDate: '2026-06-09' }), {
        ...anyYear(),
        year: 2026,
      }),
    ).toBe(true)
  })

  it('drops a row due in another year', () => {
    expect(
      matchesReceivableFilters(row({ dueDate: '2025-12-31' }), {
        ...anyYear(),
        year: 2026,
      }),
    ).toBe(false)
  })

  it("'all' admits a row no offered year would reach", () => {
    expect(
      matchesReceivableFilters(row({ dueDate: '2019-02-02' }), anyYear()),
    ).toBe(true)
  })
})

describe('matchesReceivableFilters — facets', () => {
  it('an empty facet restricts nothing', () => {
    expect(matchesReceivableFilters(row(), anyYear())).toBe(true)
  })

  it('filters on status', () => {
    const s = { ...anyYear(), statuses: new Set(['Overdue' as const]) }
    expect(matchesReceivableFilters(row({ status: 'Overdue' }), s)).toBe(true)
    expect(matchesReceivableFilters(row({ status: 'Open' }), s)).toBe(false)
  })

  it('filters on deal type', () => {
    const s = { ...anyYear(), dealTypes: new Set(['Lease' as const]) }
    expect(matchesReceivableFilters(row({ dealType: 'Lease' }), s)).toBe(true)
    expect(matchesReceivableFilters(row({ dealType: 'Sale' }), s)).toBe(false)
  })

  it('filters on deal stage', () => {
    const s = { ...anyYear(), stages: new Set(['closed' as const]) }
    expect(matchesReceivableFilters(row({ dealStage: 'closed' }), s)).toBe(true)
    expect(matchesReceivableFilters(row({ dealStage: 'active' }), s)).toBe(false)
  })

  it('filters on property type, dropping a row whose property has gone', () => {
    const s = { ...anyYear(), propertyTypes: new Set(['office' as const]) }
    expect(matchesReceivableFilters(row({ propertyType: 'office' }), s)).toBe(true)
    expect(matchesReceivableFilters(row({ propertyType: 'retail' }), s)).toBe(false)
    expect(matchesReceivableFilters(row({ propertyType: null }), s)).toBe(false)
  })

  it('matches ANY of a deal\'s brokers, not only the one who leads it', () => {
    const s = { ...anyYear(), brokers: new Set(['Sarah Chen']) }
    expect(matchesReceivableFilters(row(), s)).toBe(true)
    expect(
      matchesReceivableFilters(row({ brokerNames: ['Colleen Little'] }), s),
    ).toBe(false)
    expect(matchesReceivableFilters(row({ brokerNames: [] }), s)).toBe(false)
  })

  it('applies two facets together', () => {
    const s = {
      ...anyYear(),
      dealTypes: new Set(['Sale' as const]),
      statuses: new Set(['Open' as const]),
    }
    expect(matchesReceivableFilters(row(), s)).toBe(true)
    expect(matchesReceivableFilters(row({ status: 'Overdue' }), s)).toBe(false)
  })
})

describe('countActiveReceivableFilters', () => {
  it('counts nothing in the resting state', () => {
    expect(countActiveReceivableFilters(emptyReceivableFilters(NOW), NOW)).toBe(0)
  })

  it('ignores the grain, which filters no row', () => {
    const s = { ...emptyReceivableFilters(NOW), grain: 'quarterly' as const }
    expect(countActiveReceivableFilters(s, NOW)).toBe(0)
  })

  it('counts a year moved off the default, including "all"', () => {
    expect(
      countActiveReceivableFilters(
        { ...emptyReceivableFilters(NOW), year: 2025 },
        NOW,
      ),
    ).toBe(1)
    expect(countActiveReceivableFilters(anyYear(), NOW)).toBe(1)
  })

  it('counts a facet once however many options are ticked', () => {
    const s = {
      ...emptyReceivableFilters(NOW),
      statuses: new Set(['Open' as const, 'Overdue' as const]),
    }
    expect(countActiveReceivableFilters(s, NOW)).toBe(1)
  })

  it('counts search only when it holds something', () => {
    const s = emptyReceivableFilters(NOW)
    expect(countActiveReceivableFilters({ ...s, search: '  ' }, NOW)).toBe(0)
    expect(countActiveReceivableFilters({ ...s, search: 'acme' }, NOW)).toBe(1)
  })
})
