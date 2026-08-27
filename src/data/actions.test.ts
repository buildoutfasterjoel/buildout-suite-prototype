import { describe, expect, it } from 'vitest'
import { useDataStore } from './dataStore'
import {
  createCallList,
  commitStageTransition,
  createContact,
  createDeal,
  createEmailDraft,
  createTask,
  deleteTask,
  updateTask,
  linkContactToDeal,
  unlinkContactFromDeal,
  updateDeal,
  updateDealMarketing,
  updateDealStage,
  updateDealTransaction,
  submitVoucher,
  addReceivable,
  applyDeposit,
  deleteReceivable,
  reopenVoucher,
  updateReceivable,
  saveVoucherDraft,
} from './actions'
import { emptyDraft } from './createListing'
import { closeProbabilityForStage, commissionForecast } from './commission'
import { publishReadiness } from './stageGates'
import { getContactDetailClient, listContactsForDeal } from './selectors'
import { getListing } from './store'
import { TEAMMATES } from './teammates'
import { setNotifier, type NotifyItem } from '#/lib/notify'

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
    const { deal: updated } = updateDeal(deal.id, { dealType: 'Lease' })
    expect(updated?.dealType).toBe('Lease')
    expect(useDataStore.getState().listings.get(deal.id)?.dealType).toBe('Lease')
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

  it('createDeal starts in Pitching, unpublished, with the default suggested documents', () => {
    const draft = { ...emptyDraft(), name: 'Gate Test', address: '9 Gate St' }
    const { deal } = createDeal(draft)
    // A brand-new proposal starts in Pitching and is not published.
    expect(deal.status).toBe('proposal')
    expect(deal.publishedAt).toBeNull()
    // With no explicit selection, the default suggested docs are generated (all AI-flagged).
    expect(deal.documents?.length ?? 0).toBeGreaterThan(0)
    expect(deal.documents?.every((d) => d.aiGenerated === true)).toBe(true)
  })

  it('createDeal honors an explicit suggested-documents selection', () => {
    const draft = { ...emptyDraft(), name: 'No Docs', address: '1 Empty Way', suggestedDocuments: [] }
    const { deal } = createDeal(draft)
    // An explicit empty selection generates no documents (no fallback).
    expect(deal.documents?.length ?? 0).toBe(0)
  })

  it('createDeal can start a deal directly in a live stage, still unpublished and not publish-ready', () => {
    const draft = { ...emptyDraft(), name: 'In Flight', address: '5 Active Blvd', initialStage: 'active' as const }
    const { deal } = createDeal(draft)
    expect(deal.status).toBe('active')
    // Direct creation never publishes — that only happens through the gate.
    expect(deal.publishedAt).toBeNull()
    // Missing the publish-gate info, so it flags as not ready.
    expect(publishReadiness(deal).ready).toBe(false)
    expect(publishReadiness(deal).missing.length).toBeGreaterThan(0)
    // History records the stage it was created under.
    expect(deal.history.at(-1)).toMatchObject({ toStage: 'active' })
  })

  it('createDeal in Pitching leaves publishReadiness unqualified (no live-stage warning implied)', () => {
    const draft = { ...emptyDraft(), name: 'Pitch Ready', address: '7 Pitch Rd' }
    const { deal } = createDeal(draft)
    // A freshly-created proposal has no listing content yet, so it is not publish-ready.
    expect(publishReadiness(deal).ready).toBe(false)
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
    const items: NotifyItem[] = []
    setNotifier({
      show: (i) => {
        items.push(i)
        return `toast-${items.length}`
      },
      dismiss: () => {},
    })
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

  it('a deal is created already weighted for its starting stage', () => {
    const { deal } = createDeal({ ...emptyDraft(), name: 'Weighted', address: '1 Weight Way' })
    // A brand-new deal used to sit at 0%, contributing nothing to the forecast
    // no matter which stage it started in.
    expect(deal.transaction.closeProbability).toBe(closeProbabilityForStage(deal.status))
  })

  it('commitStageTransition raises the close probability as a deal advances', () => {
    const { deal } = createDeal({ ...emptyDraft(), name: 'Ladder', address: '2 Ladder Ln' })
    const start = deal.transaction.closeProbability

    const { deal: active } = commitStageTransition({
      dealId: deal.id, targetStage: 'active', actor: 'Jane', publish: true,
    })
    const { deal: uc } = commitStageTransition({
      dealId: deal.id, targetStage: 'under-contract', actor: 'Jane',
    })
    const { deal: closed } = commitStageTransition({
      dealId: deal.id, targetStage: 'closed', actor: 'Jane',
    })

    expect(active!.transaction.closeProbability).toBeGreaterThan(start)
    expect(uc!.transaction.closeProbability).toBeGreaterThan(active!.transaction.closeProbability)
    expect(closed!.transaction.closeProbability).toBe(100)
  })

  it('the commission forecast grows as the same deal crosses the board', () => {
    const { deal } = createDeal({ ...emptyDraft(), name: 'Forecast', address: '3 Forecast Ct' })
    // Give it a commission to weight; without one every stage forecasts 0.
    updateDealTransaction(deal.id, { commissionAmount: 100_000 })
    const at = () => commissionForecast([useDataStore.getState().listings.get(deal.id)!]).brokerage

    const pitching = at()
    commitStageTransition({ dealId: deal.id, targetStage: 'active', actor: 'Jane', publish: true })
    const active = at()
    commitStageTransition({ dealId: deal.id, targetStage: 'under-contract', actor: 'Jane' })
    const underContract = at()
    commitStageTransition({ dealId: deal.id, targetStage: 'closed', actor: 'Jane' })

    expect(active).toBeGreaterThan(pitching)
    expect(underContract).toBeGreaterThan(active)
    // A closed deal's commission counts in full.
    expect(at()).toBe(100_000)
  })

  it('a lost deal drops out of the forecast entirely', () => {
    const { deal } = createDeal({ ...emptyDraft(), name: 'Lost', address: '4 Lost Rd' })
    updateDealTransaction(deal.id, { commissionAmount: 100_000 })
    commitStageTransition({ dealId: deal.id, targetStage: 'active', actor: 'Jane', publish: true })
    commitStageTransition({ dealId: deal.id, targetStage: 'inactive', actor: 'Jane' })
    const lost = useDataStore.getState().listings.get(deal.id)!
    expect(lost.transaction.closeProbability).toBe(0)
    expect(commissionForecast([lost])).toEqual({ you: 0, brokerage: 0 })
  })

  it('updateDealStage re-weights on the ungated path too', () => {
    const { deal } = createDeal({ ...emptyDraft(), name: 'Ungated', address: '5 Ungated Way' })
    const { deal: moved } = updateDealStage(deal.id, 'under-contract')
    expect(moved?.transaction.closeProbability).toBe(
      closeProbabilityForStage('under-contract'),
    )
  })

  it('updateDealTransaction merges into transaction without dropping sibling fields', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const originalPricePerSqFt = deal.transaction.pricePerSqFt

    const { deal: updated } = updateDealTransaction(deal.id, {
      salePrice: 2_000_000,
      commissionPct: 3,
      commissionAmount: 60_000,
    })

    expect(updated?.transaction.salePrice).toBe(2_000_000)
    expect(updated?.transaction.commissionPct).toBe(3)
    expect(updated?.transaction.commissionAmount).toBe(60_000)
    // Sibling fields survive the merge.
    expect(updated?.transaction.pricePerSqFt).toBe(originalPricePerSqFt)
  })

  it('createTask inserts an open task and surfaces it on the linked contact', () => {
    const contact = [...useDataStore.getState().contacts.values()][0]
    const { task } = createTask({
      name: '  Send proposal  ',
      contactId: contact.id,
      dueDate: '2026-08-01',
    })
    // Trimmed, defaulted, and stored.
    expect(task.name).toBe('Send proposal')
    expect(task.status).toBe('open')
    expect(task.source).toBe('contact')
    expect(useDataStore.getState().tasks.get(task.id)).toBeTruthy()

    // Appears (newest-first) in the contact detail's open tasks column.
    const detail = getContactDetailClient(contact.id)
    expect(detail?.tasks[0]?.id).toBe(task.id)
    expect(detail?.tasks[0]?.label).toBe('Send proposal')
    expect(detail?.tasks[0]?.dealId).toBeUndefined()
  })

  it('createTask resolves assignee initials from the teammate roster', () => {
    const teammate = TEAMMATES[0]
    const { task } = createTask({ name: 'Call back', assigneeId: teammate.id })
    expect(task.assigneeInitials).toBe(teammate.initials)
  })

  it('updateTask edits fields in place while preserving id, status, and createdAt', () => {
    const { task } = createTask({ name: 'Draft', dueDate: '2026-08-01' })
    const { task: updated } = updateTask(task.id, {
      name: '  Draft v2  ',
      dueDate: '2026-09-15',
      type: 'call',
    })
    expect(updated?.id).toBe(task.id)
    expect(updated?.createdAt).toBe(task.createdAt)
    expect(updated?.status).toBe('open')
    expect(updated?.name).toBe('Draft v2')
    expect(updated?.dueDate).toBe('2026-09-15')
    expect(updated?.type).toBe('call')
    expect(useDataStore.getState().tasks.get(task.id)?.name).toBe('Draft v2')
  })

  it('updateTask returns null for an unknown id', () => {
    expect(updateTask('does-not-exist', { name: 'x' }).task).toBeNull()
  })

  it('deleteTask removes the task from the store', () => {
    const { task } = createTask({ name: 'Temp' })
    expect(useDataStore.getState().tasks.get(task.id)).toBeTruthy()
    deleteTask(task.id)
    expect(useDataStore.getState().tasks.get(task.id)).toBeUndefined()
  })

  it('submitVoucher moves a Draft voucher to Pending', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    const { deal: updated } = submitVoucher(deal.id)
    expect(updated?.transaction.backOffice.status).toBe('Pending')
  })

  it('submitVoucher leaves a voucher that is already with an approver alone', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    for (const status of ['Pending', 'Approved'] as const) {
      const { deal: seeded } = updateDealTransaction(deal.id, {
        backOffice: { ...deal.transaction.backOffice, status },
      })
      const { deal: updated } = submitVoucher(deal.id)
      expect(updated?.transaction.backOffice.status).toBe(status)
      // Referentially equal, so a no-op submit cannot re-render the page.
      expect(updated).toBe(seeded)
    }
  })

  it('submitVoucher returns null for an unknown deal', () => {
    expect(submitVoucher('does-not-exist').deal).toBeNull()
  })
  it('reopenVoucher takes a Pending voucher back to Draft', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Pending' },
    })
    const { deal: updated } = reopenVoucher(deal.id)
    expect(updated?.transaction.backOffice.status).toBe('Draft')
  })

  it('reopenVoucher will not reopen an Approved voucher', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const approval = { reviewerId: TEAMMATES[0].id, approvedOn: '2026-08-01' }
    const { deal: seeded } = updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Approved', approval },
    })
    // Approved is terminal: a sign-off describes these figures, so the broker
    // cannot take it back by reopening the record.
    expect(reopenVoucher(deal.id).deal).toBe(seeded)
    expect(seeded?.transaction.backOffice.status).toBe('Approved')
    expect(seeded?.transaction.backOffice.approval).toEqual(approval)
  })

  it('reopenVoucher leaves a Draft alone, and a reopened voucher can be resubmitted', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    const { deal: seeded } = updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    expect(reopenVoucher(deal.id).deal).toBe(seeded)
    expect(submitVoucher(deal.id).deal?.transaction.backOffice.status).toBe('Pending')
  })

  it('reopenVoucher returns null for an unknown deal', () => {
    expect(reopenVoucher('does-not-exist').deal).toBeNull()
  })

  it('saveVoucherDraft replaces the deductions and brokers on a Draft voucher', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    const deductions = [
      {
        id: 'ded-1',
        category: 'Broker of Record',
        description: 'BOR fee',
        pct: 5,
        amount: 2500,
        covered: null,
      },
    ]
    const brokers = [
      {
        id: 'brk-1',
        name: 'Annie Harrison',
        role: 'Primary Broker - Sell Side',
        email: 'annie@example.com',
        side: 'internal' as const,
        commissionSplitPct: 60,
        grossCommission: 12000,
        commissionPlan: 'Standard Commission Plan',
        personalSplitPct: 55,
        transactionSide: 'Dual' as const,
      },
    ]
    const { deal: updated } = saveVoucherDraft(deal.id, {
      preSplitDeductions: deductions,
      internalBrokers: brokers,
      partyContactIds: deal.buyerContactIds,
      payerContactIds: deal.transaction.backOffice.payerContactIds,
    })
    expect(updated?.transaction.backOffice.preSplitDeductions).toEqual(deductions)
    expect(updated?.internalBrokers).toEqual(brokers)
  })

  it('saveVoucherDraft will not write to a submitted or approved voucher', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    for (const status of ['Pending', 'Approved'] as const) {
      const { deal: seeded } = updateDealTransaction(deal.id, {
        backOffice: { ...deal.transaction.backOffice, status },
      })
      const beforeDeductions = seeded?.transaction.backOffice.preSplitDeductions
      const beforeBrokers = seeded?.internalBrokers
      const { deal: updated } = saveVoucherDraft(deal.id, {
        preSplitDeductions: [],
        internalBrokers: [],
        partyContactIds: [],
        payerContactIds: [],
      })
      expect(updated).toBe(seeded)
      expect(updated?.transaction.backOffice.preSplitDeductions).toBe(beforeDeductions)
      expect(updated?.internalBrokers).toBe(beforeBrokers)
    }
  })

  it('saveVoucherDraft returns null for an unknown deal', () => {
    const empty = {
      preSplitDeductions: [],
      internalBrokers: [],
      partyContactIds: [],
      payerContactIds: [],
    }
    expect(saveVoucherDraft('does-not-exist', empty).deal).toBeNull()
  })

  it('saveVoucherDraft writes the party list to buyers on a sale', () => {
    const deal = [...useDataStore.getState().listings.values()].find(
      (l) => l.dealType === 'Sale',
    )!
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    saveVoucherDraft(deal.id, {
      preSplitDeductions: [],
      internalBrokers: deal.internalBrokers,
      partyContactIds: ['buyer-1'],
      payerContactIds: ['payer-1'],
    })
    const saved = getListing(deal.id)!
    expect(saved.buyerContactIds).toEqual(['buyer-1'])
    expect(saved.transaction.backOffice.payerContactIds).toEqual(['payer-1'])
  })

  it('saveVoucherDraft writes the party list to tenants on a lease', () => {
    // The same draft field lands in a different array. One list in, the deal
    // type decides where it goes — so a sale can never hold a tenant list.
    const deal = [...useDataStore.getState().listings.values()].find(
      (l) => l.dealType === 'Lease',
    )!
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    saveVoucherDraft(deal.id, {
      preSplitDeductions: [],
      internalBrokers: deal.internalBrokers,
      partyContactIds: ['tenant-1'],
      payerContactIds: [],
    })
    const saved = getListing(deal.id)!
    expect(saved.tenantContactIds).toEqual(['tenant-1'])
    expect(saved.buyerContactIds).not.toContain('tenant-1')
  })

  it('saveVoucherDraft rebuilds relatedContactsLabel from the saved parties', () => {
    // The label is a denormalized string the Back Office vouchers list shows
    // and searches. It leads with the first seller, so editing the buyer list
    // alone never moves the leading name — but it does move the trailing
    // count, which is exactly what a stale, un-rebuilt label would get wrong.
    // Asserting the exact string (not a `toContain`) is what makes that catch
    // real: a `toContain(seller.firstName)` would pass whether or not the
    // rebuild ran at all, since that name sits in both the old and new label.
    const deal = [...useDataStore.getState().listings.values()].find(
      (l) => l.dealType === 'Sale' && l.sellerContactIds.length > 0,
    )!
    const seller = useDataStore.getState().contacts.get(deal.sellerContactIds[0])!
    const before = deal.transaction.backOffice.relatedContactsLabel
    // One more party than the deal already has, so the "& N more" count is
    // guaranteed to differ from `before` — a copy-pasted stale label cannot
    // coincidentally match.
    const newParties = [...useDataStore.getState().contacts.values()]
      .filter((c) => !deal.sellerContactIds.includes(c.id))
      .slice(0, deal.buyerContactIds.length + 1)
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    saveVoucherDraft(deal.id, {
      preSplitDeductions: [],
      internalBrokers: deal.internalBrokers,
      partyContactIds: newParties.map((c) => c.id),
      payerContactIds: [],
    })
    const totalParties = deal.sellerContactIds.length + newParties.length
    const expected =
      totalParties > 1
        ? `${seller.firstName} ${seller.lastName} & ${totalParties - 1} more`
        : `${seller.firstName} ${seller.lastName}`
    const after = getListing(deal.id)!.transaction.backOffice.relatedContactsLabel
    expect(after).toBe(expected)
    expect(after).not.toBe(before)
  })

  it('saveVoucherDraft leaves a submitted voucher alone', () => {
    // The Draft-only guard has to cover the new fields too, or the page's
    // freeze is only skin-deep.
    for (const status of ['Pending', 'Approved'] as const) {
      const deal = [...useDataStore.getState().listings.values()][0]!
      updateDealTransaction(deal.id, {
        backOffice: { ...deal.transaction.backOffice, status, payerContactIds: [] },
      })
      saveVoucherDraft(deal.id, {
        preSplitDeductions: [],
        internalBrokers: deal.internalBrokers,
        partyContactIds: ['nope'],
        payerContactIds: ['nope'],
      })
      const saved = getListing(deal.id)!
      expect(saved.transaction.backOffice.payerContactIds).toEqual([])
      expect(saved.buyerContactIds).not.toContain('nope')
    }
  })

  it('a voucher can go Draft → Pending → Draft → Pending', () => {
    const deal = [...useDataStore.getState().listings.values()][0]
    updateDealTransaction(deal.id, {
      backOffice: { ...deal.transaction.backOffice, status: 'Draft' },
    })
    const status = () =>
      useDataStore.getState().listings.get(deal.id)?.transaction.backOffice.status
    submitVoucher(deal.id)
    expect(status()).toBe('Pending')
    reopenVoucher(deal.id)
    expect(status()).toBe('Draft')
    submitVoucher(deal.id)
    expect(status()).toBe('Pending')
  })
})

