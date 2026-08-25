import { useDataStore } from './dataStore'
import { createProposalListing, emptySpaceLeaseTerms, type NewListingDraft } from './createListing'
import { makeEmailDraft, type Email, type NewEmailDraft } from './emails'
import type { CallList } from './contactLists'
import {
  serializeContactFilters,
  type ContactFilterState,
} from '#/components/contacts/contactFilterModel'
import type { Contact, ContactRole, ContactSource, DealDocument, DealHistoryEntry, DealIngestion, DealMarketing, DealPitchFinancials, DealBroker, DealTask, DealTransaction, DocumentGeneration, FinancialDeduction, GeneratedSection, IngestionFieldKey, Listing, PropertyStatus, Task } from './types'
import { CURRENT_USER, TEAMMATES } from './teammates'
import { STAGE_LABEL, type StageTransitionInput } from './stageGates'
import { reconcileContactDealFields } from './contactStage'
import { reconcilePropertyStage } from './store'
import { generateTasks } from './seed'
import { nextCloseProbability } from './commission'
import { notify } from '#/lib/notify'
import {
  advanceStage,
  allResolved,
  countCommittedFields,
  deriveConflicts,
  ingestionPatch,
  resolveConflict,
  resolvedPropertyPatch,
} from './ingestion'
import { getProperty, updateProperty } from './store'

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
  // The property's stage is derived from its deals for the same reason — a
  // stage move here must not leave the property record showing the old one.
  reconcilePropertyStage(updated.propertyId)
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
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      status,
      // Keep the forecast weighting in step with the stage on this path too —
      // see commitStageTransition for the gated one.
      transaction: {
        ...l.transaction,
        closeProbability:
          status === l.status
            ? l.transaction.closeProbability
            : nextCloseProbability(l.status, status, l.transaction.closeProbability),
      },
      updatedAt: new Date().toISOString(),
    })),
  }
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

      // A deal advancing into Under Contract or Closed has necessarily been a
      // live listing — you can't be under contract on something that never
      // published. Those gates carry `publishes: false` (they ask for buyer +
      // price, not listing content), so backfill the marker here. Without it an
      // advanced deal still looks like it skipped Approve & Publish, which is
      // what the "Setup incomplete" banner keys off (see overview.tsx).
      const advancedLive =
        input.targetStage === 'under-contract' || input.targetStage === 'closed'
      const publishedAt = input.publish
        ? now
        : input.unpublish
          ? null
          : (l.publishedAt ?? (advancedLive ? now : null))

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

      // Entering a new stage swaps the planner over to that stage's checklist.
      // Advancing implies the outgoing stage's work is done, so its leftovers
      // don't follow the deal — the planner keeps showing only what's live now,
      // which is the per-stage curation `generateTasks` exists to provide.
      // Guarded on a real stage change: publishing in place (requestSetupCompletion
      // commits with targetStage === current status) must keep the broker's list.
      const stageChanged = input.targetStage !== l.status
      const tasks = stageChanged ? generateTasks(input.targetStage, now) : l.tasks
      const nextCriticalDate = stageChanged
        ? (tasks.find((t) => t.status !== 'complete' && t.date)?.date ?? null)
        : l.transaction.nextCriticalDate

      return {
        ...l,
        status: input.targetStage,
        dealSide: input.dealSide ?? l.dealSide,
        sellerContactIds,
        buyerContactIds,
        tenantContactIds,
        publishedAt,
        tasks,
        transaction: {
          ...l.transaction,
          nextCriticalDate,
          // Crossing into a new stage re-weights the deal: the forecast discounts
          // each commission by this, so the same deal is worth more the closer it
          // gets to closing (and all of it once Closed).
          closeProbability: stageChanged
            ? nextCloseProbability(
                l.status,
                input.targetStage,
                l.transaction.closeProbability,
              )
            : l.transaction.closeProbability,
          ...input.transaction,
        },
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

/**
 * Send a Draft voucher to an approver — the single write behind both Submit
 * buttons on the voucher page.
 *
 * Guarded here, not only at the buttons: Pending is already sitting with an
 * approver and Approved has been signed off, so submitting either would walk a
 * voucher backwards. Returning the listing untouched keeps it referentially
 * equal, so a no-op submit doesn't re-render the page either.
 *
 * No history entry. `DealHistoryEntry` records stage moves — its `fromStage` and
 * `toStage` are `PropertyStatus` — and a voucher's status is a separate axis
 * from the deal's stage, so it has nowhere to go in that shape.
 */
export function submitVoucher(dealId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) =>
      l.transaction.backOffice.status !== 'Draft'
        ? l
        : {
            ...l,
            transaction: {
              ...l.transaction,
              backOffice: { ...l.transaction.backOffice, status: 'Pending' },
            },
            updatedAt: new Date().toISOString(),
          },
    ),
  }
}

