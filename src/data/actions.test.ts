import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { createDeal, linkContactToDeal, unlinkContactFromDeal, updateDealStage } from './actions'
import { emptyDraft } from './createListing'
import { listContactsForDeal } from './selectors'

describe('actions', () => {
  it('linkContactToDeal attaches a contact and shows in the reverse selector', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const contact = [...useDataStore.getState().contacts.values()][0]
    linkContactToDeal(deal.id, contact.id, 'other')
    expect(listContactsForDeal(deal.id).map((c) => c.id)).toContain(contact.id)
  })

  it('updateDealStage changes the deal status', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const { deal: updated } = updateDealStage(deal.id, 'closed')
    expect(updated?.status).toBe('closed')
  })

  it('createDeal inserts the new listing into the store', () => {
    const draft = { ...emptyDraft(), name: 'Test Deal', address: '123 Test St' }
    const { deal } = createDeal(draft)
    expect(useDataStore.getState().listings.has(deal.id)).toBe(true)
  })

  it('unlinkContactFromDeal removes the contact from every contact-role list', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const contact = [...useDataStore.getState().contacts.values()][0]
    linkContactToDeal(deal.id, contact.id, 'buyer')
    unlinkContactFromDeal(deal.id, contact.id)
    const updated = useDataStore.getState().listings.get(deal.id)
    expect(updated?.sellerContactIds).not.toContain(contact.id)
    expect(updated?.buyerContactIds).not.toContain(contact.id)
    expect(updated?.otherContactIds).not.toContain(contact.id)
  })
})
