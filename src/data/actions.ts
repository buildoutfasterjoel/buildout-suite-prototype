import { useDataStore } from './dataStore'
import { createProposalListing, emptySpaceLeaseTerms, type NewListingDraft } from './createListing'
import { makeEmailDraft, type Email, type NewEmailDraft } from './emails'
import type { CallList } from './contactLists'
import {
  serializeContactFilters,
  type ContactFilterState,
} from '#/components/contacts/contactFilterModel'
import type { Contact, ContactRole, ContactSource, DealDocument, DealHistoryEntry, DealIngestion, DealInvoice, DealMarketing, DealPitchFinancials, DealBroker, DealFinancials, DealTask, DealTransaction, DepositAllocation, DocumentGeneration, FinancialDeduction, FinancialReceivable, GeneratedSection, IngestionFieldKey, Listing, PaymentDeduction, PropertyStatus, Task, VoucherDeposit, VoucherPayable, VoucherPayment } from './types'
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
import { getContact, getProperty, updateProperty } from './store'
import {
  deductionBalance,
  generateDepositReference,
  receivableBalance,
} from './deposits'
import {
  payableBalance,
  payableBrokers,
  payablesForDeposit,
} from './payables'
import {
  invoiceDueDate,
  invoiceFileName,
  invoiceLineItems,
  invoicePayerFileLabel,
  nextInvoiceOrdinal,
} from './invoices'
import { voucherParty } from './vouchers'

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
 * was looking at is no longer what the brokerage is claiming.
 *
 * **Nothing in the UI calls this today.** The voucher header used to offer a
 * broker an Edit on a Pending voucher; it does not any more, because an approver
 * has to be reading the same figures that were attested to, which an un-submit
 * cannot promise. Submitting is therefore one-way for the broker, and a Pending
 * voucher only moves when an approver acts on it. This is kept, unwired, for
 * that approver-side path: sending a voucher back is the shape a rejection
 * takes, and the Pending-only rule it encodes is the rule such a flow needs. If
 * the approver flow lands somewhere else, delete this and its tests.
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
  /**
   * The acquiring party — buyers on a sale, tenants on a lease.
   *
   * ONE list, not two. The voucher shows exactly one of the two sections, so a
   * draft carrying both would let a Sale deal hold a list of tenants that
   * nothing renders and nothing clears. `dealType` decides where it lands, in
   * one place, below.
   */
  partyContactIds: string[]
  /** Who this voucher bills. Each is a contact id. */
  payerContactIds: string[]
}

/**
 * The label the Back Office vouchers list shows in its Related Contacts column,
 * and searches.
 *
 * Rebuilt on every save because it is denormalized: the deal's parties are the
 * truth and this is a copy, so an edited buyer would otherwise leave it naming
 * whoever used to be there. The format matches what the seed writes — but not
 * what `createListing.ts` writes: a deal created in-app carries `contactLabel`'s
 * "Name · Company" format (no "& N more") until its first voucher save. That
 * drift is accepted rather than unpicking three write sites for a label.
 */
function buildRelatedContactsLabel(deal: Listing): string {
  const ids = [
    ...deal.sellerContactIds,
    ...deal.buyerContactIds,
    ...deal.tenantContactIds,
  ]
  const first = ids.map((id) => getContact(id)).find((c) => c !== undefined)
  if (!first) return '—'
  const name = `${first.firstName} ${first.lastName}`.trim()
  return ids.length > 1 ? `${name} & ${ids.length - 1} more` : name
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
 * statement about that copy as a whole. One write for all of them, because one
 * button commits them — a partial save would leave the deduction total, the
 * broker splits and the payer list describing different drafts.
 *
 * `internalBrokers` and `partyContactIds` sit on the deal rather than in
 * `backOffice` — `payerContactIds` is the one that lands in `backOffice` — so
 * this is also the one place that split is spelled out.
 */
export function saveVoucherDraft(
  dealId: string,
  draft: VoucherDraft,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => {
      if (l.transaction.backOffice.status !== 'Draft') return l
      const isLease = l.dealType === 'Lease'
      const next: Listing = {
        ...l,
        internalBrokers: draft.internalBrokers,
        buyerContactIds: isLease ? l.buyerContactIds : draft.partyContactIds,
        tenantContactIds: isLease ? draft.partyContactIds : l.tenantContactIds,
        transaction: {
          ...l.transaction,
          backOffice: {
            ...l.transaction.backOffice,
            preSplitDeductions: draft.preSplitDeductions,
            payerContactIds: draft.payerContactIds,
          },
        },
        updatedAt: new Date().toISOString(),
      }
      // Built from `next`, not `l` — the label has to describe the parties
      // being saved, not the ones being replaced.
      next.transaction.backOffice.relatedContactsLabel =
        buildRelatedContactsLabel(next)
      return next
    }),
  }
}