/**
 * Take a Pending voucher back off the approver's desk, to Draft.
 *
 * **Pending only.** An approved voucher is settled: the sign-off is a statement
 * about specific figures, and a broker cannot walk it back by reopening the
 * record. What an approved voucher still accepts is *additions* — receivables,
 * invoices, credits against what was approved — not a re-edit of the approved
 * figures themselves. So Draft (already open) and Approved (closed) are both
 * no-ops here, returning the listing referentially unchanged the way
 * `submitVoucher` does.
 *
 * That rule lives here rather than only in the button that calls it, which is
 * also what keeps `DealFinancials`' own invariant safe by construction:
 * `approval` is non-null exactly when `status` is `'Approved'`, and the one
 * status this can move — Pending — never carries one.
 *
 * Reopening costs the submission: the voucher has to be attested to and
 * submitted again. That is the point, not a side effect — whatever the approver
 * was looking at is no longer what the brokerage is claiming. (The page's
 * sections are editable at any status today, so this changes what the voucher
 * *claims about itself*, not what can be typed into it.)
 */
export function reopenVoucher(dealId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) =>
      l.transaction.backOffice.status !== 'Pending'
        ? l
        : {
            ...l,
            transaction: {
              ...l.transaction,
              backOffice: { ...l.transaction.backOffice, status: 'Draft' },
            },
            updatedAt: new Date().toISOString(),
          },
    ),
  }
}

/** What a voucher's Save commits — the tables a broker can edit on a Draft. */
export interface VoucherDraft {
  preSplitDeductions: FinancialDeduction[]
  internalBrokers: DealBroker[]
}

/**
 * Commit a Draft voucher's editable tables — the write behind its Save button.
 *
 * **Draft only,** the same guard `submitVoucher` and `reopenVoucher` carry and
 * for the same reason: a Pending voucher is sitting with an approver and an
 * Approved one has been signed off, so the figures either is looking at cannot
 * change underneath it. The rule lives here rather than only in the Save button
 * so it holds however the write is reached.
 *
 * Whole arrays are replaced rather than patched row by row: the tables edit
 * rows, add them, and delete them in one local working copy, and Save is a
 * statement about that copy as a whole. One write for both, because one button
 * commits both — a partial save would leave the deduction total and the broker
 * splits describing different drafts.
 *
 * `internalBrokers` sits on the deal rather than in `backOffice`, so this is
 * also the one place that fact is spelled out.
 */
export function saveVoucherDraft(
  dealId: string,
  draft: VoucherDraft,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) =>
      l.transaction.backOffice.status !== 'Draft'
        ? l
        : {
            ...l,
            internalBrokers: draft.internalBrokers,
            transaction: {
              ...l.transaction,
              backOffice: {
                ...l.transaction.backOffice,
                preSplitDeductions: draft.preSplitDeductions,
              },
            },
            updatedAt: new Date().toISOString(),
          },
    ),
  }
}

/** Merge-patch the deal's pitch financials (asking price, price per SF, cap rate, …). */
export function updateDealFinancials(
  dealId: string,
  patch: Partial<DealPitchFinancials>,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      financials: { ...l.financials, ...patch },
      updatedAt: new Date().toISOString(),
    })),
  }
}

