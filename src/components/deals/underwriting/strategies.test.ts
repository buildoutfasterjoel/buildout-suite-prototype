import { describe, expect, it } from 'vitest'
import {
  UNDERWRITING_STRATEGIES,
  STRATEGY_ORDER,
  DEFAULT_STRATEGY,
  checksFor,
  strategyLabel,
  defaultSelectionFor,
  underwritingFromSelection,
  coerceStrategy,
} from './strategies'

describe('strategy catalog', () => {
  it('defaults to new construction and lists both strategies in order', () => {
    expect(DEFAULT_STRATEGY).toBe('new-construction')
    expect(STRATEGY_ORDER).toEqual(['new-construction', 'value-add'])
  })

  it('gives each strategy 7 checks with unique keys', () => {
    for (const id of STRATEGY_ORDER) {
      const checks = checksFor(id)
      expect(checks).toHaveLength(7)
      expect(new Set(checks.map((c) => c.key)).size).toBe(7)
    }
  })

  it('orders new-construction checks to match the Cactus screen', () => {
    expect(checksFor('new-construction').map((c) => c.key)).toEqual([
      'project-info',
      'unit-mix',
      'income-expenses',
      'investment-cost',
      'exit-disposition',
      'financing',
      'gp-lp-terms',
    ])
  })

  it('exposes the display label', () => {
    expect(strategyLabel('new-construction')).toBe(
      UNDERWRITING_STRATEGIES['new-construction'].label,
    )
  })

  it('default selection turns every check on', () => {
    expect(defaultSelectionFor('value-add')).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]))
  })

  it('builds a persistable record with the strategy label as tier and sorted checks', () => {
    const uw = underwritingFromSelection('value-add', new Set([2, 0, 1]))
    expect(uw.strategy).toBe('value-add')
    expect(uw.tier).toBe(strategyLabel('value-add'))
    expect(uw.selectedChecks).toEqual([0, 1, 2])
  })

  it('coerces undefined and legacy/unknown values to the default strategy', () => {
    expect(coerceStrategy(undefined)).toBe('new-construction')
    expect(coerceStrategy('rapid-screen')).toBe('new-construction')
    expect(coerceStrategy('value-add')).toBe('value-add')
    expect(coerceStrategy('new-construction')).toBe('new-construction')
  })
})
