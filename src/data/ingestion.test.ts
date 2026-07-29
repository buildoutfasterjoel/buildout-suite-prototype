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

/** The same deal as a Lease — its editor has no Financials section. */
function leaseDeal(overrides: Partial<Listing> = {}): Listing {
  return saleDeal({ dealType: 'Lease', ...overrides })
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
    for (const deal of [saleDeal(), leaseDeal()]) {
      for (const prop of [property(), undefined]) {
        const conflicts = deriveConflicts(deal, prop)
        expect(conflicts.length).toBeGreaterThan(0)
        for (const c of conflicts) {
          expect(c.docValue).not.toBe('')
          expect(c.currentValue).not.toBe('')
          expect(c.docRaw).not.toBe(c.currentRaw)
          expect(c.label.length).toBeGreaterThan(0)
          expect(c.docSource.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('keeps all three for a Sale, in askingPrice → noi → occupancyPct order', () => {
    for (const prop of [property(), undefined]) {
      expect(deriveConflicts(saleDeal(), prop).map((c) => c.fieldKey)).toEqual([
        'askingPrice',
        'noi',
        'occupancyPct',
      ])
    }
  })

  it('derives occupancy only for a Lease — its editor hides Financials, so an asking-price or NOI conflict would be unresolvable', () => {
    for (const prop of [property(), undefined]) {
      const conflicts = deriveConflicts(leaseDeal(), prop)
      expect(conflicts.map((c) => c.fieldKey)).toEqual(['occupancyPct'])
    }
  })

  it('lets a Lease run reach all-resolved from the one field it can edit', () => {
    let ing = {
      ...startIngestionState(['Rent Roll.xlsx']),
      conflicts: deriveConflicts(leaseDeal(), property()),
    }
    expect(unresolvedCount(ing)).toBe(1)
    ing = resolveConflict(ing, 'occupancyPct', 'doc')
    expect(allResolved(ing)).toBe(true)
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

// ── Store actions ───────────────────────────────────────────────────────────
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { useDataStore } from './dataStore'
import { generateDataset } from './seed'
import { publishReadiness } from './stageGates'
import { emptyDraft } from './createListing'
import {
  createDeal,
  finishIngestion,
  resolveIngestionConflict,
  advanceIngestion,
  dismissIngestion,
} from './actions'

function hydrate() {
  const ds = generateDataset()
  useDataStore.setState({
    properties: new Map(ds.properties.map((p) => [p.id, p])),
    listings: new Map(ds.listings.map((l) => [l.id, l])),
    contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    tasks: new Map(),
  } as never)
}

/** A deal created the way the modal creates one with files attached. */
function createDealWithFiles(dealType: Listing['dealType'] = 'Sale') {
  const property = [...useDataStore.getState().properties.values()][0]
  const { deal } = createDeal({
    ...emptyDraft(),
    dealType,
    dealSide: 'seller',
    propertyId: property.id,
    initialStage: 'proposal',
    documents: [
      { id: 'f1', name: 'T-12.pdf', uploadedAt: new Date().toISOString() },
      { id: 'f2', name: 'Rent Roll.xlsx', uploadedAt: new Date().toISOString() },
    ],
    ingestion: startIngestionState(['T-12.pdf', 'Rent Roll.xlsx']),
  })
  return deal
}

function current(dealId: string) {
  return useDataStore.getState().listings.get(dealId)!
}

describe('ingestion actions', () => {
  beforeEach(hydrate)

  it('creates the deal already processing at stage 0', () => {
    const deal = createDealWithFiles()
    expect(current(deal.id).ingestion?.status).toBe('processing')
    expect(current(deal.id).ingestion?.stage).toBe(0)
  })

  it('advanceIngestion walks the stages and is a no-op once finished', () => {
    const deal = createDealWithFiles()
    advanceIngestion(deal.id)
    expect(current(deal.id).ingestion?.stage).toBe(1)
    finishIngestion(deal.id)
    const stageAfterFinish = current(deal.id).ingestion?.stage
    advanceIngestion(deal.id)
    expect(current(deal.id).ingestion?.stage).toBe(stageAfterFinish)
  })

  it('finishIngestion lands needs-review with conflicts and a filled count', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const ing = current(deal.id).ingestion!
    expect(ing.status).toBe('needs-review')
    expect(ing.conflicts).toHaveLength(3)
    expect(ing.filledCount).toBeGreaterThan(0)
  })

  it('withholds the disputed asking price so the deal is not publish-ready', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    expect(publishReadiness(current(deal.id)).missing).toContain('askingPrice')
  })

  it('fills the non-disputed gate fields even while conflicts are open', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const missing = publishReadiness(current(deal.id)).missing
    expect(missing).not.toContain('saleTitle')
    expect(missing).not.toContain('saleDescription')
    expect(missing).not.toContain('listedOnDate')
  })

  it('resolveIngestionConflict writes the picked value', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const priceConflict = current(deal.id).ingestion!.conflicts.find(
      (c) => c.fieldKey === 'askingPrice',
    )!

    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')
    expect(current(deal.id).financials.askingPrice).toBe(priceConflict.docRaw)
    expect(current(deal.id).ingestion?.status).toBe('needs-review')
  })

  it('writes an occupancy pick through to the property record', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const occConflict = current(deal.id).ingestion!.conflicts.find(
      (c) => c.fieldKey === 'occupancyPct',
    )!

    resolveIngestionConflict(deal.id, 'occupancyPct', 'doc')
    const property = useDataStore.getState().properties.get(current(deal.id).propertyId)!
    expect(property.occupancyPct).toBe(occConflict.docRaw)
  })

  it('flips to complete on the last resolution, leaving only the doc review outstanding', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')
    resolveIngestionConflict(deal.id, 'noi', 'current')
    resolveIngestionConflict(deal.id, 'occupancyPct', 'doc')

    expect(current(deal.id).ingestion?.status).toBe('complete')
    expect(publishReadiness(current(deal.id)).missing).toEqual(['aiDocsReviewed'])
  })

  it('raises only the resolvable occupancy conflict on a Lease', () => {
    const deal = createDealWithFiles('Lease')
    finishIngestion(deal.id)
    const ing = current(deal.id).ingestion!
    expect(ing.status).toBe('needs-review')
    expect(ing.conflicts.map((c) => c.fieldKey)).toEqual(['occupancyPct'])
  })

  it('lets a Lease run reach complete, so its banner is never stuck', () => {
    const deal = createDealWithFiles('Lease')
    finishIngestion(deal.id)
    resolveIngestionConflict(deal.id, 'occupancyPct', 'doc')
    expect(current(deal.id).ingestion?.status).toBe('complete')
  })

  it('dismissIngestion clears the run off the deal', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    dismissIngestion(deal.id)
    expect(current(deal.id).ingestion).toBeUndefined()
  })

  it('leaves a deal created without files alone', () => {
    const property = [...useDataStore.getState().properties.values()][0]
    const { deal } = createDeal({
      ...emptyDraft(),
      dealType: 'Sale',
      dealSide: 'seller',
      propertyId: property.id,
      initialStage: 'proposal',
    })
    expect(current(deal.id).ingestion).toBeUndefined()
    finishIngestion(deal.id)
    expect(current(deal.id).ingestion).toBeUndefined()
  })
})
