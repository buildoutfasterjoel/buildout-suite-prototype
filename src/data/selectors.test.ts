import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import { listContactsForDeal, listDealsForContact } from './selectors'

describe('reverse-relationship selectors', () => {
  it('listContactsForDeal and listDealsForContact are consistent', () => {
    const listing = [...useDataStore.getState().listings.values()].find(
      (l) => l.sellerContactIds.length + l.buyerContactIds.length > 0,
    )!
    const contactId = [...listing.sellerContactIds, ...listing.buyerContactIds][0]
    expect(listContactsForDeal(listing.id).map((c) => c.id)).toContain(contactId)
    expect(listDealsForContact(contactId).map((l) => l.id)).toContain(listing.id)
  })
})