describe('receivable writes', () => {
  function draftDeal() {
    const deal = [...useDataStore.getState().listings.values()][0]!
    updateDealTransaction(deal.id, {
      backOffice: {
        ...deal.transaction.backOffice,
        status: 'Draft',
        payerContactIds: [],
        receivables: [],
      },
    })
    return deal
  }

  const input = {
    payerContactId: 'c-payer',
    billToCompany: true,
    dueDate: '2026-06-22',
    billingDescription: 'Full amount due on receipt',
    amount: 5850,
  }

  it('addReceivable bills a new line, starting uncredited', () => {
    const deal = draftDeal()
    addReceivable(deal.id, input)
    const rows = getListing(deal.id)!.transaction.backOffice.receivables
    expect(rows).toHaveLength(1)
    expect(rows[0]!.amount).toBe(5850)
    expect(rows[0]!.billToCompany).toBe(true)
    expect(rows[0]!.credited).toBe(0)
  })

  it('addReceivable puts an unlisted payer into Billing', () => {
    // Creating a receivable is how a payer arrives — a line billing somebody the
    // Billing section does not list would put two answers to "who is billed" on
    // one page.
    const deal = draftDeal()
    addReceivable(deal.id, input)
    expect(
      getListing(deal.id)!.transaction.backOffice.payerContactIds,
    ).toEqual(['c-payer'])
  })

  it('addReceivable does not list an existing payer twice', () => {
    const deal = draftDeal()
    addReceivable(deal.id, input)
    addReceivable(deal.id, { ...input, amount: 100 })
    const back = getListing(deal.id)!.transaction.backOffice
    expect(back.payerContactIds).toEqual(['c-payer'])
    expect(back.receivables).toHaveLength(2)
  })

  it('updateReceivable edits one row and leaves the rest alone', () => {
    const deal = draftDeal()
    addReceivable(deal.id, input)
    addReceivable(deal.id, { ...input, amount: 100 })
    const [first, second] = getListing(deal.id)!.transaction.backOffice.receivables
    updateReceivable(deal.id, first!.id, { amount: 1, billToCompany: false })
    const rows = getListing(deal.id)!.transaction.backOffice.receivables
    expect(rows.find((r) => r.id === first!.id)!.amount).toBe(1)
    expect(rows.find((r) => r.id === first!.id)!.billToCompany).toBe(false)
    expect(rows.find((r) => r.id === second!.id)!.amount).toBe(100)
  })

  it('deleteReceivable drops the row but leaves its payer in Billing', () => {
    // A payer with nothing billed is a real state the Billing section renders as
    // $0. Removing them is a deliberate act, not a side effect of deleting a line.
    const deal = draftDeal()
    addReceivable(deal.id, input)
    const row = getListing(deal.id)!.transaction.backOffice.receivables[0]!
    deleteReceivable(deal.id, row.id)
    const back = getListing(deal.id)!.transaction.backOffice
    expect(back.receivables).toHaveLength(0)
    expect(back.payerContactIds).toEqual(['c-payer'])
  })

  it('all three refuse a Pending voucher, and all three allow an Approved one', () => {
    // The guard that differs from `saveVoucherDraft`. An Approved voucher still
    // accepts additions — that is why the Receivables section stays live there —
    // so a Draft-only guard would have made every control on it silently dead.
    for (const status of ['Pending', 'Approved'] as const) {
      const deal = draftDeal()
      addReceivable(deal.id, input)
      const seeded = getListing(deal.id)!.transaction.backOffice.receivables[0]!
      updateDealTransaction(deal.id, {
        backOffice: { ...getListing(deal.id)!.transaction.backOffice, status },
      })

      addReceivable(deal.id, { ...input, amount: 42 })
      updateReceivable(deal.id, seeded.id, { amount: 7 })
      const back = getListing(deal.id)!.transaction.backOffice
      if (status === 'Pending') {
        expect(back.receivables).toHaveLength(1)
        expect(back.receivables[0]!.amount).toBe(5850)
      } else {
        expect(back.receivables).toHaveLength(2)
        expect(back.receivables.find((r) => r.id === seeded.id)!.amount).toBe(7)
      }
    }
  })
})

