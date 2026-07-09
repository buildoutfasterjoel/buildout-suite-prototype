import { describe, expect, it } from 'vitest'
import { endMilestone, stageStartDate, formatPlannerDate } from './TodayPlanner'
import type { DealHistoryEntry } from '#/data/types'

const CREATED_AT = '2026-01-01T00:00:00.000Z'

/** Mirrors the implementation's own date math, so assertions aren't sensitive to test-machine timezone. */
function expectedAddDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

describe('stageStartDate', () => {
  it('falls back to createdAt when there is no stage-transition entry', () => {
    const history: DealHistoryEntry[] = [
      { id: '1', label: 'Created under', fromStage: null, toStage: 'proposal', actor: 'A', timestamp: CREATED_AT },
    ]
    expect(stageStartDate(history, 'proposal', CREATED_AT)).toBe(CREATED_AT)
  })

  it('uses the timestamp of the entry that transitioned into the current stage', () => {
    const history: DealHistoryEntry[] = [
      { id: '1', label: 'Created under', fromStage: null, toStage: 'proposal', actor: 'A', timestamp: CREATED_AT },
      { id: '2', label: 'Stage updated from', fromStage: 'proposal', toStage: 'active', actor: 'A', timestamp: '2026-03-15T00:00:00.000Z' },
    ]
    expect(stageStartDate(history, 'active', CREATED_AT)).toBe('2026-03-15T00:00:00.000Z')
  })
})

describe('endMilestone', () => {
  it('proposal expires 180 days after start', () => {
    const m = endMilestone('proposal', CREATED_AT, null)
    expect(m).toEqual({ label: 'Listing expires', date: expectedAddDays(CREATED_AT, 180) })
  })

  it('active listing agreement renews 180 days after start', () => {
    const m = endMilestone('active', CREATED_AT, null)
    expect(m).toEqual({ label: 'Listing agreement renews', date: expectedAddDays(CREATED_AT, 180) })
  })

  it('under-contract targets closing 45 days after start', () => {
    const m = endMilestone('under-contract', CREATED_AT, null)
    expect(m).toEqual({ label: 'Target closing', date: expectedAddDays(CREATED_AT, 45) })
  })

  it('closed uses the actual financials close date when present', () => {
    const m = endMilestone('closed', CREATED_AT, '2026-02-01')
    expect(m).toEqual({ label: 'Closed', date: '2026-02-01' })
  })

  it('closed falls back to a computed date when close date is missing', () => {
    const m = endMilestone('closed', CREATED_AT, null)
    expect(m).toEqual({ label: 'Closed', date: expectedAddDays(CREATED_AT, 45) })
  })

  it('inactive has no forward milestone', () => {
    expect(endMilestone('inactive', CREATED_AT, null)).toBeNull()
  })
})

describe('formatPlannerDate', () => {
  it('formats a date-only string (e.g. "2026-07-02") as UTC calendar date, not local', () => {
    // This is the regression test for the timezone bug.
    // A date-only string like "2026-07-02" should always format to "2 JUL, 2026"
    // on any machine, regardless of the local timezone.
    // Before the fix, machines west of UTC would render this as "1 JUL, 2026".
    expect(formatPlannerDate('2026-07-02')).toBe('2 JUL, 2026')
  })

  it('formats a full UTC timestamp (e.g. "2026-01-01T00:00:00.000Z") correctly', () => {
    // Confirms that full timestamps still work after applying the UTC fix.
    expect(formatPlannerDate('2026-01-01T00:00:00.000Z')).toBe('1 JAN, 2026')
  })

  it('returns "TBD" for null input', () => {
    expect(formatPlannerDate(null)).toBe('TBD')
  })
})
