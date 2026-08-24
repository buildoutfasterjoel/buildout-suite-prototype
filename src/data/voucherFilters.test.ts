import { describe, it, expect } from 'vitest'
import {
  emptyVoucherFilters,
  matchesVoucherFilters,
  countActiveVoucherFilters,
  type VoucherFilterInput,
} from './voucherFilters'

/** Fixed "today" so every range assertion is deterministic. */
const NOW = new Date(2026, 7, 24) // 24 Aug 2026

function row(overrides: Partial<VoucherFilterInput> = {}): VoucherFilterInput {
  return {
    name: 'Riverside Tower',
    dealName: 'Riverside Tower',
    identifier: '118',
    relatedContactsLabel: 'Ada Nunez & 2 more',
    propertyAddress: '783 Locust Street, Austin, TX 83332',
    status: 'Draft',
    dealType: 'Sale',
    dealStage: 'active',
    propertyType: 'office',
    brokerName: 'Colleen Little',
    closeDate: null,
    createdOn: '2026-08-01',
    ...overrides,
  }
}

/** The state under test: every filter cleared, and no date restriction. */
function anyDate() {
  return { ...emptyVoucherFilters(), closeDate: 'any' as const }
}

describe('emptyVoucherFilters', () => {
  it('defaults to the last 365 days, as the toolbar shows', () => {
    expect(emptyVoucherFilters().closeDate).toBe('last-365')
  })

  it('starts with every other filter cleared', () => {
    const s = emptyVoucherFilters()
    expect(s.search).toBe('')
    expect(s.statuses.size).toBe(0)
    expect(s.dealTypes.size).toBe(0)
    expect(s.stages.size).toBe(0)
    expect(s.propertyTypes.size).toBe(0)
    expect(s.brokers.size).toBe(0)
  })
})

describe('matchesVoucherFilters — search', () => {
  it('matches the voucher name, the deal name, the id, the contacts and the address', () => {
    const s = anyDate()
    for (const q of ['riverside', 'RIVERSIDE', '118', 'nunez', 'locust']) {
      expect(matchesVoucherFilters(row(), { ...s, search: q }, NOW)).toBe(true)
    }
  })

  it('rejects a term that appears in none of them', () => {
    expect(
      matchesVoucherFilters(row(), { ...anyDate(), search: 'zzz' }, NOW),
    ).toBe(false)
  })

  it('ignores surrounding whitespace', () => {
    expect(
      matchesVoucherFilters(row(), { ...anyDate(), search: '  118  ' }, NOW),
    ).toBe(true)
  })
})

describe('matchesVoucherFilters — facets', () => {
  it('keeps a row whose value is among those selected', () => {
    const s = anyDate()
    expect(
      matchesVoucherFilters(row({ status: 'Approved' }), { ...s, statuses: new Set(['Approved']) }, NOW),
    ).toBe(true)
    expect(
      matchesVoucherFilters(row({ status: 'Draft' }), { ...s, statuses: new Set(['Approved']) }, NOW),
    ).toBe(false)
  })

  it('treats an empty facet as no restriction, not as excluding everything', () => {
    expect(matchesVoucherFilters(row(), anyDate(), NOW)).toBe(true)
  })

  it('ORs within a facet and ANDs across facets', () => {
    const s = {
      ...anyDate(),
      dealTypes: new Set<'Sale' | 'Lease'>(['Sale', 'Lease']),
      propertyTypes: new Set(['retail' as const]),
    }
    // Deal type passes either way; property type is what decides.
    expect(matchesVoucherFilters(row({ propertyType: 'retail' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ propertyType: 'office' }), s, NOW)).toBe(false)
  })

  it('filters by deal stage and by broker', () => {
    const s = anyDate()
    expect(
      matchesVoucherFilters(row({ dealStage: 'closed' }), { ...s, stages: new Set(['closed']) }, NOW),
    ).toBe(true)
    expect(
      matchesVoucherFilters(row({ brokerName: 'Ada Nunez' }), { ...s, brokers: new Set(['Ada Nunez']) }, NOW),
    ).toBe(true)
    expect(
      matchesVoucherFilters(row({ brokerName: 'Ada Nunez' }), { ...s, brokers: new Set(['Someone Else']) }, NOW),
    ).toBe(false)
  })

  it('excludes a row with no property type or broker once that facet is used', () => {
    // A deal whose property left the store can't claim membership of any type.
    const s = anyDate()
    expect(
      matchesVoucherFilters(row({ propertyType: null }), { ...s, propertyTypes: new Set(['office' as const]) }, NOW),
    ).toBe(false)
    expect(
      matchesVoucherFilters(row({ brokerName: null }), { ...s, brokers: new Set(['Ada Nunez']) }, NOW),
    ).toBe(false)
  })
})