/**
 * The three receivable writes: add, edit in place, remove.
 *
 * **Not routed through `saveVoucherDraft`, and guarded differently on purpose.**
 * That commits a Draft voucher's working copy, and a receivable outlives Draft:
 * an Approved voucher still accepts additions — receivables, invoices, credits
 * against what was approved — which is the whole reason the Receivables section
 * stays live at that status. Sending these through the Draft-only Save would
 * have rendered live controls on an Approved voucher whose every edit silently
 * did nothing.
 *
 * So the guard is **not Pending**, matching what the section's `editable` prop
 * already says, and these write straight through rather than joining the
 * working copy. That also keeps the Save button honest: it commits the
 * deduction, broker, party and payer tables, and nothing else.
 */
function patchReceivables(
  dealId: string,
  update: (rows: FinancialReceivable[]) => FinancialReceivable[],
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) =>
      l.transaction.backOffice.status === 'Pending'
        ? l
        : {
            ...l,
            transaction: {
              ...l.transaction,
              backOffice: {
                ...l.transaction.backOffice,
                receivables: update(l.transaction.backOffice.receivables),
              },
            },
            updatedAt: new Date().toISOString(),
          },
    ),
  }
}

/**
 * Bill a new line on this voucher.
 *
 * Adds the payer to `payerContactIds` when they are not already there, because
 * a receivable naming somebody the Billing section does not list would put two
 * answers to "who is being billed" on one page. This is the ordinary way a
 * payer arrives: you bill someone, and they appear above.
 *
 * `credited` starts at 0 — a line nobody has paid against yet.
 */
