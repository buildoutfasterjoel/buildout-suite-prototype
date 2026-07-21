import type { DealUnderwriting } from '#/data/types'

export type UnderwritingStrategyId = 'new-construction' | 'value-add'

/** One analysis step. `key` is stable and resolves the document section builder. */
export interface UnderwritingCheck {
  key: string
  /** Noun shown in the depth toggles and the document scope table. */
  label: string
}

export interface UnderwritingStrategyDef {
  id: UnderwritingStrategyId
  /** Full display label, e.g. "New Construction Strategy". */
  label: string
  /** One-line explanation shown in the strategy dropdown. */
  description: string
  checks: UnderwritingCheck[]
}

export const UNDERWRITING_STRATEGIES: Record<
  UnderwritingStrategyId,
  UnderwritingStrategyDef
> = {
  'new-construction': {
    id: 'new-construction',
    label: 'New Construction Strategy',
    description:
      'Underwrite the upside of redeveloping or rebuilding the property from the ground up.',
    checks: [
      { key: 'project-info', label: 'Project information' },
      { key: 'unit-mix', label: 'Unit mix' },
      { key: 'income-expenses', label: 'Property-level income & expenses' },
      { key: 'investment-cost', label: 'Investment cost assumptions' },
      { key: 'exit-disposition', label: 'Exit / disposition assumptions' },
      { key: 'financing', label: 'Financing assumptions' },
      { key: 'gp-lp-terms', label: 'GP/LP terms' },
    ],
  },
  'value-add': {
    id: 'value-add',
    label: 'Value-Add Strategy',
    description:
      'Underwrite the value of renovating and improving the property before selling or leasing.',
    checks: [
      { key: 'project-info', label: 'Project information' },
      { key: 'rent-roll', label: 'Current rent roll & unit mix' },
      { key: 'income-expenses-inplace', label: 'Property-level income & expenses (in-place)' },
      { key: 'renovation-budget', label: 'Renovation & capex budget' },
      { key: 'stabilized-proforma', label: 'Stabilized (post-reno) pro-forma' },
      { key: 'financing', label: 'Financing assumptions' },
      { key: 'exit-disposition', label: 'Exit / disposition assumptions' },
    ],
  },
}

export const STRATEGY_ORDER: UnderwritingStrategyId[] = ['new-construction', 'value-add']

export const DEFAULT_STRATEGY: UnderwritingStrategyId = 'new-construction'

/** Coerce any (possibly legacy/undefined) value to a known strategy id. */
export function coerceStrategy(id: string | undefined): UnderwritingStrategyId {
  return id === 'value-add' || id === 'new-construction' ? id : DEFAULT_STRATEGY
}

export function checksFor(id: UnderwritingStrategyId): UnderwritingCheck[] {
  return UNDERWRITING_STRATEGIES[id].checks
}

export function strategyLabel(id: UnderwritingStrategyId): string {
  return UNDERWRITING_STRATEGIES[id].label
}

/** The default depth: every check in the strategy turned on. */
export function defaultSelectionFor(id: UnderwritingStrategyId): Set<number> {
  return new Set(checksFor(id).map((_, i) => i))
}

/** Convert a strategy + selected check indices into a persistable record. */
export function underwritingFromSelection(
  id: UnderwritingStrategyId,
  sel: Set<number>,
): DealUnderwriting {
  return {
    strategy: id,
    tier: strategyLabel(id),
    selectedChecks: [...sel].sort((a, b) => a - b),
  }
}
