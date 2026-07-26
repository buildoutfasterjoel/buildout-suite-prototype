import { describe, expect, it } from 'vitest'
import { recommendDocsFromUploads } from './uploadIntelligence'
import type { DealDocument } from './types'
import { createDeal, updateDealFinancials, updateDealMarketing, updateDealTransaction } from './actions'
import { emptyDraft } from './createListing'
import { getListing, getProperty } from './store'
import { publishReadiness } from './stageGates'
import { buildPublishReadyPatch } from './uploadIntelligence'

function doc(name: string): DealDocument {
  return { id: name, name, uploadedAt: '2026-07-24T00:00:00.000Z' }
}

describe('recommendDocsFromUploads', () => {
  it('returns nothing for no files', () => {
    expect(recommendDocsFromUploads([])).toEqual([])
  })

  it('maps a rent roll to the rent roll plus marketing deliverables, in catalog order', () => {
    expect(recommendDocsFromUploads([doc('2026 Rent Roll.xlsx')])).toEqual([
      'om',
      'bov',
      'rent-roll',
    ])
  })

  it('maps a T-12 to financials it derives plus marketing deliverables', () => {
    expect(recommendDocsFromUploads([doc('T-12 Operating Statement.pdf')])).toEqual([
      'om',
      'bov',
      't12',
      'proforma',
      'noi',
    ])
  })

  it('maps a listing agreement without adding marketing deliverables', () => {
    expect(recommendDocsFromUploads([doc('Listing Agreement.pdf')])).toEqual([
      'listing-agreement',
    ])
  })

  it('unions recommendations across multiple files with no duplicates', () => {
    const result = recommendDocsFromUploads([
      doc('Rent Roll.xlsx'),
      doc('Signed Listing Agreement.pdf'),
    ])
    expect(result).toEqual(['om', 'bov', 'rent-roll', 'listing-agreement'])
  })
})

function applyPublishReadyPatch(dealId: string) {
  const deal = getListing(dealId)!
  const patch = buildPublishReadyPatch(deal, getProperty(deal.propertyId))
  updateDealMarketing(dealId, patch.marketing)
  updateDealTransaction(dealId, patch.transaction)
  updateDealFinancials(dealId, patch.financials)
}

describe('buildPublishReadyPatch', () => {
  it('makes a Sale deal publish-ready except for the AI-doc review', () => {
    const { deal } = createDeal({
      ...emptyDraft(),
      dealType: 'Sale',
      dealSide: 'seller',
      address: '500 Market St, Denver, CO',
    })
    applyPublishReadyPatch(deal.id)
    expect(publishReadiness(getListing(deal.id)!).missing).toEqual(['aiDocsReviewed'])
  })

  it('makes a Lease deal publish-ready except for the AI-doc review', () => {
    const { deal } = createDeal({
      ...emptyDraft(),
      dealType: 'Lease',
      dealSide: 'seller',
      address: '900 Broadway, Denver, CO',
    })
    applyPublishReadyPatch(deal.id)
    expect(publishReadiness(getListing(deal.id)!).missing).toEqual(['aiDocsReviewed'])
  })
})