export function addReceivable(
  dealId: string,
  input: {
    payerContactId: string
    billToCompany: boolean
    dueDate: string
    billingDescription: string
    amount: number
  },
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => {
      if (l.transaction.backOffice.status === 'Pending') return l
      const back = l.transaction.backOffice
      const payerContactIds = back.payerContactIds.includes(input.payerContactId)
        ? back.payerContactIds
        : [...back.payerContactIds, input.payerContactId]
      return {
        ...l,
        transaction: {
          ...l.transaction,
          backOffice: {
            ...back,
            payerContactIds,
            receivables: [
              ...back.receivables,
              { id: crypto.randomUUID(), credited: 0, ...input },
            ],
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }),
  }
}

/**
 * Edit one receivable in place — the row's own fields, committed per keystroke
 * commit rather than through Save.
 *
 * Changing the payer does NOT add them to `payerContactIds`: the picker only
 * offers contacts, and a re-pointed line can leave its previous payer listed
 * with nothing billed, which is a legitimate state the Billing section renders
 * as $0. Removing that payer is a deliberate act, not a side effect of an edit.
 */
export function updateReceivable(
  dealId: string,
  receivableId: string,
  patch: Partial<Omit<FinancialReceivable, 'id'>>,
): { deal: Listing | null } {
  return patchReceivables(dealId, (rows) =>
    rows.map((r) => (r.id === receivableId ? { ...r, ...patch } : r)),
  )
}

/**
 * Record money received against this voucher.
 *
 * Takes the allocation the modal is SHOWING rather than recomputing it here, so
 * an admin who used Override gets what they entered. That is the whole point of
 * the toggle — re-deriving the split at the write path would silently discard the
 * decision it exists to allow.
 *
 * The caps are re-applied anyway: an allocation is clamped to what its receivable
 * still owes and its deduction still has uncovered, and anything that lands on
 * zero is dropped rather than stored as a line that moved nothing. A disabled
 * input is a UI courtesy, not a guarantee about what reaches the store — the same
 * reason `createInvoiceFromReceivables` re-checks its one-payer rule.
 *
 * `credited` and `covered` are moved here rather than derived from the deposit
 * list on read. Both are already read in half a dozen places — most sharply by
 * `invoiceLineItems`, which FREEZES `credited` onto an invoice line — and a
 * computed sum would rewrite every one of them to show the same figures.
 * `deposits.test.ts` and the seed test hold the two in agreement.
 *
 * **On an Approved voucher it also raises payables** — one per broker, each for
 * their share of what arrived. On a Draft it raises none: there is nothing to
 * pay out of a commission nobody has signed off, and `approveVoucher` walks the
 * deposits already on the voucher when the sign-off finally comes.
 *
 * The share is figured from the deposit's own `amount`, not from the sum of its
 * allocations. The two differ when a deposit over-pays what was billed, and what
 * a broker is owed follows the money that ARRIVED, not the part of it the
 * receivables could absorb.
 *
 * Refuses on a Pending voucher, like every other receivable write.
 */
export function applyDeposit(
  dealId: string,
  input: {
    /** `yyyy-mm-dd`. */
    date: string
    amount: number
    referenceNumber: string
    receivableAllocations: DepositAllocation[]
    deductionAllocations: DepositAllocation[]
  },
): { deal: Listing | null; depositId: string | null } {
  const now = new Date().toISOString()
  const depositId = `deposit-${crypto.randomUUID()}`

  const deal = patchListing(dealId, (l) => {
    const back = l.transaction.backOffice
    if (back.status === 'Pending') return l

    // Clamped against the store's own figures, not the caller's copies, which
    // could be a render behind whatever else has written to this voucher.
    const receivablesById = new Map(back.receivables.map((r) => [r.id, r]))
    const receivableAllocations = clampAllocations(
      input.receivableAllocations,
      (id) => {
        const row = receivablesById.get(id)
        return row ? receivableBalance(row) : 0
      },
    )
    const deductionsById = new Map(back.preSplitDeductions.map((d) => [d.id, d]))
    const deductionAllocations = clampAllocations(input.deductionAllocations, (id) => {
      const row = deductionsById.get(id)
      return row ? deductionBalance(row) : 0
    })

    // A deposit that reached nothing is not a record worth keeping — it would
    // sit under a receivable as a child row stating that $0.00 arrived.
    if (receivableAllocations.length === 0 && deductionAllocations.length === 0) {
      return l
    }

    const appliedTo = new Map(receivableAllocations.map((a) => [a.targetId, a.amount]))
    const coveredBy = new Map(deductionAllocations.map((a) => [a.targetId, a.amount]))

    return {
      ...l,
      transaction: {
        ...l.transaction,
        backOffice: {
          ...back,
          receivables: back.receivables.map((r) => {
            const applied = appliedTo.get(r.id)
            return applied ? { ...r, credited: round2(r.credited + applied) } : r
          }),
          preSplitDeductions: back.preSplitDeductions.map((d) => {
            const covered = coveredBy.get(d.id)
            return covered ? { ...d, covered: round2((d.covered ?? 0) + covered) } : d
          }),
          payables: raisePayables(l, back, {
            id: depositId,
            date: input.date,
            amount: round2(input.amount),
          }),
          deposits: [
            ...(back.deposits ?? []),
            {
              id: depositId,
              date: input.date,
              amount: round2(input.amount),
              // Every deposit carries a reference. The field is optional to the
              // broker — money often lands before its paperwork does — but a row
              // with nothing in that column cannot be matched against a bank
              // statement later, so one is generated here rather than left
              // blank. Generated at the WRITE path, not in the modal, because
              // uniqueness is a question about the voucher's other deposits and
              // only the store knows what those are.
              referenceNumber:
                input.referenceNumber ||
                generateDepositReference(
                  depositId,
                  (back.deposits ?? []).map((d) => d.referenceNumber),
                ),
              createdAt: now,
              createdById: CURRENT_USER.id,
              receivableAllocations,
              deductionAllocations,
            },
          ],
        },
      },
      updatedAt: now,
    }
  })

  // `patchListing` returns the listing unchanged when the voucher is Pending, so
  // a null id is not the only refusal — the caller reads the deal to know more.
  return { deal, depositId: deal ? depositId : null }
}

/**
 * Correct a deposit's reference number.
 *
 * The only field on a deposit that can be edited. Its amount, date and
 * allocations are the record of a payment that already happened; a reference is
 * a label on that payment, and the one it carries is often ours — generated
 * because the money landed before its paperwork did. Handing over the real
 * cheque or wire number afterwards is the ordinary case, not a correction of a
 * mistake.
 *
 * An empty reference is refused rather than stored, which is the same rule
 * `applyDeposit` applies from the other side: no deposit sits in the table with
 * nothing in that column. The cell reverts to what it had, so clearing the box
 * and tabbing away is a no-op rather than a silent erasure.
 *
 * Refuses on a Pending voucher, like every other receivable write.
 */
export function updateDepositReference(
  dealId: string,
  depositId: string,
  referenceNumber: string,
): { deal: Listing | null } {
  const next = referenceNumber.trim()
  if (!next) return { deal: useDataStore.getState().listings.get(dealId) ?? null }

  return {
    deal: patchListing(dealId, (l) => {
      const back = l.transaction.backOffice
      if (back.status === 'Pending') return l
      return {
        ...l,
        transaction: {
          ...l.transaction,
          backOffice: {
            ...back,
            deposits: (back.deposits ?? []).map((d) =>
              d.id === depositId ? { ...d, referenceNumber: next } : d,
            ),
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }),
  }
}

/**
 * Remove a deposit, putting back what it moved.
 *
 * **A deposit is one cash receipt, so it comes off whole.** Deleting from one
 * receivable's child row removes every allocation the deposit made — including
 * the ones under OTHER receivables and against the deductions. Reversing a
 * single line instead would leave a record claiming money arrived that partly
 * did not, and there is no screen on which that half-deposit would make sense.
 * The caller says so in its toast, because a row vanishing from a receivable
 * nobody clicked on is otherwise something to discover by looking.
 *
 * `credited` and `covered` are stored running totals, so undoing means
 * subtracting rather than recomputing — the mirror of what `applyDeposit` added.
 * Both floor at zero: a total that has drifted below what this deposit put in is
 * a state nothing should turn negative over.
 *
 * A deduction that lands back at zero goes back to `null`, not `0`. Null is what
 * the seed writes for a deduction nothing has touched, and it is what the
 * Pre-Split Deductions table renders as "None" — so a deduction whose only
 * credit has been reversed reads as untouched again rather than as deliberately
 * covered for nothing.
 *
 * **The payables this deposit raised go with it, payments and all.** A payable
 * is a claim on money that arrived; leaving one behind whose funding deposit is
 * gone would state that the brokerage owes money it never received. Payments
 * recorded against it are lost with it, which is why the caller's confirmation
 * counts them out loud rather than deleting quietly.
 *
 * Refuses on a Pending voucher, like every other receivable write.
 */
export function deleteDeposit(
  dealId: string,
  depositId: string,
): {
  deal: Listing | null
  removed: VoucherDeposit | null
  /** The payables that went with it — what the caller's toast counts out loud. */
  removedPayables: VoucherPayable[]
} {
  const before = useDataStore.getState().listings.get(dealId)
  const back = before?.transaction.backOffice
  const removed = back?.deposits?.find((d) => d.id === depositId) ?? null
  if (!before || !removed || back?.status === 'Pending') {
    return { deal: before ?? null, removed: null, removedPayables: [] }
  }
  const removedPayables = (back?.payables ?? []).filter(
    (p) => p.depositId === depositId,
  )

  const reversed = new Map(removed.receivableAllocations.map((a) => [a.targetId, a.amount]))
  const uncovered = new Map(removed.deductionAllocations.map((a) => [a.targetId, a.amount]))

  const deal = patchListing(dealId, (l) => {
    const voucher = l.transaction.backOffice
    return {
      ...l,
      transaction: {
        ...l.transaction,
        backOffice: {
          ...voucher,
          receivables: voucher.receivables.map((r) => {
            const applied = reversed.get(r.id)
            return applied
              ? { ...r, credited: Math.max(0, round2(r.credited - applied)) }
              : r
          }),
          preSplitDeductions: voucher.preSplitDeductions.map((d) => {
            const covered = uncovered.get(d.id)
            if (!covered) return d
            const next = Math.max(0, round2((d.covered ?? 0) - covered))
            return { ...d, covered: next === 0 ? null : next }
          }),
          deposits: (voucher.deposits ?? []).filter((d) => d.id !== depositId),
          // Left `undefined` on a voucher that never had any, rather than
          // filtered into an empty array — see `raisePayables`.
          payables: voucher.payables?.filter((p) => p.depositId !== depositId),
        },
      },
      updatedAt: new Date().toISOString(),
    }
  })

  return {
    deal,
    removed: deal ? removed : null,
    removedPayables: deal ? removedPayables : [],
  }
}

/**
 * Sign a Pending voucher off, and raise the payables its deposits have earned.
 *
 * **Pending only** — the mirror of `reopenVoucher`'s rule, and for the same
 * reason from the other side: a Draft has not been attested to, and an Approved
 * one has already been signed. Both are no-ops, returning the listing
 * referentially unchanged the way `submitVoucher` does.
 *
 * The reviewer is passed in rather than taken from `CURRENT_USER`.
 * `VOUCHER_APPROVER_IDS` is explicit that the broker who closed the deal is the
 * one person who must not approve it, and the signed-in user is a Broker — so a
 * voucher signed off by `CURRENT_USER` would break the rule the roster exists to
 * state. The caller picks from that list.
 *
 * **This is where back-filled payables come from.** A deposit applied while the
 * voucher was still a Draft stored nothing to pay out; approving is the moment
 * that becomes real, so every deposit already on the voucher raises its payables
 * here. `raisePayables` is idempotent by `depositId`, so a deposit that somehow
 * already has them is skipped rather than doubled.
 *
 * The status is moved before the payables are raised, because `raisePayables`
 * refuses on anything but an Approved voucher — it is reading the record it is
 * about to be part of, not the one that was there when the button was clicked.
 */
export function approveVoucher(
  dealId: string,
  reviewerId: string,
): { deal: Listing | null } {
  const approvedOn = new Date().toISOString().slice(0, 10)
  return {
    deal: patchListing(dealId, (l) => {
      const back = l.transaction.backOffice
      if (back.status !== 'Pending') return l

      const approved: DealFinancials = {
        ...back,
        status: 'Approved',
        approval: { reviewerId, approvedOn },
      }
      const payables = (approved.deposits ?? []).reduce(
        (carried, deposit) =>
          raisePayables(l, { ...approved, payables: carried }, deposit),
        approved.payables,
      )

      return {
        ...l,
        transaction: {
          ...l.transaction,
          backOffice: { ...approved, payables },
        },
        updatedAt: new Date().toISOString(),
      }
    }),
  }
}

/**
 * Write one cheque against a payable.
 *
 * **Approved only**, which is not an extra rule so much as the only reachable
 * one: payables exist on no other status, so there is nothing on a Draft for
 * this to be called with.
 *
 * The gross is clamped to the payable's balance read from the STORE, not from
 * the caller's copy, which could be a render behind another payment on the same
 * row. The modal disables its input past the balance; that is a courtesy, not a
 * guarantee about what reaches here — the same reason `applyDeposit` re-clamps
 * its allocations.
 *
 * A payment that lands on zero is refused rather than stored, so no child row
 * sits under a payable stating that $0.00 was paid.
 *
 * Deductions are filtered, not trusted: the repeater starts every row blank, and
 * a row the admin added and never filled in should not be stored as a deduction
 * of nothing. Ids are generated here for the same reason deposit references are
 * — the modal has no business spelling one.
 */
export function recordPayment(
  dealId: string,
  payableId: string,
  input: {
    /** `yyyy-mm-dd`. */
    date: string
    grossAmount: number
    deductions: { description: string; amount: number }[]
  },
): { deal: Listing | null; paymentId: string | null } {
  const now = new Date().toISOString()
  const paymentId = `payment-${crypto.randomUUID()}`
  let wrote = false

  const deal = patchListing(dealId, (l) => {
    const back = l.transaction.backOffice
    if (back.status !== 'Approved') return l

    const target = back.payables?.find((p) => p.id === payableId)
    if (!target) return l

    const grossAmount = Math.min(
      Math.max(0, round2(input.grossAmount)),
      payableBalance(target),
    )
    if (grossAmount <= 0) return l

    const deductions: PaymentDeduction[] = input.deductions
      .map((d) => ({
        id: `payment-deduction-${crypto.randomUUID()}`,
        description: d.description.trim(),
        amount: Math.max(0, round2(d.amount)),
      }))
      .filter((d) => d.description !== '' && d.amount > 0)

    const payment: VoucherPayment = {
      id: paymentId,
      date: input.date,
      grossAmount,
      deductions,
      createdAt: now,
      createdById: CURRENT_USER.id,
    }
    wrote = true

    return {
      ...l,
      transaction: {
        ...l.transaction,
        backOffice: {
          ...back,
          payables: (back.payables ?? []).map((p) =>
            p.id === payableId
              ? {
                  ...p,
                  // Sorted by the day the money went out rather than the order
                  // the cheques were filed, so a back-dated correction sits
                  // where it belongs — the same rule `depositsForReceivable`
                  // applies to the rows under a receivable.
                  payments: [...p.payments, payment].sort((a, b) =>
                    a.date.localeCompare(b.date),
                  ),
                }
              : p,
          ),
        },
      },
      updatedAt: now,
    }
  })

  return { deal, paymentId: wrote ? paymentId : null }
}

/**
 * Reverse one cheque.
 *
 * Nothing to put back by hand: a payable's Gross Paid and Net Paid are summed
 * from its payments on read (`payables.ts`), not stored as running totals the
 * way a receivable's `credited` is. So dropping the payment IS the reversal.
 *
 * That difference is deliberate. `credited` is stored because half a dozen
 * readers — `invoiceLineItems` most sharply, which freezes it onto an invoice
 * line — need it without walking the deposits. Nothing outside the payables
 * table reads what a broker has been paid, so there is no total to keep.
 */
export function deletePayment(
  dealId: string,
  payableId: string,
  paymentId: string,
): { deal: Listing | null } {
  return {
    deal: patchListing(dealId, (l) => {
      const back = l.transaction.backOffice
      if (!back.payables?.some((p) => p.id === payableId)) return l

      return {
        ...l,
        transaction: {
          ...l.transaction,
          backOffice: {
            ...back,
            payables: back.payables.map((p) =>
              p.id === payableId
                ? { ...p, payments: p.payments.filter((x) => x.id !== paymentId) }
                : p,
            ),
          },
        },
        updatedAt: new Date().toISOString(),
      }
    }),
  }
}

/**
 * The voucher's payables with the ones this deposit raises appended.
 *
 * Nothing on a Draft or Pending voucher — payables exist only once a voucher is
 * signed off. Returns the existing array untouched in that case, so the spread
 * that calls this cannot accidentally turn `undefined` into `[]` and make a
 * Draft voucher look like one that has been through approval.
 *
 * Idempotent by `depositId`: a deposit that has already raised payables raises
 * none. `applyDeposit` cannot reach that state — its deposit id is fresh — but
 * `approveVoucher` back-fills over a whole list, and a guard that costs one Set
 * makes both paths safe to call twice.
 */
function raisePayables(
  deal: Listing,
  voucher: DealFinancials,
  deposit: Pick<VoucherDeposit, 'id' | 'date' | 'amount'>,
): VoucherPayable[] | undefined {
  const existing = voucher.payables
  if (voucher.status !== 'Approved') return existing
  if ((existing ?? []).some((p) => p.depositId === deposit.id)) return existing

  const raised = payablesForDeposit({
    // `payablesForDeposit` reads only the three fields named above; the rest are
    // filled so the call site does not have to carry a whole deposit around
    // before one exists.
    deposit: {
      ...deposit,
      referenceNumber: '',
      createdAt: '',
      createdById: '',
      receivableAllocations: [],
      deductionAllocations: [],
    },
    brokers: payableBrokers(deal),
    allReceivables: voucher.receivables,
  }).map((row) => ({ ...row, id: `payable-${crypto.randomUUID()}` }))

  return [...(existing ?? []), ...raised]
}

/** Cents. Kept here rather than imported so `deposits.ts` stays free of writers. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Clamp each allocation to its target's balance and drop the ones left at zero. */
function clampAllocations(
  allocations: DepositAllocation[],
  balanceOf: (targetId: string) => number,
): DepositAllocation[] {
  return allocations
    .map((a) => ({
      targetId: a.targetId,
      amount: Math.max(0, Math.min(round2(a.amount), balanceOf(a.targetId))),
    }))
    .filter((a) => a.amount > 0)
}

/** Drop one receivable. The payer stays in Billing, reading $0 until removed. */
export function deleteReceivable(
  dealId: string,
  receivableId: string,
): { deal: Listing | null } {
  return patchReceivables(dealId, (rows) =>
    rows.filter((r) => r.id !== receivableId),
  )
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

/**
 * Bill the selected receivables on one invoice, filed against the deal.
 *
 * Takes receivable ids rather than the rows themselves so the deal in the store
 * is the source of the amounts — the caller's copies could be a render behind.
 * The selection is read in voucher order, not in the order the ids arrive, so
 * the invoice's lines match the table the broker just picked them from.
 *
 * Returns nulls rather than throwing on a selection that cannot be billed. Two
 * cases: nothing selected, and rows that name more than one payer. One invoice
 * bills one party, which is the same rule `canCreateInvoice` applies to enable
 * the button — repeated here because a disabled button is a UI courtesy, not a
 * guarantee about what reaches the store.
 */
export function createInvoiceFromReceivables(
  dealId: string,
  receivableIds: string[],
): { invoiceId: string | null; name: string | null } {
  const nothing = { invoiceId: null, name: null }
  const deal = useDataStore.getState().listings.get(dealId)
  if (!deal) return nothing

  const wanted = new Set(receivableIds)
  const billed = deal.transaction.backOffice.receivables.filter((r) => wanted.has(r.id))
  if (billed.length === 0) return nothing
  if (new Set(billed.map((r) => r.payerContactId)).size > 1) return nothing

  const now = new Date().toISOString()
  const invoiceId = `invoice-${crypto.randomUUID()}`
  const lineItems = invoiceLineItems(billed)
  // `billToCompany` is a property of the payer relationship on this voucher, and
  // every line here names the same payer, so the first line settles it for the
  // invoice. A selection whose rows disagreed about the form would still bill
  // one party; taking the first is what the receivables table shows first.
  const billToCompany = billed[0].billToCompany

  const invoice: DealInvoice = {
    id: invoiceId,
    name: invoiceFileName(
      invoicePayerFileLabel(voucherParty(billed[0].payerContactId), billToCompany),
      nextInvoiceOrdinal(deal),
    ),
    createdAt: now,
    createdById: CURRENT_USER.id,
    payerContactId: billed[0].payerContactId,
    billToCompany,
    dueDate: invoiceDueDate(lineItems),
    lineItems,
  }

  const patched = patchListing(dealId, (l) => ({
    ...l,
    invoices: [...(l.invoices ?? []), invoice],
    updatedAt: now,
  }))

  return patched ? { invoiceId, name: invoice.name } : nothing
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
 * Add segment tags to a contact and persist.
 *
 * Matching is case-insensitive on the way in: adding "vip" to someone who
 * already carries "VIP" is a no-op, not a second chip. The tag facet on the
 * People page is derived from the contacts themselves, so a duplicate that
 * differs only in case would split one segment into two filters that each find
 * half the book. The stored spelling is whatever arrived first.
 *
 * Returns the tags that were actually new, so a caller can report what it did
 * rather than what it was asked to do.
 */
export function addContactTags(
  id: string,
  tags: string[],
): { contact: Contact | null; added: string[] } {
  const existing = useDataStore.getState().contacts.get(id)
  if (!existing) return { contact: null, added: [] }

  const have = new Set(existing.tags.map((t) => t.toLowerCase()))
  const added: string[] = []
  for (const raw of tags) {
    const tag = raw.trim()
    if (!tag || have.has(tag.toLowerCase())) continue
    have.add(tag.toLowerCase())
    added.push(tag)
  }
  if (!added.length) return { contact: existing, added: [] }

  const contact: Contact = { ...existing, tags: [...existing.tags, ...added] }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(id, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact, added }
}

/**
 * Remove segment tags from a contact and persist. Case-insensitive for the same
 * reason as `addContactTags` — "vip" has to take off the chip that reads "VIP",
 * or removal silently does nothing. Returns the tags actually removed, in the
 * spelling the record was carrying.
 */
export function removeContactTags(
  id: string,
  tags: string[],
): { contact: Contact | null; removed: string[] } {
  const existing = useDataStore.getState().contacts.get(id)
  if (!existing) return { contact: null, removed: [] }

  const drop = new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))
  const removed = existing.tags.filter((t) => drop.has(t.toLowerCase()))
  if (!removed.length) return { contact: existing, removed: [] }

  const contact: Contact = {
    ...existing,
    tags: existing.tags.filter((t) => !drop.has(t.toLowerCase())),
  }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(id, contact)
    return { contacts }
  })
  useDataStore.getState().persist()
  return { contact, removed }
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

/** The broker-editable half of one inquiry — see `Contact.inquiryDetails`. */
export type InquiryOverride = NonNullable<Contact['inquiryDetails']>[string]

/**
 * Patch one contact's inquiry on one listing, merging into whatever is already
 * stored there.
 *
 * The Inquiries panel autosaves, so this is called once per control change
 * rather than once per Save press — hence the merge: a write of `accessLevel`
 * must not drop the `caFileName` a previous write put beside it.
 *
 * Only fields a broker actually touched end up here. Everything the panel shows
 * that is *not* in the record stays synthesized by `toInquiry`, which is why
 * this write needs no `SEED_VERSION` move.
 */
export function updateInquiry(
  contactId: string,
  listingId: string,
  patch: InquiryOverride,
): void {
  const existing = useDataStore.getState().contacts.get(contactId)
  if (!existing) return
  const updated: Contact = {
    ...existing,
    inquiryDetails: {
      ...existing.inquiryDetails,
      [listingId]: { ...existing.inquiryDetails?.[listingId], ...patch },
    },
  }
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contactId, updated)
    return { contacts }
  })
  useDataStore.getState().persist()
}

