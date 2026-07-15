import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import {
  createCallList,
  commitStageTransition,
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
import { setNotifier } from '#/lib/notify'

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

  it('createDeal starts unpublished with AI-generated starter documents', () => {
    const draft = { ...emptyDraft(), name: 'Gate Test', address: '9 Gate St' }
    const { deal } = createDeal(draft)
    // A brand-new proposal is not published.
    expect(deal.publishedAt).toBeNull()
    // The auto-generated starter docs are flagged so the publish gate can require review.
    expect(deal.documents?.length ?? 0).toBeGreaterThan(0)
    expect(deal.documents?.every((d) => d.aiGenerated === true)).toBe(true)
  })

  it('commitStageTransition publishes on Pitching → Active and logs history', () => {
    const draft = { ...emptyDraft(), name: 'Commit Test', address: '11 Commit Ave' }
    const { deal } = createDeal(draft)
    const seller = [...useDataStore.getState().contacts.values()][0]
    const before = deal.history.length

    const { deal: updated } = commitStageTransition({
      dealId: deal.id,
      targetStage: 'active',
      actor: 'Jane Broker',
      dealSide: 'seller',
      sellerContactId: seller.id,
      transaction: { listedOnDate: '2026-07-01', listingExpirationDate: '2026-12-31' },
      publish: true,
    })

    expect(updated?.status).toBe('active')
    expect(updated?.publishedAt).not.toBeNull()
    expect(updated?.dealSide).toBe('seller')
    expect(updated?.sellerContactIds).toContain(seller.id)
    expect(updated?.transaction.listedOnDate).toBe('2026-07-01')
    expect(updated?.history.length).toBe(before + 1)
    expect(updated?.history.at(-1)).toMatchObject({ fromStage: 'proposal', toStage: 'active' })
  })

  it('commitStageTransition clears publishedAt when unpublishing on a backward move', () => {
    const draft = { ...emptyDraft(), name: 'Unpublish Test', address: '12 Back St' }
    const { deal } = createDeal(draft)
    // Get it live first.
    commitStageTransition({ dealId: deal.id, targetStage: 'active', actor: 'Jane', publish: true })
    // Move back to Pitching and unpublish.
    const { deal: back } = commitStageTransition({
      dealId: deal.id,
      targetStage: 'proposal',
      actor: 'Jane',
      unpublish: true,
    })
    expect(back?.status).toBe('proposal')
    expect(back?.publishedAt).toBeNull()
  })

  it('commitStageTransition notifies on every successful move', () => {
    const items: { title: string; description?: string }[] = []
    setNotifier((i) => items.push(i))
    try {
      const { deal } = createDeal({ ...emptyDraft(), name: 'Notify Test', address: '3 Bell Rd' })
      // A non-publishing move announces the target stage.
      commitStageTransition({ dealId: deal.id, targetStage: 'under-contract', actor: 'Jane' })
      expect(items.at(-1)?.title).toBe('Moved to Under Contract')
      // A publishing move announces the publish.
      commitStageTransition({ dealId: deal.id, targetStage: 'active', actor: 'Jane', publish: true })
      expect(items.at(-1)?.title).toBe('Listing published')
    } finally {
      setNotifier(null)
    }
  })
})
