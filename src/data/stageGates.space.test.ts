import { describe, it, expect } from 'vitest'
import {
  resolveGate,
  canConfirm,
  publishReadiness,
  seedGateForm,
  buildTransitionInput,
  type GateFormState,
} from './stageGates'
import {
  commitStageTransition,
  updateDealMarketing,
  updateDealTransaction,
} from './actions'
import { createProposalListing, emptyDraft, emptySpaceLeaseTerms } from './createListing'
import { addPropertyUnit, addSpaceToDeal } from './leaseSpaces'
import { getListing } from './store'
import { dealShape } from './dealShape'

const EMPTY: GateFormState = {
  buyerLinked: false, listedOnDate: null, listingExpirationDate: null,
  contractExecutedDate: null, closeDate: null, salePrice: null,
  commissionAmount: null, commissionPct: null, deadReason: null,
  aiDocsAllReviewed: false, unpublishOnExit: true, buyerContactId: null,
  saleTitle: '', saleDescription: '', askingPrice: null,
  tenantLinked: false, tenantContactId: null,
  leaseRate: null, leaseRateUnits: 'SF/Yr', availableSqFt: null,
  leaseTermMonths: null, leaseCommencementDate: null, shellActive: false,
}

describe('space deal Approve & Publish gate', () => {
  const gate = resolveGate('proposal', 'active', 'Lease', 'space')

  it('gates on the space own numbers and nothing else', () => {
    expect(gate.required).toEqual(['leaseRate', 'availableSqFt', 'leaseTermMonths'])
  })

  it('does not require property-level fields the space cannot own', () => {
    for (const f of ['saleTitle', 'saleDescription', 'aiDocsReviewed', 'listedOnDate', 'listingExpirationDate']) {
      expect(gate.required).not.toContain(f)
    }
  })

  /**
   * The building publishes the website, documents and campaigns; a space
   * publishes its own availability. Those are different acts, so the parent's
   * stage must not gate the child: once a shell's spaces carry the terms, the
   * shell structurally cannot hold them, and blocking every space on the
   * building's marketing content left a suite with no way to go live.
   */
  it('does not gate on the building stage', () => {
    expect(gate.required).not.toContain('shellActive')
  })

  it('confirms on the space own numbers alone, whatever the building is doing', () => {
    const priced = { ...EMPTY, leaseRate: 28, availableSqFt: 4200, leaseTermMonths: 60 }
    expect(canConfirm(gate, priced)).toBe(true)
  })

  it('still blocks when one of the space own numbers is missing', () => {
    const priced = { ...EMPTY, leaseRate: 28, availableSqFt: 4200, leaseTermMonths: 60 }
    expect(canConfirm(gate, { ...priced, leaseRate: null })).toBe(false)
    expect(canConfirm(gate, { ...priced, availableSqFt: null })).toBe(false)
    expect(canConfirm(gate, { ...priced, leaseTermMonths: null })).toBe(false)
  })
})

describe('shell Approve & Publish gate', () => {
  const gate = resolveGate('proposal', 'active', 'Lease', 'shell')

  it('gates on the building marketing content only', () => {
    expect(gate.required).toEqual([
      'saleTitle',
      'saleDescription',
      'aiDocsReviewed',
      'listedOnDate',
      'listingExpirationDate',
    ])
  })

  it('never asks a shell for a rate or an available SF it cannot hold', () => {
    expect(gate.required).not.toContain('leaseRate')
    expect(gate.required).not.toContain('availableSqFt')
  })

  it('is satisfiable from the content fields alone', () => {
    const filled: GateFormState = {
      ...EMPTY,
      saleTitle: 'Grandview Commons',
      saleDescription: 'Two-level retail centre on the square.',
      aiDocsAllReviewed: true,
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    expect(canConfirm(gate, filled)).toBe(true)
  })

  /**
   * The regression that killed the whole flow: once every priced row has moved
   * to a child deal the shell holds `spaceLeaseTerms: []`, so a gate that asked
   * for a rate could never be satisfied — and no space could ever publish.
   */
  it('a shell whose terms rows all moved to children can still publish', () => {
    const parent = createProposalListing({
      ...emptyDraft(),
      name: 'Grandview Commons',
      dealType: 'Lease',
    })
    const unit = addPropertyUnit(parent.propertyId, {
      label: 'Suite 200',
      sqft: 4200,
      unitType: 'retail',
    })!
    // Price the unit on the parent first, so the row genuinely MOVES on promote.
    updateDealMarketing(parent.id, {
      spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unit.id), leaseRate: 28 }],
      availableSqFt: 4200,
      leaseTitle: 'Grandview Commons',
      leaseDescription: 'Two-level retail centre on the square.',
    })
    updateDealTransaction(parent.id, {
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    })
    addSpaceToDeal(parent.id, unit.id)

    const shell = getListing(parent.id)!
    expect(dealShape(shell)).toBe('shell')
    expect(shell.marketing.spaceLeaseTerms).toEqual([])

    // Nothing structurally unreachable is left outstanding: the rate and the SF
    // are gone from the requirement list, and the only gap is the doc-review
    // attestation, which the broker ticks inside the modal.
    const readiness = publishReadiness(shell, { shape: 'shell' })
    expect(readiness.missing).not.toContain('leaseRate')
    expect(readiness.missing).not.toContain('availableSqFt')
    expect(readiness.missing).toEqual(['aiDocsReviewed'])

    const gate = resolveGate('proposal', 'active', 'Lease', 'shell')
    const form = seedGateForm(shell)
    expect(canConfirm(gate, form)).toBe(false)

    // Follow it all the way through the commit, not just to `canConfirm`. The
    // gate's own transition input used to set `leaseRateUnits` unconditionally
    // for every lease deal, which flipped `hasLeaseTerms` in
    // `commitStageTransition` and synthesised a phantom `spaceLeaseTerms[0]`
    // keyed to the sentinel unit `'whole-property'` — quietly destroying the
    // very invariant this gate depends on.
    const approved = { ...form, aiDocsAllReviewed: true }
    expect(canConfirm(gate, approved)).toBe(true)
    commitStageTransition(
      buildTransitionInput(gate, approved, shell.id, 'Tester', 'Lease'),
    )

    const published = getListing(parent.id)!
    expect(published.status).toBe('active')
    expect(published.publishedAt).not.toBeNull()
    expect(published.marketing.spaceLeaseTerms).toEqual([])
    expect(dealShape(published)).toBe('shell')
  })
})

