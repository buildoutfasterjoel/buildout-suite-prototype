import { useDataStore } from './dataStore'
import { createProposalListing, emptySpaceLeaseTerms, type NewListingDraft } from './createListing'
import { makeEmailDraft, type Email, type NewEmailDraft } from './emails'
import type { CallList } from './contactLists'
import {
  serializeContactFilters,
  type ContactFilterState,
} from '#/components/contacts/contactFilterModel'
import type { Contact, ContactRole, ContactSource, DealHistoryEntry, DealMarketing, DealTask, DealTransaction, Listing, PropertyStatus, Task } from './types'
import { CURRENT_USER, TEAMMATES } from './teammates'
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

      // Fold lease-gate scalars into the marketed space's terms + marketing.
      const hasLeaseTerms =
        input.leaseRate != null || input.leaseRateUnits != null ||
        input.leaseTermMonths != null
      let marketing = input.marketing ? { ...l.marketing, ...input.marketing } : l.marketing
      if (hasLeaseTerms || input.availableSqFt != null) {
        const terms = [...marketing.spaceLeaseTerms]
        const unitId = l.unitId ?? terms[0]?.unitId ?? 'whole-property'
        const base = terms[0] ?? emptySpaceLeaseTerms(unitId)
        terms[0] = {
          ...base,
          leaseRate: input.leaseRate ?? base.leaseRate,
          leaseRateUnits: input.leaseRateUnits ?? base.leaseRateUnits,
          leaseTermMonths: input.leaseTermMonths ?? base.leaseTermMonths,
        }
        marketing = {
          ...marketing,
          spaceLeaseTerms: terms,
          availableSqFt: input.availableSqFt ?? marketing.availableSqFt,
        }
      }
      const tenantContactIds =
        input.tenantContactId && !l.tenantContactIds.includes(input.tenantContactId)
          ? [...l.tenantContactIds, input.tenantContactId]
          : l.tenantContactIds

      return {
        ...l,
        status: input.targetStage,
        dealSide: input.dealSide ?? l.dealSide,
        sellerContactIds,
        buyerContactIds,
        tenantContactIds,
        publishedAt,
        transaction: { ...l.transaction, ...input.transaction },
        marketing,
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
  role: 'seller' | 'buyer' | 'tenant' | 'other',
): { deal: Listing | null } {
  const key =
    role === 'seller' ? 'sellerContactIds'
    : role === 'buyer' ? 'buyerContactIds'
    : role === 'tenant' ? 'tenantContactIds'
    : 'otherContactIds'
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

/** Fields the Add Task modal collects. Dates are ISO `YYYY-MM-DD` strings. */
export interface NewTaskInput {
  name: string
  /** Teammate id; defaults to the current user when omitted. */
  assigneeId?: string
  dueDate?: string | null
  type?: string | null
  /** 'contact' | 'deal' | 'listing' | 'property'. Defaults to 'contact'. */
  source?: string
  contactId?: string | null
  dealId?: string | null
  notes?: string
  reminders?: string[]
  followUpDate?: string | null
  requireAttachments?: boolean
}

/** Resolve a teammate's two-letter initials from their id (falls back to the current user). */
function assigneeInitialsFor(assigneeId: string): string {
  const member =
    [CURRENT_USER, ...TEAMMATES].find((m) => m.id === assigneeId) ?? CURRENT_USER
  return member.initials
}

/**
 * Create a standalone task from the Add Task modal and insert it into the store.
 * Tasks start `open`; the created task surfaces in its linked contact's Tasks
 * column (see {@link getContactDetailClient}). Persists via the single write path.
 */
export function createTask(input: NewTaskInput): { task: Task } {
  const assigneeId = input.assigneeId ?? CURRENT_USER.id
  const task: Task = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    assigneeId,
    assigneeInitials: assigneeInitialsFor(assigneeId),
    dueDate: input.dueDate ?? null,
    type: input.type ?? null,
    source: input.source ?? 'contact',
    contactId: input.contactId ?? null,
    dealId: input.dealId ?? null,
    notes: input.notes?.trim() ?? '',
    reminders: input.reminders ?? [],
    followUpDate: input.followUpDate ?? null,
    requireAttachments: input.requireAttachments ?? false,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  useDataStore.setState((s) => {
    const tasks = new Map(s.tasks)
    tasks.set(task.id, task)
    return { tasks }
  })
  useDataStore.getState().persist()
  return { task }
}

/**
 * Update an existing standalone task from the Edit Task modal. Rebuilds the
 * editable fields from the form input while preserving id, status, and
 * createdAt. Persists via the single write path.
 */
export function updateTask(
  id: string,
  input: NewTaskInput,
): { task: Task | null } {
  const existing = useDataStore.getState().tasks.get(id)
  if (!existing) return { task: null }
  const assigneeId = input.assigneeId ?? existing.assigneeId
  const task: Task = {
    ...existing,
    name: input.name.trim(),
    assigneeId,
    assigneeInitials: assigneeInitialsFor(assigneeId),
    dueDate: input.dueDate ?? null,
    type: input.type ?? null,
    source: input.source ?? existing.source,
    contactId: input.contactId ?? null,
    dealId: input.dealId ?? null,
    notes: input.notes?.trim() ?? '',
    reminders: input.reminders ?? [],
    followUpDate: input.followUpDate ?? null,
    requireAttachments: input.requireAttachments ?? false,
  }
  useDataStore.setState((s) => {
    const tasks = new Map(s.tasks)
    tasks.set(id, task)
    return { tasks }
  })
  useDataStore.getState().persist()
  return { task }
}

/** Delete a standalone task (from the Edit Task modal). Persists the removal. */
export function deleteTask(id: string): void {
  useDataStore.setState((s) => {
    if (!s.tasks.has(id)) return {}
    const tasks = new Map(s.tasks)
    tasks.delete(id)
    return { tasks }
  })
  useDataStore.getState().persist()
}

/** Toggle a standalone task's completion (the Tasks page checkbox). Persists. */
export function setTaskCompleted(id: string, completed: boolean): void {
  useDataStore.setState((s) => {
    const existing = s.tasks.get(id)
    if (!existing) return {}
    const tasks = new Map(s.tasks)
    tasks.set(id, { ...existing, status: completed ? 'complete' : 'open' })
    return { tasks }
  })
  useDataStore.getState().persist()
}

/**
 * Patch a single deal-embedded planner task in place. Used by the Edit Task
 * modal when a deal-derived task (not a standalone {@link Task}) is opened.
 */
export function updateDealTask(
  dealId: string,
  taskId: string,
  patch: Partial<DealTask>,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      tasks: l.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    })),
  }
}

