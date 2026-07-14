import { useDataStore } from './dataStore'
import { createProposalListing, type NewListingDraft } from './createListing'
import { makeEmailDraft, type Email, type NewEmailDraft } from './emails'
import type { CallList } from './contactLists'
import {
  serializeContactFilters,
  type ContactFilterState,
} from '#/components/contacts/contactFilterModel'
import type { Listing, PropertyStatus } from './types'

let _callListSeq = 0

function patchListing(dealId: string, patch: (l: Listing) => Listing): Listing | null {
  const existing = useDataStore.getState().listings.get(dealId)
  if (!existing) return null
  const updated = patch(existing)
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    listings.set(dealId, updated)
    return { listings }
  })
  useDataStore.getState().persist()
  return updated
}

/** Create a proposal-stage deal (1:1 with a listing) from the New Deal flow. */
export function createDeal(draft: NewListingDraft): { deal: Listing } {
  // createProposalListing already inserts the listing (and its property) into the store.
  const deal = createProposalListing(draft)
  return { deal }
}

export function updateDealStage(
  dealId: string,
  status: PropertyStatus,
): { deal: Listing | null } {
  return { deal: patchListing(dealId, (l) => ({ ...l, status, updatedAt: new Date().toISOString() })) }
}

export function linkContactToDeal(
  dealId: string,
  contactId: string,
  role: 'seller' | 'buyer' | 'other',
): { deal: Listing | null } {
  const key =
    role === 'seller' ? 'sellerContactIds' : role === 'buyer' ? 'buyerContactIds' : 'otherContactIds'
  return {
    deal: patchListing(dealId, (l) =>
      l[key].includes(contactId) ? l : { ...l, [key]: [...l[key], contactId] },
    ),
  }
}

/**
 * Create a draft email campaign and prepend it to the store so it appears at the
 * top of the Email module. Persists via the single write path.
 */
export function createEmailDraft(input: NewEmailDraft): { email: Email } {
  const email = makeEmailDraft(input)
  useDataStore.setState((s) => {
    const emails = new Map<string, Email>([[email.id, email]])
    for (const [id, e] of s.emails) emails.set(id, e)
    return { emails }
  })
  useDataStore.getState().persist()
  return { email }
}

/**
 * Create a user/AI contact "call list" from a membership snapshot and store it so
 * it appears in the People module's lists. Persists via the single write path.
 */
export function createCallList(input: {
  name: string
  contactIds: string[]
  description?: string
  source?: 'user' | 'ai'
  color?: string
}): { callList: CallList } {
  _callListSeq += 1
  const callList: CallList = {
    id: `calllist-${Date.now()}-${_callListSeq}`,
    label: input.name,
    description: input.description ?? `${input.contactIds.length} contacts`,
    createdOn: new Date().toISOString().slice(0, 10),
    contactIds: [...input.contactIds],
    source: input.source ?? 'user',
    type: 'static',
    color: input.color,
  }
  useDataStore.setState((s) => {
    const callLists = new Map(s.callLists)
    callLists.set(callList.id, callList)
    return { callLists }
  })
  useDataStore.getState().persist()
  return { callList }
}

/**
 * Create a dynamic list from a filter set. Membership is evaluated live from the
 * saved criteria (no `contactIds` snapshot) — see {@link callListPredicate}.
 */
export function createDynamicList(input: {
  name: string
  filters: ContactFilterState
  description?: string
  color?: string
}): { callList: CallList } {
  _callListSeq += 1
  const callList: CallList = {
    id: `calllist-${Date.now()}-${_callListSeq}`,
    label: input.name,
    description: input.description ?? '',
    createdOn: new Date().toISOString().slice(0, 10),
    contactIds: [],
    source: 'user',
    type: 'dynamic',
    filters: serializeContactFilters(input.filters),
    color: input.color,
  }
  useDataStore.setState((s) => {
    const callLists = new Map(s.callLists)
    callLists.set(callList.id, callList)
    return { callLists }
  })
  useDataStore.getState().persist()
  return { callList }
}

/** Replace a dynamic list's saved filter criteria (the "Save Filters" action). */
export function updateCallListFilters(
  id: string,
  filters: ContactFilterState,
): void {
  useDataStore.setState((s) => {
    const existing = s.callLists.get(id)
    if (!existing) return {}
    const callLists = new Map(s.callLists)
    callLists.set(id, { ...existing, filters: serializeContactFilters(filters) })
    return { callLists }
  })
  useDataStore.getState().persist()
}

/** Remove a user/dynamic list from the store. */
export function removeCallList(id: string): void {
  useDataStore.setState((s) => {
    if (!s.callLists.has(id)) return {}
    const callLists = new Map(s.callLists)
    callLists.delete(id)
    return { callLists }
  })
  useDataStore.getState().persist()
}

/** Add contacts to a static list's membership snapshot (union, no duplicates). */
export function addContactsToCallList(id: string, contactIds: string[]): void {
  useDataStore.setState((s) => {
    const existing = s.callLists.get(id)
    if (!existing) return {}
    const merged = new Set(existing.contactIds)
    for (const cid of contactIds) merged.add(cid)
    const callLists = new Map(s.callLists)
    callLists.set(id, { ...existing, contactIds: [...merged] })
    return { callLists }
  })
  useDataStore.getState().persist()
}

/** Remove contacts from a static list's membership snapshot. */
export function removeContactsFromCallList(
  id: string,
  contactIds: string[],
): void {
  useDataStore.setState((s) => {
    const existing = s.callLists.get(id)
    if (!existing) return {}
    const drop = new Set(contactIds)
    const callLists = new Map(s.callLists)
    callLists.set(id, {
      ...existing,
      contactIds: existing.contactIds.filter((cid) => !drop.has(cid)),
    })
    return { callLists }
  })
  useDataStore.getState().persist()
}

export function unlinkContactFromDeal(dealId: string, contactId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      sellerContactIds: l.sellerContactIds.filter((id) => id !== contactId),
      buyerContactIds: l.buyerContactIds.filter((id) => id !== contactId),
      otherContactIds: l.otherContactIds.filter((id) => id !== contactId),
    })),
  }
}