/**
 * Delete one contact's inquiry on one deal — the panel's Delete Inquiry.
 *
 * This deletes the *lead*, not the person: the contact stays in the CRM and the
 * panel's View Contact still reaches them. What goes is their place on this
 * deal's inquiry roster.
 *
 * That roster has two doors (see `getLeadsForProperty`): a contact is on it if
 * they inquired on one of the property's listings, *or* if they are linked to
 * the property at all. Dropping only the inquiry would therefore leave a
 * property-linked contact sitting in the list after the broker deleted them,
 * which reads as a delete that did not work.
 *
 * So the property link goes too — but only once no inquiry on that property
 * remains. Someone who inquired on two suites and lost one is still a lead on
 * the building, and must not be swept out of the other suite's roster.
 */
export function deleteInquiry(contactId: string, listingId: string): void {
  const existing = useDataStore.getState().contacts.get(contactId)
  if (!existing) return

  const remainingInquiries = (existing.inquiredListingIds ?? []).filter(
    (id) => id !== listingId,
  )

  const inquiryDetails = { ...existing.inquiryDetails }
  delete inquiryDetails[listingId]

  const listings = useDataStore.getState().listings
  const propertyId = listings.get(listingId)?.propertyId
  const stillInquiringHere =
    propertyId != null &&
    remainingInquiries.some((id) => listings.get(id)?.propertyId === propertyId)

  const updated: Contact = {
    ...existing,
    inquiredListingIds: remainingInquiries,
    inquiries: remainingInquiries.length,
    inquiryDetails:
      Object.keys(inquiryDetails).length > 0 ? inquiryDetails : undefined,
    propertyIds:
      propertyId != null && !stillInquiringHere
        ? existing.propertyIds.filter((id) => id !== propertyId)
        : existing.propertyIds,
  }

  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts)
    contacts.set(contactId, updated)
    return { contacts }
  })
  useDataStore.getState().persist()
}
