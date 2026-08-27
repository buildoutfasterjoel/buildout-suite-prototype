import { describe, expect, it } from 'vitest'
import { parseDate, toISODate } from './isoDate'

describe('parseDate', () => {
  it('reads a stored date as the local calendar day, not UTC midnight', () => {
    // The whole reason this is not `new Date(value)`: a bare yyyy-mm-dd parses
    // as UTC, which reads as the day BEFORE anywhere west of Greenwich.
    const d = parseDate('2026-06-22')!
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(22)
  })

  it('passes a full ISO string through, time and zone intact', () => {
    expect(parseDate('2026-06-22T15:30:00.000Z')?.toISOString()).toBe(
      '2026-06-22T15:30:00.000Z',
    )
  })

  it('reads an empty or null value as no date', () => {
    expect(parseDate('')).toBeUndefined()
    expect(parseDate(null)).toBeUndefined()
  })
})

describe('toISODate', () => {
  it('serializes the local calendar day', () => {
    expect(toISODate(new Date(2026, 5, 22))).toBe('2026-06-22')
  })

  it('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('round-trips with parseDate', () => {
    expect(toISODate(parseDate('2026-01-05')!)).toBe('2026-01-05')
  })
})
