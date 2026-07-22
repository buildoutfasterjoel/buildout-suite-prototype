import { describe, it, expect } from 'vitest'
import { buildUnderwritingResult } from './underwritingResult'
import { underwritingFromSelection, checksFor } from './strategies'
import type { Property } from '#/data/types'

const PROPERTY = {
  askingPrice: 4_000_000,
  buildingSqFt: 50_000,
  capRate: 0.06,
  street: '1 Main St', city: 'Austin', state: 'TX', zip: '78701',
  propertyType: 'multifamily',
} as unknown as Property

describe('buildUnderwritingResult', () => {
  it('returns deterministic metrics + sections (stable across calls)', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0, 1, 2, 3, 4, 5, 6]))
    const a = buildUnderwritingResult(PROPERTY, uw)
    const b = buildUnderwritingResult(PROPERTY, uw)
    expect(a).toEqual(b)
  })

  it('includes headline + derived analytics in metrics', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0]))
    const keys = buildUnderwritingResult(PROPERTY, uw).metrics.map((m) => m.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'askingPrice', 'goingInCapRate', 'netOperatingIncome', 'buildingSize',
        'dscr', 'debtYield', 'loanAmount', 'reversionValue', 'stabilizedNOI',
      ]),
    )
  })

  it('emits one section per selected check, in strategy order', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0, 2]))
    const result = buildUnderwritingResult(PROPERTY, uw)
    const checks = checksFor('new-construction')
    expect(result.sections.map((s) => s.key)).toEqual([checks[0].key, checks[2].key])
  })

  it('formats a money metric with a $ display', () => {
    const uw = underwritingFromSelection('new-construction', new Set([0]))
    const noi = buildUnderwritingResult(PROPERTY, uw).metrics.find((m) => m.key === 'netOperatingIncome')
    expect(noi?.display.startsWith('$')).toBe(true)
    expect(noi?.value).toBe(240_000) // 4_000_000 * 0.06
  })
})