/**
 * The shapes whose gates DO own a rate must still write it on publish — the
 * fix above narrows the lease block, so this is the byte-for-byte counterpart.
 */
describe('publishing still writes lease terms for the shapes that own them', () => {
  it('writes rate, units and available SF for a flat lease deal', () => {
    const gate = resolveGate('proposal', 'active', 'Lease', 'flat-lease')
    const form: GateFormState = {
      ...EMPTY,
      saleTitle: 'Whole Building',
      saleDescription: 'Single-tenant industrial.',
      aiDocsAllReviewed: true,
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
      leaseRate: 18.5,
      leaseRateUnits: 'SF/Yr',
      availableSqFt: 30_000,
    }
    const input = buildTransitionInput(gate, form, 'd1', 'Tester', 'Lease')
    expect(input.leaseRate).toBe(18.5)
    expect(input.leaseRateUnits).toBe('SF/Yr')
    expect(input.availableSqFt).toBe(30_000)
  })

  it('writes them for a space deal too', () => {
    const gate = resolveGate('proposal', 'active', 'Lease', 'space')
    const form: GateFormState = {
      ...EMPTY,
      leaseRate: 28,
      leaseRateUnits: 'SF/Mo',
      availableSqFt: 4200,
      leaseTermMonths: 60,
      shellActive: true,
    }
    const input = buildTransitionInput(gate, form, 'd2', 'Tester', 'Lease')
    expect(input.leaseRate).toBe(28)
    expect(input.leaseRateUnits).toBe('SF/Mo')
    expect(input.availableSqFt).toBe(4200)
  })

  it('writes none of them for a shell, not even the units', () => {
    const gate = resolveGate('proposal', 'active', 'Lease', 'shell')
    const form: GateFormState = {
      ...EMPTY,
      saleTitle: 'Grandview Commons',
      saleDescription: 'Two-level retail centre.',
      aiDocsAllReviewed: true,
      listedOnDate: '2026-07-01',
      listingExpirationDate: '2026-12-31',
    }
    const input = buildTransitionInput(gate, form, 'd3', 'Tester', 'Lease')
    expect(input.leaseRate).toBeUndefined()
    // The unconditional one — it alone flips `hasLeaseTerms`.
    expect(input.leaseRateUnits).toBeUndefined()
    expect(input.availableSqFt).toBeUndefined()
    // And a shell is still a lease deal, so it must not fall through to the
    // sale branch and write an asking price either.
    expect(input.financials).toBeUndefined()
  })
})

describe('other shapes are unchanged', () => {
  // Exact, not `toContain`: a future edit that ADDS a required field to either
  // of these gates is a behaviour change and should fail here, loudly.
  it('leaves a flat lease deal on the original publish gate', () => {
    const g = resolveGate('proposal', 'active', 'Lease', 'flat-lease')
    expect(g.required).toEqual([
      'saleTitle',
      'saleDescription',
      'leaseRate',
      'availableSqFt',
      'aiDocsReviewed',
      'listedOnDate',
      'listingExpirationDate',
    ])
  })

  it('leaves a sale deal on the asking-price publish gate', () => {
    const g = resolveGate('proposal', 'active', 'Sale', 'sale')
    expect(g.required).toEqual([
      'saleTitle',
      'saleDescription',
      'askingPrice',
      'aiDocsReviewed',
      'listedOnDate',
      'listingExpirationDate',
    ])
  })

  it('defaults the shape from dealType when the argument is omitted', () => {
    expect(resolveGate('proposal', 'active', 'Lease').required)
      .toEqual(resolveGate('proposal', 'active', 'Lease', 'flat-lease').required)
  })
})