/** What the generation flow hands over to be persisted. */
export interface NewGeneratedDocument {
  name: string
  templateName: string
  sourceFileIds: string[]
  sourceFileNames: string[]
  instructions: string
  sections: GeneratedSection[]
}

/**
 * File a generated document onto the deal. The document carries its whole
 * generation — inputs and outline — so the editor can rebuild the same pages and
 * the review screen stays truthful even if a source file is deleted later.
 *
 * `generatedAt` is stamped here rather than in `documentGeneration.ts`, which
 * must stay deterministic.
 */
export function createGeneratedDocument(
  dealId: string,
  input: NewGeneratedDocument,
): { documentId: string | null } {
  const now = new Date().toISOString()
  const documentId = `gendoc-${crypto.randomUUID()}`

  const document: DealDocument = {
    id: documentId,
    name: input.name,
    uploadedAt: now,
    aiGenerated: true,
    generation: {
      templateName: input.templateName,
      sourceFileIds: input.sourceFileIds,
      sourceFileNames: input.sourceFileNames,
      instructions: input.instructions,
      sections: input.sections,
      generatedAt: now,
    },
  }

  const deal = patchListing(dealId, (l) => ({
    ...l,
    documents: [...(l.documents ?? []), document],
    updatedAt: now,
  }))

  return { documentId: deal ? documentId : null }
}

/** The generation behind a document id, or undefined if there isn't one. */
export function resolveGeneratedDocument(
  deal: Listing | undefined,
  documentId: string | undefined,
): DocumentGeneration | undefined {
  if (!deal || !documentId) return undefined
  return deal.documents?.find((d) => d.id === documentId)?.generation
}

/** Advance the run to its next stage. No-op when there is no processing run. */
export function advanceIngestion(dealId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) =>
      l.ingestion && l.ingestion.status === 'processing'
        ? { ...l, ingestion: advanceStage(l.ingestion), updatedAt: new Date().toISOString() }
        : l,
    ),
  }
}

/**
 * Land the run: commit the non-conflicting field values, attach the conflicts the
 * broker has to arbitrate, and settle on `needs-review` or `complete`. The
 * disputed fields are deliberately NOT written — that is what blocks publishing.
 */
export function finishIngestion(dealId: string): { deal: Listing | null } {
  const listing = useDataStore.getState().listings.get(dealId)
  if (!listing?.ingestion || listing.ingestion.status !== 'processing') {
    return { deal: listing ?? null }
  }
  const property = getProperty(listing.propertyId)
  const conflicts = deriveConflicts(listing, property)
  const settled: DealIngestion = { ...listing.ingestion, conflicts }
  const patch = ingestionPatch(listing, property, settled)

  updateDealMarketing(dealId, patch.marketing)
  updateDealTransaction(dealId, patch.transaction)
  updateDealFinancials(dealId, patch.financials)

  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      ingestion: {
        ...settled,
        filledCount: countCommittedFields(patch, resolvedPropertyPatch(settled), settled),
        status: conflicts.length > 0 ? 'needs-review' : 'complete',
      },
      updatedAt: new Date().toISOString(),
    })),
  }
}

/**
 * Record the broker's pick for one conflict and commit its value. Occupancy is a
 * Property field, so it writes through `updateProperty`. Once every conflict is
 * settled the run flips to `complete`.
 *
 * `filledCount` is recomputed here, not carried over: a resolution writes another
 * field, and a count frozen at commit time would leave the banner understating
 * what is actually on the deal.
 */