describe('applyDeposit', () => {
  /** A Draft voucher carrying one $10,000 receivable and one $1,000 deduction. */
  function voucherWithOneLine() {
    const deal = [...useDataStore.getState().listings.values()][0]!
    updateDealTransaction(deal.id, {
      backOffice: {
        ...deal.transaction.backOffice,
        status: 'Draft',
        payerContactIds: [],
        receivables: [],
        deposits: [],
        preSplitDeductions: [
          {
            id: 'd1',
            category: 'Marketing',
            description: 'Signage',
            pct: 0,
            amount: 1000,
            covered: null,
          },
        ],
      },
    })
    addReceivable(deal.id, {
      payerContactId: 'c-payer',
      billToCompany: false,
      dueDate: '2026-06-22',
      billingDescription: 'Full Payment',
      amount: 10000,
    })
    const row = getListing(deal.id)!.transaction.backOffice.receivables[0]!
    return { deal, row }
  }

  it('files the deposit and moves credited and covered', () => {
    const { deal, row } = voucherWithOneLine()
    applyDeposit(deal.id, {
      date: '2026-08-27',
      amount: 2500,
      referenceNumber: '123',
      receivableAllocations: [{ targetId: row.id, amount: 2500 }],
      deductionAllocations: [{ targetId: 'd1', amount: 250 }],
    })
    const back = getListing(deal.id)!.transaction.backOffice
    expect(back.deposits).toHaveLength(1)
    expect(back.deposits![0]!.amount).toBe(2500)
    expect(back.deposits![0]!.referenceNumber).toBe('123')
    expect(back.receivables[0]!.credited).toBe(2500)
    expect(back.preSplitDeductions[0]!.covered).toBe(250)
  })

  it('keeps an overridden allocation exactly as it was entered', () => {
    // The whole point of the Override toggle: the split the admin saved is the
    // record of where the money went, not a default to be recomputed on read.
    const { deal, row } = voucherWithOneLine()
    applyDeposit(deal.id, {
      date: '2026-08-27',
      amount: 5000,
      referenceNumber: '',
      receivableAllocations: [{ targetId: row.id, amount: 1234.56 }],
      deductionAllocations: [],
    })
    const back = getListing(deal.id)!.transaction.backOffice
    expect(back.deposits![0]!.receivableAllocations).toEqual([
      { targetId: row.id, amount: 1234.56 },
    ])
    // The deposit still states the cash that arrived, whatever was allocated.
    expect(back.deposits![0]!.amount).toBe(5000)
    expect(back.receivables[0]!.credited).toBe(1234.56)
  })

  it('clamps an allocation to what the line still owes', () => {
    const { deal, row } = voucherWithOneLine()
    applyDeposit(deal.id, {
      date: '2026-08-27',
      amount: 99999,
      referenceNumber: '',
      receivableAllocations: [{ targetId: row.id, amount: 99999 }],
      deductionAllocations: [{ targetId: 'd1', amount: 99999 }],
    })
    const back = getListing(deal.id)!.transaction.backOffice
    expect(back.receivables[0]!.credited).toBe(10000)
    expect(back.preSplitDeductions[0]!.covered).toBe(1000)
  })

  it('drops allocations that moved nothing, and the deposit if none did', () => {
    const { deal, row } = voucherWithOneLine()
    applyDeposit(deal.id, {
      date: '2026-08-27',
      amount: 500,
      referenceNumber: '',
      receivableAllocations: [{ targetId: row.id, amount: 500 }],
      deductionAllocations: [{ targetId: 'd1', amount: 0 }],
    })
    let back = getListing(deal.id)!.transaction.backOffice
    expect(back.deposits![0]!.deductionAllocations).toEqual([])

    // A deposit naming only lines that cannot take money is not filed at all.
    applyDeposit(deal.id, {
      date: '2026-08-27',
      amount: 500,
      referenceNumber: '',
      receivableAllocations: [{ targetId: 'gone', amount: 500 }],
      deductionAllocations: [],
    })
    back = getListing(deal.id)!.transaction.backOffice
    expect(back.deposits).toHaveLength(1)
  })

  it('accumulates across deposits rather than overwriting', () => {
    const { deal, row } = voucherWithOneLine()
    const apply = (amount: number) =>
      applyDeposit(deal.id, {
        date: '2026-08-27',
        amount,
        referenceNumber: '',
        receivableAllocations: [{ targetId: row.id, amount }],
        deductionAllocations: [{ targetId: 'd1', amount: amount / 10 }],
      })
    apply(2000)
    apply(3000)
    const back = getListing(deal.id)!.transaction.backOffice
    expect(back.deposits).toHaveLength(2)
    expect(back.receivables[0]!.credited).toBe(5000)
    expect(back.preSplitDeductions[0]!.covered).toBe(500)
  })

  it('refuses a Pending voucher and allows an Approved one', () => {
    for (const status of ['Pending', 'Approved'] as const) {
      const { deal, row } = voucherWithOneLine()
      updateDealTransaction(deal.id, {
        backOffice: { ...getListing(deal.id)!.transaction.backOffice, status },
      })
      applyDeposit(deal.id, {
        date: '2026-08-27',
        amount: 100,
        referenceNumber: '',
        receivableAllocations: [{ targetId: row.id, amount: 100 }],
        deductionAllocations: [],
      })
      const back = getListing(deal.id)!.transaction.backOffice
      expect(back.deposits ?? []).toHaveLength(status === 'Pending' ? 0 : 1)
    }
  })
})
