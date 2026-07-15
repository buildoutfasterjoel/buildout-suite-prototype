import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import {
  createCallList,
  createContact,
  createDeal,
  createEmailDraft,
  linkContactToDeal,
  unlinkContactFromDeal,
  updateDeal,
  updateDealMarketing,
  updateDealStage,
} from './actions'
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

  it('updateDealMarketing merges the marketing patch and preserves other fields', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const before = deal.marketing.propertyUse
    const { deal: updated } = updateDealMarketing(deal.id, { saleTitle: 'New Headline' })
    expect(updated?.marketing.saleTitle).toBe('New Headline')
    // Unpatched marketing fields are preserved.
    expect(updated?.marketing.propertyUse).toBe(before)
    // The store reflects the change.
    expect(useDataStore.getState().listings.get(deal.id)?.marketing.saleTitle).toBe('New Headline')
  })

  it('updateDeal merges top-level deal fields', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const { deal: updated } = updateDeal(deal.id, { dealType: 'Sale / Lease' })
    expect(updated?.dealType).toBe('Sale / Lease')
    expect(useDataStore.getState().listings.get(deal.id)?.dealType).toBe('Sale / Lease')
  })

  it('createDeal inserts the new listing into the store', () => {
    const draft = { ...emptyDraft(), name: 'Test Deal', address: '123 Test St' }
    const { deal } = createDeal(draft)
    expect(useDataStore.getState().listings.has(deal.id)).toBe(true)
  })

  it('createEmailDraft prepends a draft campaign to the store', () => {
    const before = useDataStore.getState().emails.size
    const { email } = createEmailDraft({ subject: 'Price Reduction', list: 'Investors' })
    const emails = useDataStore.getState().emails
    expect(emails.size).toBe(before + 1)
    expect(emails.get(email.id)?.status).toBe('draft')
    // Prepended: the new draft is the first entry.
    expect([...emails.keys()][0]).toBe(email.id)
  })

  it('createCallList stores a list with the given membership snapshot', () => {
    const contactIds = [...useDataStore.getState().contacts.keys()].slice(0, 3)
    const { callList } = createCallList({ name: 'Cold prospects', contactIds })
    const stored = useDataStore.getState().callLists.get(callList.id)
    expect(stored?.label).toBe('Cold prospects')
    expect(stored?.contactIds).toEqual(contactIds)
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

  it('createContact inserts a lightweight contact into the store', () => {
    const before = useDataStore.getState().contacts.size
    const { contact } = createContact({ firstName: 'Dana', lastName: 'Reed', company: 'Reed Holdings' })
    const stored = useDataStore.getState().contacts.get(contact.id)
    expect(useDataStore.getState().contacts.size).toBe(before + 1)
    expect(stored?.firstName).toBe('Dana')
    expect(stored?.company).toBe('Reed Holdings')
    expect(stored?.role).toBe('owner') // default role
    expect(stored?.propertyIds).toEqual([])
  })
})
