import { describe, expect, it } from 'vitest'
import type { Listing, Property } from './types'
import {
  INGESTION_STAGES,
  advanceStage,
  allResolved,
  countFilledFields,
  deriveConflicts,
  ingestionPatch,
  resolveConflict,
  resolvedPropertyPatch,
  startIngestionState,
  unresolvedCount,
} from './ingestion'

/** A minimal Sale deal with an asking price and NOI on record. */
function saleDeal(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'deal-1',
    propertyId: 'prop-1',
    name: 'The Delgado Building',
    dealType: 'Sale',
    dealSide: 'seller',
    status: 'proposal',
    financials: { askingPrice: 7_900_000, noi: 520_000 },
    marketing: {},
    transaction: {},
    ...overrides,
  } as unknown as Listing
}

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    name: 'The Delgado Building',
    street: '1200 W Fulton',
    city: 'Chicago',
    state: 'IL',
    propertyType: 'multiFamily',
    buildingSqFt: 52_000,
    askingPrice: 7_900_000,
    occupancyPct: 96,
    units: [],
    ...overrides,
  } as unknown as Property
}

describe('startIngestionState', () => {
  it('starts processing at stage 0 with the given documents', () => {
    const ing = startIngestionState(['T-12.pdf', 'Rent Roll.xlsx'])
    expect(ing.status).toBe('processing')
    expect(ing.stage).toBe(0)
    expect(ing.documents).toEqual(['T-12.pdf', 'Rent Roll.xlsx'])
    expect(ing.conflicts).toEqual([])
    expect(ing.filledCount).toBe(0)
  })
})

describe('advanceStage', () => {
  it('walks 0 → 1 → 2 and clamps at the last stage', () => {
    let ing = startIngestionState(['T-12.pdf'])
    ing = advanceStage(ing)
    expect(ing.stage).toBe(1)
    ing = advanceStage(ing)
    expect(ing.stage).toBe(2)
    ing = advanceStage(ing)
    expect(ing.stage).toBe(2)
  })

  it('has a label and detail for every stage', () => {
    expect(INGESTION_STAGES).toHaveLength(3)
    for (const s of INGESTION_STAGES) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.detail.length).toBeGreaterThan(0)
    }
  })
})

describe('deriveConflicts', () => {
  it('derives three doc-vs-record conflicts when a property record exists', () => {
    const conflicts = deriveConflicts(saleDeal(), property())
    expect(conflicts.map((c) => c.fieldKey)).toEqual(['askingPrice', 'noi', 'occupancyPct'])
    for (const c of conflicts) {
      expect(c.currentSource).toBe('Property record')
      expect(c.resolution).toBeUndefined()
    }
  })

  it('derives doc-vs-doc conflicts when there is no property record', () => {
    const conflicts = deriveConflicts(saleDeal(), undefined)
    expect(conflicts).toHaveLength(3)
    for (const c of conflicts) {
      expect(c.currentSource).not.toBe('Property record')
    }
  })

  it('gives every conflict a non-empty value and differing sides', () => {
    for (const prop of [property(), undefined]) {
      for (const c of deriveConflicts(saleDeal(), prop)) {
        expect(c.docValue).not.toBe('')
        expect(c.currentValue).not.toBe('')
        expect(c.docRaw).not.toBe(c.currentRaw)
        expect(c.label.length).toBeGreaterThan(0)
        expect(c.docSource.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('resolveConflict / allResolved / unresolvedCount', () => {
  it('is not all-resolved until every conflict has a resolution', () => {
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    expect(allResolved(ing)).toBe(false)
    expect(unresolvedCount(ing)).toBe(3)

    ing = resolveConflict(ing, 'askingPrice', 'doc')
    expect(allResolved(ing)).toBe(false)
    expect(unresolvedCount(ing)).toBe(2)

    ing = resolveConflict(ing, 'noi', 'current')
    ing = resolveConflict(ing, 'occupancyPct', 'doc')
    expect(allResolved(ing)).toBe(true)
    expect(unresolvedCount(ing)).toBe(0)
  })

  it('records which side was picked and leaves other conflicts untouched', () => {
    const base = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    const next = resolveConflict(base, 'noi', 'doc')
    expect(next.conflicts.find((c) => c.fieldKey === 'noi')?.resolution).toBe('doc')
    expect(next.conflicts.find((c) => c.fieldKey === 'askingPrice')?.resolution).toBeUndefined()
    // Pure — the input is not mutated.
    expect(base.conflicts.find((c) => c.fieldKey === 'noi')?.resolution).toBeUndefined()
  })

  it('is a no-op for a field key that has no conflict', () => {
    const base = startIngestionState(['T-12.pdf'])
    expect(resolveConflict(base, 'askingPrice', 'doc').conflicts).toEqual([])
  })
})

describe('ingestionPatch', () => {
  it('omits an unresolved asking-price conflict from the financials patch', () => {
    const deal = saleDeal()
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, property()) }
    const patch = ingestionPatch(deal, property(), ing)
    expect(patch.financials.askingPrice).toBeUndefined()
    expect(patch.financials.noi).toBeUndefined()
    // Non-conflicting fields still land.
    expect(patch.marketing.saleTitle).toBeTruthy()
    expect(patch.transaction.listedOnDate).toBeTruthy()
  })

  it('includes a resolved conflict using the picked side value', () => {
    const deal = saleDeal()
    const prop = property()
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, prop) }
    const priceConflict = ing.conflicts.find((c) => c.fieldKey === 'askingPrice')!

    ing = resolveConflict(ing, 'askingPrice', 'doc')
    expect(ingestionPatch(deal, prop, ing).financials.askingPrice).toBe(priceConflict.docRaw)

    ing = resolveConflict(ing, 'askingPrice', 'current')
    expect(ingestionPatch(deal, prop, ing).financials.askingPrice).toBe(priceConflict.currentRaw)
  })

  it('writes every conflict field once all are resolved', () => {
    const deal = saleDeal()
    const prop = property()
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, prop) }
    ing = resolveConflict(ing, 'askingPrice', 'doc')
    ing = resolveConflict(ing, 'noi', 'doc')
    ing = resolveConflict(ing, 'occupancyPct', 'doc')
    const patch = ingestionPatch(deal, prop, ing)
    expect(patch.financials.askingPrice).toBeDefined()
    expect(patch.financials.noi).toBeDefined()
    expect(resolvedPropertyPatch(ing).occupancyPct).toBeDefined()
  })

  it('leaves the property patch empty while occupancy is unresolved', () => {
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    expect(resolvedPropertyPatch(ing).occupancyPct).toBeUndefined()
  })
})

describe('countFilledFields', () => {
  it('counts defined keys across all three patch sections', () => {
    const n = countFilledFields({
      marketing: { saleTitle: 'x', saleDescription: 'y' },
      transaction: { listedOnDate: '2026-07-29' },
      financials: { askingPrice: 1 },
    })
    expect(n).toBe(4)
  })
})
