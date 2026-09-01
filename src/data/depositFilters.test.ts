import { describe, it, expect } from 'vitest'
import {
  countActiveDepositFilters,
  emptyDepositFilters,
  matchesDepositFilters,
  type DepositFilterInput,
} from './depositFilters'

/** Fixed "today", so "this year" means one thing in every case below. */
const NOW = new Date(2026, 7, 24) // 24 Aug 2026

function row(over: Partial<DepositFilterInput> = {}): DepositFilterInput {
  return {
    searchText: 'mandana massih 1135 kline st ach 6/9 818.12',
    date: '2026-06-12',
    brokerNames: ['Nikos Buse'],
    dealType: 'Sale',
    propertyType: 'office',
    ...over,
  }
}

describe('emptyDepositFilters', () => {
  it('rests on this year, monthly, nothing chosen', () => {
    const filters = emptyDepositFilters(NOW)
    expect(filters.year).toBe(2026)
    expect(filters.grain).toBe('monthly')
    expect(filters.brokers.size).toBe(0)
    expect(filters.dealTypes.size).toBe(0)
    expect(filters.propertyTypes.size).toBe(0)
  })
})

describe('matchesDepositFilters', () => {
  it('keeps every row when nothing is chosen', () => {
    expect(matchesDepositFilters(row(), emptyDepositFilters(NOW))).toBe(true)
  })

  it('matches the search against payer, voucher, reference and amount alike', () => {
    for (const search of ['mandana', 'kline', 'ACH 6/9', '818.12']) {
      expect(
        matchesDepositFilters(row(), { ...emptyDepositFilters(NOW), search }),
      ).toBe(true)
    }
    expect(
      matchesDepositFilters(row(), {
        ...emptyDepositFilters(NOW),
        search: 'portland',
      }),
    ).toBe(false)
  })

  it('ignores a search of nothing but spaces', () => {
    expect(
      matchesDepositFilters(row(), { ...emptyDepositFilters(NOW), search: '   ' }),
    ).toBe(true)
  })

  it('narrows to the chosen year by the day the money landed', () => {
    const filters = { ...emptyDepositFilters(NOW), year: 2025 }
    expect(matchesDepositFilters(row(), filters)).toBe(false)
    expect(matchesDepositFilters(row({ date: '2025-12-31' }), filters)).toBe(true)
  })

  it('keeps a deposit from any year once the year is All time', () => {
    const filters = { ...emptyDepositFilters(NOW), year: 'all' as const }
    expect(matchesDepositFilters(row({ date: '2019-01-01' }), filters)).toBe(true)
  })

  it('matches ANY of a deal\'s brokers, not only the one who leads it', () => {
    const filters = {
      ...emptyDepositFilters(NOW),
      brokers: new Set(['Rosa Delgado']),
    }
    expect(matchesDepositFilters(row(), filters)).toBe(false)
    expect(
      matchesDepositFilters(
        row({ brokerNames: ['Nikos Buse', 'Rosa Delgado'] }),
        filters,
      ),
    ).toBe(true)
  })

  it('narrows by deal type', () => {
    const filters = { ...emptyDepositFilters(NOW), dealTypes: new Set(['Lease' as const]) }
    expect(matchesDepositFilters(row(), filters)).toBe(false)
    expect(matchesDepositFilters(row({ dealType: 'Lease' }), filters)).toBe(true)
  })

  it('drops a deposit whose deal has no property type once that facet is in use', () => {
    const filters = {
      ...emptyDepositFilters(NOW),
      propertyTypes: new Set(['office' as const]),
    }
    expect(matchesDepositFilters(row(), filters)).toBe(true)
    expect(matchesDepositFilters(row({ propertyType: null }), filters)).toBe(false)
  })
})

describe('countActiveDepositFilters', () => {
  it('counts nothing on the resting state — the default year is not a choice', () => {
    expect(countActiveDepositFilters(emptyDepositFilters(NOW), NOW)).toBe(0)
  })

  it('counts a facet once however many options are ticked inside it', () => {
    const filters = {
      ...emptyDepositFilters(NOW),
      dealTypes: new Set(['Sale' as const, 'Lease' as const]),
    }
    expect(countActiveDepositFilters(filters, NOW)).toBe(1)
  })

  it('counts the grain for nothing — it filters no row', () => {
    const filters = { ...emptyDepositFilters(NOW), grain: 'quarterly' as const }
    expect(countActiveDepositFilters(filters, NOW)).toBe(0)
  })

  it('counts a year moved off the default', () => {
    expect(
      countActiveDepositFilters({ ...emptyDepositFilters(NOW), year: 'all' }, NOW),
    ).toBe(1)
  })
})
