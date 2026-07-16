import { describe, expect, it } from 'vitest'
import {
  dealStageFromStatus,
  deriveRelationship,
  furthestDealStage,
  reconcileContactDealFields,
} from './contactStage'
import type { Contact, Listing } from './types'

/** Minimal Contact stub — only the fields the reconciler reads/writes matter. */
function contact(id: string, over: Partial<Contact> = {}): Contact {
  return {
    id,
    firstName: 'A',
    lastName: 'B',
    relationship: 'cold',
    side: null,
    dealStage: null,
    ...over,
  } as Contact
}

/** Minimal Listing stub with just a status and its party arrays. */
function listing(
  status: Listing['status'],
  parties: { seller?: string[]; buyer?: string[] } = {},
): Listing {
  return {
    status,
    sellerContactIds: parties.seller ?? [],
    buyerContactIds: parties.buyer ?? [],
    otherContactIds: [],
  } as unknown as Listing
}

describe('dealStageFromStatus', () => {
  it('maps listing status to the contact-facing deal stage', () => {
    expect(dealStageFromStatus('proposal')).toBe('pitching')
    expect(dealStageFromStatus('active')).toBe('active')
    expect(dealStageFromStatus('under-contract')).toBe('under_contract')
    expect(dealStageFromStatus('closed')).toBe('closed')
  })

  it('treats Lost (inactive) as off-ladder', () => {
    expect(dealStageFromStatus('inactive')).toBeNull()
  })
})

describe('furthestDealStage', () => {
  it('returns null when the contact has no active deals', () => {
    expect(furthestDealStage([])).toBeNull()
  })

  it('picks the stage furthest along the ladder', () => {
    // The reported case: a contact with Active + Under Contract deals.
    expect(furthestDealStage(['active', 'under_contract'])).toBe('under_contract')
    expect(furthestDealStage(['pitching', 'active'])).toBe('active')
    expect(furthestDealStage(['closed', 'active'])).toBe('closed')
    expect(furthestDealStage(['pitching'])).toBe('pitching')
  })
})

describe('deriveRelationship', () => {
  it('is a Client when a deal is live (active or under contract)', () => {
    // The reported case: Active + Under Contract → Client.
    expect(deriveRelationship('cold', ['active', 'under_contract'])).toBe('client')
    expect(deriveRelationship('pitching', ['active'])).toBe('client')
    // A live deal wins over a past closed one.
    expect(deriveRelationship('cold', ['closed', 'active'])).toBe('client')
  })

  it('is Pitching when only pitching deals are open', () => {
    expect(deriveRelationship('cold', ['pitching'])).toBe('pitching')
  })

  it('is a Past Client when every deal has closed', () => {
    expect(deriveRelationship('cold', ['closed'])).toBe('past_client')
    expect(deriveRelationship('cold', ['closed', 'closed'])).toBe('past_client')
  })

  it('keeps the relationship temperature when there are no deals', () => {
    expect(deriveRelationship('cold', [])).toBe('cold')
    expect(deriveRelationship('nurturing', [])).toBe('nurturing')
    // A dealless contact can't be pitching/client/past_client — coerce to nurturing.
    expect(deriveRelationship('client', [])).toBe('nurturing')
    expect(deriveRelationship('past_client', [])).toBe('nurturing')
  })
})

describe('reconcileContactDealFields', () => {
  it('returns only the contacts whose derived fields changed', () => {
    const seller = contact('seller', { relationship: 'cold', dealStage: null })
    const bystander = contact('bystander', { relationship: 'nurturing' })
    const changed = reconcileContactDealFields(
      [seller, bystander],
      [listing('proposal', { seller: ['seller'] })],
    )
    expect(changed).toHaveLength(1)
    expect(changed[0].id).toBe('seller')
    expect(changed[0]).toMatchObject({
      dealStage: 'pitching',
      relationship: 'pitching',
      side: 'seller',
    })
  })

  it('advances a party when their deal moves stage (mid-session lifecycle)', () => {
    const buyer = contact('buyer', { relationship: 'pitching', dealStage: 'pitching' })
    // The deal has progressed to Under Contract.
    const [next] = reconcileContactDealFields(
      [buyer],
      [listing('under-contract', { buyer: ['buyer'] })],
    )
    expect(next).toMatchObject({
      dealStage: 'under_contract',
      relationship: 'client',
      side: 'buyer',
    })
  })

  it('drops a contact back to a temperature when their only deal is lost', () => {
    const seller = contact('seller', { relationship: 'client', dealStage: 'active', side: 'seller' })
    const [next] = reconcileContactDealFields(
      [seller],
      [listing('inactive', { seller: ['seller'] })],
    )
    expect(next).toMatchObject({
      dealStage: null,
      relationship: 'nurturing',
      side: null,
    })
  })
})
