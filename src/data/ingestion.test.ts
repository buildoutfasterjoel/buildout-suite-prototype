import { describe, expect, it } from 'vitest'
import type { Listing, Property } from './types'
import {
  INGESTION_STAGES,
  advanceStage,
  allResolved,
  countCommittedFields,
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

/**
 * A brand-new deal typed in from an address: nothing on record yet. Paired with
 * {@link stubProperty}, this is what the app actually hands `deriveConflicts` on
 * the doc-vs-doc path — `property` is never `undefined` in the running app.
 */
function typedInDeal(overrides: Partial<Listing> = {}): Listing {
  return saleDeal({ financials: { askingPrice: 0, noi: 0 }, ...overrides } as Partial<Listing>)
}

/** The zeroed stub `createProposalListing` inserts for a typed-in address. */
function stubProperty(overrides: Partial<Property> = {}): Property {
  return property({ askingPrice: 0, occupancyPct: 0, buildingSqFt: 0, ...overrides })
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

  it('derives doc-vs-doc conflicts against the zeroed stub property a typed-in address gets', () => {
    // The app always has a property object — a stub with no price/occupancy on it
    // must NOT get fabricated figures credited to the "Property record".
    const conflicts = deriveConflicts(typedInDeal(), stubProperty())
    expect(conflicts).toHaveLength(3)
    for (const c of conflicts) {
      expect(c.currentSource).not.toBe('Property record')
      expect(c.currentSource).toMatch(/\.(pdf|xlsx)$/)
      expect(c.docSource).not.toBe(c.currentSource)
    }
  })

  it('mixes framings per field: record price is doc-vs-record while an empty occupancy is doc-vs-doc', () => {
    const conflicts = deriveConflicts(saleDeal(), stubProperty({ askingPrice: 6_500_000 }))
    const by = (k: string) => conflicts.find((c) => c.fieldKey === k)!
    expect(by('askingPrice').currentSource).toBe('Property record')
    expect(by('askingPrice').currentRaw).toBe(6_500_000)
    expect(by('noi').currentSource).toBe('Property record')
    expect(by('occupancyPct').currentSource).not.toBe('Property record')
  })

  it('keeps both sides valued and differing even for tiny record figures', () => {
    const deal = saleDeal({ financials: { askingPrice: 40_000, noi: 100 } } as Partial<Listing>)
    const conflicts = deriveConflicts(deal, stubProperty({ occupancyPct: 1 }))
    for (const c of conflicts) {
      expect(c.docRaw).not.toBe(c.currentRaw)
      expect(c.docRaw).toBeGreaterThan(0)
      expect(c.currentRaw).toBeGreaterThan(0)
    }
  })

  it('gives every conflict a non-empty value and differing sides', () => {
    for (const deal of [saleDeal(), leaseDeal(), typedInDeal()]) {
      for (const prop of [property(), stubProperty(), undefined]) {
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
    for (const prop of [property(), stubProperty(), undefined]) {
      expect(deriveConflicts(saleDeal(), prop).map((c) => c.fieldKey)).toEqual([
        'askingPrice',
        'noi',
        'occupancyPct',
      ])
    }
  })

  it('derives occupancy only for a Lease — its editor hides Financials, so an asking-price or NOI conflict would be unresolvable', () => {
    for (const prop of [property(), stubProperty(), undefined]) {
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
  it('commits the on-record value for an unresolved conflict, never an empty field', () => {
    const deal = saleDeal()
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, property()) }
    const priceConflict = ing.conflicts.find((c) => c.fieldKey === 'askingPrice')!
    const noiConflict = ing.conflicts.find((c) => c.fieldKey === 'noi')!
    const patch = ingestionPatch(deal, property(), ing)

    // The editor shows the figure the broker would be KEEPING — a bare 0 beside
    // the document's competing number read as a bug. Publish stays blocked via
    // seedGateForm, not by leaving the field empty (see the gate test below).
    expect(patch.financials.askingPrice).toBe(priceConflict.currentRaw)
    expect(patch.financials.noi).toBe(noiConflict.currentRaw)
    // Price/SF tracks whichever figure is committed.
    expect(patch.financials.pricePerSqFt).toBeGreaterThan(0)
    // Non-conflicting fields still land.
    expect(patch.marketing.saleTitle).toBeTruthy()
    expect(patch.transaction.listedOnDate).toBeTruthy()
  })

  it('never leaves a conflicted field at zero for any conflict set', () => {
    for (const deal of [saleDeal(), leaseDeal()]) {
      const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, property()) }
      const patch = ingestionPatch(deal, property(), ing)
      for (const c of ing.conflicts) {
        if (c.fieldKey === 'askingPrice') expect(patch.financials.askingPrice).toBeGreaterThan(0)
        if (c.fieldKey === 'noi') expect(patch.financials.noi).toBeGreaterThan(0)
        if (c.fieldKey === 'occupancyPct')
          expect(resolvedPropertyPatch(ing).occupancyPct).toBeGreaterThan(0)
      }
    }
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

  it('recomputes price per SF from the resolved asking price', () => {
    const deal = saleDeal()
    const prop = property()
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, prop) }
    const priceConflict = ing.conflicts.find((c) => c.fieldKey === 'askingPrice')!

    ing = resolveConflict(ing, 'askingPrice', 'doc')
    const patch = ingestionPatch(deal, prop, ing)
    expect(patch.financials.pricePerSqFt).toBe(
      Math.round((priceConflict.docRaw / prop.buildingSqFt) * 100) / 100,
    )
    // Not the figure derived from the price the broker just rejected.
    expect(patch.financials.pricePerSqFt).not.toBe(
      Math.round((priceConflict.currentRaw / prop.buildingSqFt) * 100) / 100,
    )
  })

  it('never emits a non-finite price per SF, even off a zeroed stub property', () => {
    const deal = typedInDeal()
    const prop = stubProperty()
    let ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(deal, prop) }
    ing = resolveConflict(ing, 'askingPrice', 'doc')
    const perSqFt = ingestionPatch(deal, prop, ing).financials.pricePerSqFt!
    expect(Number.isFinite(perSqFt)).toBe(true)
    expect(perSqFt).toBeGreaterThan(0)
  })

  it('writes back the on-record occupancy while it is unresolved', () => {
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: deriveConflicts(saleDeal(), property()) }
    const occ = ing.conflicts.find((c) => c.fieldKey === 'occupancyPct')!
    // A no-op value-wise, but it keeps the occupancy field showing what the
    // broker would be keeping rather than falling to an empty/zero state.
    expect(resolvedPropertyPatch(ing).occupancyPct).toBe(occ.currentRaw)
  })

  it('returns an empty property patch when there is no occupancy conflict', () => {
    const ing = { ...startIngestionState(['T-12.pdf']), conflicts: [] }
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

  it('countCommittedFields adds the property-side values a resolution wrote', () => {
    const patch = {
      marketing: { saleTitle: 'x' },
      transaction: {},
      financials: { askingPrice: 1 },
    }
    const settled = startIngestionState(['T-12.pdf'])
    expect(countCommittedFields(patch, {}, settled)).toBe(2)
    expect(countCommittedFields(patch, { occupancyPct: 88 }, settled)).toBe(3)
  })

  it('countCommittedFields discounts conflicts the broker has not settled', () => {
    // A realistic patch: five written fields with three conflicts outstanding.
    const patch = {
      marketing: { saleTitle: 'x', saleDescription: 'y' },
      transaction: { listedOnDate: '2026-07-29' },
      financials: { askingPrice: 1, noi: 2 },
    }
    let ing = {
      ...startIngestionState(['T-12.pdf']),
      conflicts: deriveConflicts(saleDeal(), property()),
    }
    expect(countCommittedFields(patch, { occupancyPct: 88 }, ing)).toBe(6 - 3)

    ing = resolveConflict(ing, 'askingPrice', 'doc')
    expect(countCommittedFields(patch, { occupancyPct: 88 }, ing)).toBe(6 - 2)

    ing = resolveConflict(ing, 'noi', 'current')
    ing = resolveConflict(ing, 'occupancyPct', 'doc')
    expect(countCommittedFields(patch, { occupancyPct: 88 }, ing)).toBe(6)
  })

  it('never reports a negative count', () => {
    const ing = {
      ...startIngestionState(['T-12.pdf']),
      conflicts: deriveConflicts(saleDeal(), property()),
    }
    // Three open conflicts against a patch that wrote nothing.
    expect(
      countCommittedFields({ marketing: {}, transaction: {}, financials: {} }, {}, ing),
    ).toBe(0)
  })
})

// ── Store actions ───────────────────────────────────────────────────────────
import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'
import { useDataStore } from './dataStore'
import { generateDataset } from './seed'
import { publishReadiness } from './stageGates'
import { emptyDraft } from './createListing'
import { updateProperty } from './store'
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

  it('blocks publish on a disputed asking price even though the field holds a value', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    // The field is populated — the broker sees the on-record figure, not a 0 —
    // and the gate STILL blocks, because a value they haven't confirmed isn't a
    // satisfied requirement. This is the seedGateForm override, and it's the only
    // thing keeping an unconfirmed conflict from publishing.
    expect(current(deal.id).financials.askingPrice).toBeGreaterThan(0)
    expect(publishReadiness(current(deal.id)).missing).toContain('askingPrice')
  })

  it('clears the publish block once the asking price is confirmed either way', () => {
    for (const side of ['doc', 'current'] as const) {
      hydrate()
      const deal = createDealWithFiles()
      finishIngestion(deal.id)
      resolveIngestionConflict(deal.id, 'askingPrice', side)
      expect(publishReadiness(current(deal.id)).missing).not.toContain('askingPrice')
    }
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

  it('does not revert a directly-edited occupancy when resolving an unrelated conflict', () => {
    // Regression: resolving any conflict used to write the property's occupancy
    // unconditionally, using the value `deriveConflicts` snapshotted when the
    // run finished. A broker who edited occupancy directly in between (e.g. a
    // Save on the Listing page) would see that edit silently reverted the next
    // time they resolved an unrelated conflict like Asking Price.
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    updateProperty(deal.propertyId, { occupancyPct: 87 })

    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')

    const property = useDataStore.getState().properties.get(deal.propertyId)!
    expect(property.occupancyPct).toBe(87)
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

  it('grows the filled count as conflicts are resolved, so the banner stays true', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const atFinish = current(deal.id).ingestion!.filledCount

    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')
    expect(current(deal.id).ingestion!.filledCount).toBeGreaterThan(atFinish)

    resolveIngestionConflict(deal.id, 'noi', 'current')
    resolveIngestionConflict(deal.id, 'occupancyPct', 'doc')
    // One per conflict settled. The conflicted fields already carry the on-record
    // value at finish, so what grows is the count of *confirmed* fields, not the
    // count of fields holding a number.
    expect(current(deal.id).ingestion!.filledCount).toBe(atFinish + 3)
  })

  it('does not count an unconfirmed conflict as a field the documents filled', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const ing = current(deal.id).ingestion!
    // Three conflicts are outstanding, so the banner's count must sit three below
    // the number of fields actually holding a value.
    expect(ing.conflicts.filter((c) => !c.resolution)).toHaveLength(3)
    expect(current(deal.id).financials.askingPrice).toBeGreaterThan(0)
    resolveIngestionConflict(deal.id, 'askingPrice', 'current')
    // Keeping the on-record value changes no number, but it IS a confirmation.
    expect(current(deal.id).ingestion!.filledCount).toBe(ing.filledCount + 1)
  })

  it('carries price per SF along with a resolved asking price', () => {
    const deal = createDealWithFiles()
    finishIngestion(deal.id)
    const before = current(deal.id).financials.pricePerSqFt
    resolveIngestionConflict(deal.id, 'askingPrice', 'doc')
    const after = current(deal.id)
    expect(after.financials.pricePerSqFt).not.toBe(before)
    expect(after.financials.pricePerSqFt).toBeGreaterThan(0)
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