export function resolveIngestionConflict(
  dealId: string,
  fieldKey: IngestionFieldKey,
  side: 'doc' | 'current',
): { deal: Listing | null } {
  const listing = useDataStore.getState().listings.get(dealId)
  if (!listing?.ingestion) return { deal: listing ?? null }

  const next = resolveConflict(listing.ingestion, fieldKey, side)
  const property = getProperty(listing.propertyId)
  const patch = ingestionPatch(listing, property, next)

  updateDealFinancials(dealId, patch.financials)
  const propPatch = resolvedPropertyPatch(next)
  // `propPatch.occupancyPct` is defined the moment an occupancy conflict exists
  // at all, resolved or not — while unresolved it's an echo of the value
  // captured back at `deriveConflicts` time, kept defined only so the filled-
  // field count (which subtracts unresolvedCount to cancel the padding) stays
  // symmetric with the financials patch. Writing that echo to the property on
  // every resolution — including one for a completely different field — would
  // revert a real occupancy edit made in between (e.g. a Save on the Listing
  // page), so the actual write only happens once the occupancy conflict itself
  // has been resolved.
  const occupancyResolved = next.conflicts.find(
    (c) => c.fieldKey === 'occupancyPct',
  )?.resolution !== undefined
  if (occupancyResolved && propPatch.occupancyPct !== undefined && listing.propertyId) {
    updateProperty(listing.propertyId, propPatch)
  }

  return {
    deal: patchListing(dealId, (l) => ({
      ...l,
      ingestion: {
        ...next,
        filledCount: countCommittedFields(patch, propPatch, next),
        status: allResolved(next) ? 'complete' : 'needs-review',
      },
      updatedAt: new Date().toISOString(),
    })),
  }
}

/** Clear the run off the deal — the banner's dismiss on the clean path. */
export function dismissIngestion(dealId: string): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => {
      const { ingestion: _ingestion, ...rest } = l
      return { ...rest, updatedAt: new Date().toISOString() } as Listing
    }),
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
  /** Set by the assistant's `create_task` tool; the Add Task modal leaves it off. */
  createdByAi?: boolean
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
    createdByAi: input.createdByAi ?? false,
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
  /**
   * Caller-supplied id. Defaults to a uuid; scripted/replayable records (the
   * demo's simulated inbound leads) pass a stable one so re-running the beat
   * is idempotent and a reset can clear them by id.
   */
  id?: string
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
  /** Segmentation tags; defaults to none. */
  tags?: string[]
  /**
   * Listings this contact has inquired about. Sets `inquiries` to match, since
   * the count and the ids have to agree (see `Contact.inquiredListingIds`) —
   * that pairing is what the People table's Inquiries cell, the Listing
   * Inquiries filter, and the timeline's inquiry rows all read.
   */
  inquiredListingIds?: string[]
  /** What they wrote and how it reached us, keyed by inquired listing id. */
  inquiryDetails?: Contact['inquiryDetails']
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
 * Append a timestamped note line to a contact's freeform `notes` and persist.
 * Used by the AI `add_note` tool and any manual note affordance.
 */
/**
 * Stamp a contact's most recent activity — anything that happens on the record,
 * inbound or outbound (a logged call, an email that arrives). Keeps the Last
 * Activity filter and column true as the session goes on, without touching
 * `lastContactedAt`, which only moves when we actually reach them.
 */
export function touchContactActivity(
  contactId: string,
  at: string = new Date().toISOString(),
): { contact: Contact | null } {
  const existing = useDataStore.getState().contacts.get(contactId)
  if (!existing) return { contact: null }
  // Never walk activity backwards.
  const current = existing.lastActivityAt ?? existing.lastContactedAt
  if (current && Date.parse(current) >= Date.parse(at)) return { contact: existing }
  const contact: Contact = { ...existing, lastActivityAt: at }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contactId, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact }
}

export function addNote(contactId: string, text: string): { contact: Contact | null } {
  const existing = useDataStore.getState().contacts.get(contactId)
  if (!existing) return { contact: null }
  const stamp = new Date().toISOString().slice(0, 10)
  const line = `${stamp}: ${text.trim()}`
  const notes = existing.notes ? `${existing.notes}\n${line}` : line
  const contact: Contact = { ...existing, notes }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contactId, contact)
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
    id: input.id ?? crypto.randomUUID(),
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
    inquiries: input.inquiredListingIds?.length ?? 0,
    inquiredListingIds: input.inquiredListingIds,
    inquiryDetails: input.inquiryDetails,
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
    tags: input.tags ?? [],
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