/** Remove a deal-embedded planner task from its deal (Edit Task modal → Delete). */
export function deleteDealTask(
  dealId: string,
  taskId: string,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      tasks: l.tasks.filter((t) => t.id !== taskId),
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
  /** Job title (free text), e.g. "Managing Partner". */
  title?: string
  /** Lead source; defaults to 'Referral' for the deal-flow caller. */
  source?: ContactSource
  doNotCall?: boolean
  notes?: string
  /** Primary address (line 1), if captured. */
  street?: string
  city?: string
  state?: string
  zip?: string
}

/** Fields the Edit Contact form can change. Phones/emails carry a primary plus optional extras. */
export interface EditContactInput {
  firstName: string
  lastName: string
  company?: string
  title?: string
  /** Primary email (may be blank when only phones are on file). */
  email: string
  /** Additional emails beyond the primary. */
  emails?: string[]
  /** Primary phone (may be blank when only emails are on file). */
  phone: string
  /** Additional phones beyond the primary. */
  phones?: string[]
  source: ContactSource
  doNotCall: boolean
  notes?: string
}

/**
 * Merge-patch an existing contact from the Edit Contact form. Only the
 * form-editable fields change; deal-derived and system fields are preserved.
 * Empty extra-phone/email arrays are stored as `undefined` to keep the shape tidy.
 */
export function updateContact(
  id: string,
  input: EditContactInput,
): { contact: Contact | null } {
  const existing = useDataStore.getState().contacts.get(id)
  if (!existing) return { contact: null }

  const primaryPhone = input.phone.trim()
  const primaryEmail = input.email.trim()
  // Drop blanks and any value that repeats the primary or an earlier extra — the
  // same number/address must never be stored twice.
  const extraPhones = [...new Set((input.phones ?? []).map((p) => p.trim()))].filter(
    (p) => p && p !== primaryPhone,
  )
  const extraEmails = [...new Set((input.emails ?? []).map((e) => e.trim()))].filter(
    (e) => e && e !== primaryEmail,
  )

  const contact: Contact = {
    ...existing,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    company: input.company?.trim() ?? '',
    title: input.title?.trim() ?? '',
    email: primaryEmail,
    emails: extraEmails.length ? extraEmails : undefined,
    phone: primaryPhone,
    phones: extraPhones.length ? extraPhones : undefined,
    source: input.source,
    doNotCall: input.doNotCall,
    notes: input.notes?.trim() || undefined,
  }

  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(id, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact }
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
    source: input.source ?? 'Referral',
    relationship: 'cold',
    side: null,
    dealStage: null,
    inquiries: 0,
    phoneStatus: 'unknown',
    doNotCall: input.doNotCall ?? false,
    title: input.title ?? '',
    createdAt: now,
    lastTouch: 'Added manually',
    lastContactedAt: null,
    openTaskCount: 0,
    street: input.street?.trim() ?? '',
    city: input.city?.trim() ?? '',
    state: input.state?.trim() ?? '',
    zip: input.zip?.trim() ?? '',
    tags: [],
    notes: input.notes?.trim() || undefined,
  }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contact.id, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact }
}
