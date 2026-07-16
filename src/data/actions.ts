import { useDataStore } from './dataStore'
import { createProposalListing, type NewListingDraft } from './createListing'
import { makeEmailDraft, type Email, type NewEmailDraft } from './emails'
import type { CallList } from './contactLists'
import {
  serializeContactFilters,
  type ContactFilterState,
} from '#/components/contacts/contactFilterModel'
import type { Contact, ContactRole, DealHistoryEntry, DealMarketing, DealTransaction, Listing, PropertyStatus } from './types'
import { STAGE_LABEL, type StageTransitionInput } from './stageGates'
import { reconcileContactDealFields } from './contactStage'
import { notify } from '#/lib/notify'

let _callListSeq = 0

/**
 * Re-derive every contact's deal-derived fields (stage, relationship, side) from
 * the current listings and patch the ones that moved. Called after any deal
 * mutation that changes a deal's status or its linked parties, so the People
 * module stays in lockstep with the pipeline through a full deal lifecycle.
 */
export function reconcileContactStages(): void {
  useDataStore.setState((s) => {
    const changed = reconcileContactDealFields(
      s.contacts.values(),
      s.listings.values(),
    )
    if (changed.length === 0) return {}
    const contacts = new Map(s.contacts)
    for (const c of changed) contacts.set(c.id, c)
    return { contacts }
  })
  useDataStore.getState().persist()
}

function patchListing(dealId: string, patch: (l: Listing) => Listing): Listing | null {
  const existing = useDataStore.getState().listings.get(dealId)
  if (!existing) return null
  const updated = patch(existing)
  useDataStore.setState((s) => {
    const listings = new Map(s.listings)
    listings.set(dealId, updated)
    return { listings }
  })
  // Keep contacts' deal-derived fields in lockstep with the deal graph. This
  // single write path covers every stage move and contact (un)link; the scan is
  // cheap at prototype scale and a no-op when nothing moved.
  reconcileContactStages()
  useDataStore.getState().persist()
  return updated
}

/** Create a proposal-stage deal (1:1 with a listing) from the New Deal flow. */
export function createDeal(draft: NewListingDraft): { deal: Listing } {
  // createProposalListing already inserts the listing (and its property) into the store.
  const deal = createProposalListing(draft)
  // A new proposal deal puts its linked parties into Pitching — reconcile so the
  // People module reflects it immediately.
  reconcileContactStages()
  return { deal }
}

export function updateDealStage(
  dealId: string,
  status: PropertyStatus,
): { deal: Listing | null } {
  return { deal: patchListing(dealId, (l) => ({ ...l, status, updatedAt: new Date().toISOString() })) }
}

/**
 * Commit a gated stage transition: apply the captured field patch, link any
 * seller/buyer chosen in the gate, flip the status, set/clear the published
 * marker, and append a history entry. This is the single write path the
 * StageGate modal commits through.
 */
export function commitStageTransition(input: StageTransitionInput): { deal: Listing | null } {
  const now = new Date().toISOString()
  const deal = patchListing(input.dealId, (l) => {
      const historyEntry: DealHistoryEntry = {
        id: crypto.randomUUID(),
        label: 'Moved to',
        fromStage: l.status,
        toStage: input.targetStage,
        actor: input.actor,
        timestamp: now,
      }

      const sellerContactIds =
        input.sellerContactId && !l.sellerContactIds.includes(input.sellerContactId)
          ? [...l.sellerContactIds, input.sellerContactId]
          : l.sellerContactIds
      const buyerContactIds =
        input.buyerContactId && !l.buyerContactIds.includes(input.buyerContactId)
          ? [...l.buyerContactIds, input.buyerContactId]
          : l.buyerContactIds

      const publishedAt = input.publish ? now : input.unpublish ? null : l.publishedAt

      return {
        ...l,
        status: input.targetStage,
        dealSide: input.dealSide ?? l.dealSide,
        sellerContactIds,
        buyerContactIds,
        publishedAt,
        transaction: { ...l.transaction, ...input.transaction },
        marketing: input.marketing ? { ...l.marketing, ...input.marketing } : l.marketing,
        financials: input.financials ? { ...l.financials, ...input.financials } : l.financials,
        history: [...l.history, historyEntry],
        updatedAt: now,
      }
    })

  // Feedback on every successful stage move (both gated and direct paths).
  if (deal) {
    notify(
      input.publish
        ? { title: 'Listing published', description: `${deal.name} is now live in market.` }
        : { title: `Moved to ${STAGE_LABEL[input.targetStage]}`, description: deal.name },
    )
  }

  return { deal }
}

/**
 * Merge-patch top-level deal fields (status, dealType, brokers, financials,
 * transaction). The single-page deal editor commits its working copy through this.
 */
export function updateDeal(dealId: string, patch: Partial<Listing>): { deal: Listing | null } {
  return { deal: patchListing(dealId, (l) => ({ ...l, ...patch, updatedAt: new Date().toISOString() })) }
}

/** Merge-patch the deal's marketing content (copy, terms, channel/visibility, lease terms). */
export function updateDealMarketing(
  dealId: string,
  patch: Partial<DealMarketing>,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      marketing: { ...l.marketing, ...patch },
      updatedAt: new Date().toISOString(),
    })),
  }
}

/** Merge-patch the deal's transaction terms (price, commission %/$, close probability). */
export function updateDealTransaction(
  dealId: string,
  patch: Partial<DealTransaction>,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      transaction: { ...l.transaction, ...patch },
      updatedAt: new Date().toISOString(),
    })),
  }
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

/** Update a call list's metadata (name/color/description) and/or membership. */
export function updateCallList(
  id: string,
  patch: Partial<Pick<CallList, 'label' | 'color' | 'description' | 'contactIds'>>,
): void {
  useDataStore.setState((s) => {
    const existing = s.callLists.get(id)
    if (!existing) return {}
    const callLists = new Map(s.callLists)
    callLists.set(id, { ...existing, ...patch })
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

export interface NewContactInput {
  firstName: string
  lastName: string
  company?: string
  email?: string
  phone?: string
  role?: ContactRole
  propertyIds?: string[]
}

/**
 * Create a lightweight CRM contact — enough to link as a deal party from the
 * create-deal flow when no existing contact matches. Non-essential CRM fields
 * default to blank/neutral values; the broker can enrich later.
 */
export function createContact(input: NewContactInput): { contact: Contact } {
  const now = new Date().toISOString()
  const contact: Contact = {
    id: crypto.randomUUID(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email ?? '',
    phone: input.phone ?? '',
    company: input.company ?? '',
    role: input.role ?? 'owner',
    propertyIds: input.propertyIds ?? [],
    assignedTo: 'You',
    source: 'Referral',
    relationship: 'cold',
    side: null,
    dealStage: null,
    inquiries: 0,
    phoneStatus: 'unknown',
    doNotCall: false,
    title: '',
    createdAt: now,
    lastTouch: 'Added manually',
    lastContactedAt: null,
    openTaskCount: 0,
    street: '',
    city: '',
    state: '',
    zip: '',
    tags: [],
  }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contact.id, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact }
}