describe('matchesVoucherFilters — close date presets', () => {
  it('"any" keeps every row, including one that never closed', () => {
    expect(matchesVoucherFilters(row({ closeDate: null }), anyDate(), NOW)).toBe(true)
  })

  it('"last-365" reads the created date, not the close date', () => {
    // Confirmed with the team: this option means "deals opened in the last
    // year". A deal still being worked belongs in that answer.
    const s = { ...emptyVoucherFilters(), closeDate: 'last-365' as const }
    expect(matchesVoucherFilters(row({ createdOn: '2026-08-03' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ createdOn: '2025-08-25' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ createdOn: '2025-08-23' }), s, NOW)).toBe(false)
  })

  it('"last-365" keeps a recently opened deal that has never closed', () => {
    // The case the close-date reading got wrong: a draft voucher on a live deal
    // is exactly what the back office is chasing, and it has no close date.
    const s = { ...emptyVoucherFilters(), closeDate: 'last-365' as const }
    expect(
      matchesVoucherFilters(row({ createdOn: '2026-06-01', closeDate: null }), s, NOW),
    ).toBe(true)
  })

  it('"last-365" ignores the close date entirely', () => {
    // An old deal that closed yesterday is still an old deal.
    const s = { ...emptyVoucherFilters(), closeDate: 'last-365' as const }
    expect(
      matchesVoucherFilters(row({ createdOn: '2023-01-01', closeDate: '2026-08-23' }), s, NOW),
    ).toBe(false)
  })

  it('"ytd" reads the created date, over this calendar year', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'ytd' as const }
    expect(matchesVoucherFilters(row({ createdOn: '2026-01-01' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ createdOn: '2025-12-31' }), s, NOW)).toBe(false)
  })

  it('"ytd" keeps a deal opened this year that has never closed', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'ytd' as const }
    expect(
      matchesVoucherFilters(row({ createdOn: '2026-02-01', closeDate: null }), s, NOW),
    ).toBe(true)
  })

  it('"last-year" reads the close date, not the created date', () => {
    // The one window in the set that is still about closing — hence its label.
    const s = { ...emptyVoucherFilters(), closeDate: 'last-year' as const }
    expect(
      matchesVoucherFilters(row({ createdOn: '2025-06-01', closeDate: null }), s, NOW),
    ).toBe(false)
    expect(
      matchesVoucherFilters(row({ createdOn: '2023-01-01', closeDate: '2025-06-01' }), s, NOW),
    ).toBe(true)
  })

  it('"last-year" counts the previous calendar year only', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'last-year' as const }
    expect(matchesVoucherFilters(row({ closeDate: '2025-12-31' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ closeDate: '2025-01-01' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ closeDate: '2026-01-01' }), s, NOW)).toBe(false)
    expect(matchesVoucherFilters(row({ closeDate: '2024-12-31' }), s, NOW)).toBe(false)
  })

  it('"active-ytd-closed" keeps every open deal whatever its close date', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'active-ytd-closed' as const }
    for (const stage of ['proposal', 'active', 'under-contract'] as const) {
      expect(matchesVoucherFilters(row({ dealStage: stage, closeDate: null }), s, NOW)).toBe(true)
    }
  })

  it('"active-ytd-closed" keeps a closed deal only if it closed this year', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'active-ytd-closed' as const }
    expect(matchesVoucherFilters(row({ dealStage: 'closed', closeDate: '2026-03-01' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ dealStage: 'closed', closeDate: '2025-03-01' }), s, NOW)).toBe(false)
  })

  it('"active-ytd-closed" excludes a lost deal — it is neither active nor closed', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'active-ytd-closed' as const }
    expect(matchesVoucherFilters(row({ dealStage: 'inactive', closeDate: null }), s, NOW)).toBe(false)
  })

  it('"custom" bounds the window at both ends, inclusively', () => {
    const s = {
      ...emptyVoucherFilters(),
      closeDate: 'custom' as const,
      customFrom: '2026-03-01',
      customTo: '2026-03-31',
    }
    expect(matchesVoucherFilters(row({ closeDate: '2026-03-01' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ closeDate: '2026-03-31' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ closeDate: '2026-02-28' }), s, NOW)).toBe(false)
    expect(matchesVoucherFilters(row({ closeDate: '2026-04-01' }), s, NOW)).toBe(false)
  })

  it('"custom" leaves an unset end open rather than excluding everything', () => {
    // Half a range is still a usable filter; treating a missing bound as an
    // empty window would make the dropdown look broken mid-entry.
    const s = {
      ...emptyVoucherFilters(),
      closeDate: 'custom' as const,
      customFrom: '2026-03-01',
      customTo: null,
    }
    expect(matchesVoucherFilters(row({ closeDate: '2026-12-31' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ closeDate: '2026-02-01' }), s, NOW)).toBe(false)
  })

  it('"custom" with neither bound set keeps every row that has closed', () => {
    const s = { ...emptyVoucherFilters(), closeDate: 'custom' as const }
    expect(matchesVoucherFilters(row({ closeDate: '2020-01-01' }), s, NOW)).toBe(true)
    expect(matchesVoucherFilters(row({ closeDate: null }), s, NOW)).toBe(false)
  })
})

describe('countActiveVoucherFilters', () => {
  it('counts nothing when the page is in its default state', () => {
    // The default close-date preset is not a filter the user chose, so a badge
    // on load would be noise.
    expect(countActiveVoucherFilters(emptyVoucherFilters())).toBe(0)
  })

  it('counts each facet in use once, plus a changed date preset', () => {
    const s = emptyVoucherFilters()
    s.statuses.add('Draft')
    s.statuses.add('Approved')
    s.stages.add('closed')
    expect(countActiveVoucherFilters(s)).toBe(2)
    expect(countActiveVoucherFilters({ ...s, closeDate: 'ytd' })).toBe(3)
  })

  it('counts a search term', () => {
    expect(countActiveVoucherFilters({ ...emptyVoucherFilters(), search: 'ada' })).toBe(1)
    expect(countActiveVoucherFilters({ ...emptyVoucherFilters(), search: '  ' })).toBe(0)
  })
})
