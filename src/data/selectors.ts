import { useDataStore } from './dataStore'
import type { Comp, Contact, ContactDetail, ContactTask, DealSummary, Listing, Property, PropertyDetail, PropertyFinancialRecord, PropertyUnit, Task } from './types'
import { getContactsForProperty, getContactShares, getOwnersForProperty } from './store'
import { dealStageFromStatus } from './contactStage'
import { CURRENT_USER, TEAMMATES, type Teammate } from './teammates'

/** All contacts attached to a deal (seller + buyer + other), deduped. */
export function listContactsForDeal(dealId: string): Contact[] {
  const { listings, contacts } = useDataStore.getState()
  const listing = listings.get(dealId)
  if (!listing) return []
  const ids = new Set([
    ...listing.sellerContactIds,
    ...listing.buyerContactIds,
    ...listing.otherContactIds,
  ])
  return [...ids].map((id) => contacts.get(id)).filter((c): c is Contact => !!c)
}

/** All deals a contact is attached to, in any role. Reverse of the listing arrays. */
export function listDealsForContact(contactId: string): Listing[] {
  const { listings } = useDataStore.getState()
  return [...listings.values()].filter(
    (l) =>
      l.sellerContactIds.includes(contactId) ||
      l.buyerContactIds.includes(contactId) ||
      l.otherContactIds.includes(contactId),
  )
}

/**
 * Count of active (non-lost) deals each contact is a party to, keyed by contact
 * id. Powers the People table's "furthest stage + N more" deal-stage cell, so it
 * counts the same deals that set the contact's `dealStage`.
 */
export function activeDealCountsByContact(): Map<string, number> {
  const { listings } = useDataStore.getState()
  const counts = new Map<string, number>()
  for (const l of listings.values()) {
    if (dealStageFromStatus(l.status) === null) continue // Lost deals are off-ladder
    const ids = new Set([
      ...l.sellerContactIds,
      ...l.buyerContactIds,
      ...l.otherContactIds,
    ])
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return counts
}

/** All deals (listings) for a property. */
export function listDealsForProperty(propertyId: string): Listing[] {
  const { listings } = useDataStore.getState()
  return [...listings.values()].filter((l) => l.propertyId === propertyId)
}

/**
 * Everything the contact detail page needs, assembled client-side from the live
 * store so it always reflects client mutations. Used by the People routes.
 */
export function getContactDetailClient(id: string): ContactDetail | null {
  const { contacts } = useDataStore.getState()
  const contact = contacts.get(id)
  if (!contact) return null

  // The deals a contact is a direct party to (seller/buyer/other) — the single
  // source of truth for the contact↔deal relationship. Reciprocal with the deal
  // detail page: every deal shown here lists this contact back among its parties.
  const listings: Listing[] = listDealsForContact(id)

  const deals: DealSummary[] = listings.map((l) => {
    const property = useDataStore.getState().properties.get(l.propertyId)
    return {
      id: l.id,
      propertyId: l.propertyId,
      name: l.name,
      city: property?.city ?? '',
      state: property?.state ?? '',
      status: l.status,
      dealType: l.dealType,
      planTotal: l.tasks.length,
      planDone: l.tasks.filter((t) => t.status === 'complete').length,
      leadName: l.internalBrokers[0]?.name ?? contact.assignedTo,
    }
  })

  // The people who can be assigned a task on this contact = whoever has access
  // (owner + anyone it's shared with). Task assignees are drawn from here so the
  // avatars stay realistic for the contact's sharing.
  const accessRoster: Teammate[] = (() => {
    const seen = new Set<string>()
    const roster: Teammate[] = []
    for (const m of [CURRENT_USER, ...getContactShares(id).map((s) => s.member)]) {
      if (!seen.has(m.id)) {
        seen.add(m.id)
        roster.push(m)
      }
    }
    return roster
  })()
  // Only surface an assignee avatar when the contact is shared with others —
  // for an owner-only contact there's just one possible assignee, so it's noise.
  const isShared = accessRoster.length > 1
  // Stable hash so a given task always maps to the same roster member.
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
  }
  const assigneeFromAccess = (key: string) =>
    accessRoster[hash(key) % accessRoster.length]
  const FULL_ROSTER = [CURRENT_USER, ...TEAMMATES]

  // All the contact's tasks across their deals, each paired with its deal so the
  // Tasks column can show the deal as the task's source. Seeded deal-task
  // assignees are placeholder initials, so we (deterministically) reassign to a
  // member who actually has access to this contact.
  const toView = (l: Listing) => (t: Listing['tasks'][number]): ContactTask => {
    const m = assigneeFromAccess(t.id)
    return {
      id: t.id,
      label: t.label,
      date: t.date,
      status: t.status,
      assigneeInitials: m.initials,
      assigneeName: m.name,
      assigneeAvatarUrl: m.avatarUrl,
      showAssignee: isShared,
      autoGenerated: t.autoGenerated ?? false,
      dealId: l.id,
      dealName: l.name,
    }
  }

  // Standalone tasks created via the Add Task modal and linked to this contact.
  // They aren't tied to a deal, so their source chip is omitted (dealId absent).
  // Newest first, so a just-created task lands at the top of the column.
  const standaloneToView = (t: Task): ContactTask => {
    // Standalone tasks carry a real chosen assignee — resolve it to a teammate.
    const m = FULL_ROSTER.find((r) => r.id === t.assigneeId)
    return {
      id: t.id,
      label: t.name,
      date: t.dueDate,
      status: t.status,
      assigneeInitials: m?.initials ?? t.assigneeInitials,
      assigneeName: m?.name,
      assigneeAvatarUrl: m?.avatarUrl,
      showAssignee: isShared,
      autoGenerated: false,
      dealId: t.dealId ?? undefined,
      dealName: t.dealId
        ? useDataStore.getState().listings.get(t.dealId)?.name
        : undefined,
      editable: true,
      type: t.type,
    }
  }
  const standalone = [...useDataStore.getState().tasks.values()]
    .filter((t) => t.contactId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const tasks: ContactTask[] = [
    ...standalone
      .filter((t) => t.status === 'open' || t.status === 'overdue')
      .map(standaloneToView),
    ...listings.flatMap((l) =>
      l.tasks
        .filter((t) => t.status === 'open' || t.status === 'overdue')
        .map(toView(l)),
    ),
  ]

  const completedTasks: ContactTask[] = [
    ...standalone.filter((t) => t.status === 'complete').map(standaloneToView),
    ...listings.flatMap((l) =>
      l.tasks.filter((t) => t.status === 'complete').map(toView(l)),
    ),
  ]

  const openTaskCount = tasks.length

  return { contact, deals, openTaskCount, tasks, completedTasks }
}

/** Simple case-insensitive omnisearch over the in-memory world. */
export function searchAll(query: string): {
  properties: Property[]
  deals: Listing[]
  contacts: Contact[]
} {
  const q = query.trim().toLowerCase()
  const { properties, listings, contacts } = useDataStore.getState()
  if (!q) return { properties: [], deals: [], contacts: [] }
  const matches = (...fields: Array<string | null | undefined>) =>
    fields.filter(Boolean).join(' ').toLowerCase().includes(q)
  return {
    properties: [...properties.values()].filter((p) =>
      matches(p.name, p.street, p.city, p.state, p.zip, p.submarket, p.propertyType, p.apn),
    ),
    deals: [...listings.values()].filter((l) => {
      const p = properties.get(l.propertyId)
      return matches(l.name, p?.city, p?.state, l.dealType)
    }),
    contacts: [...contacts.values()].filter((c) =>
      matches(c.firstName, c.lastName, c.company, c.email, c.title, c.phone),
    ),
  }
}

/** All comps recorded against a property. */
export function listCompsForProperty(propertyId: string): Comp[] {
  const { comps } = useDataStore.getState()
  return [...comps.values()].filter((c) => c.propertyId === propertyId)
}

/**
 * Everything the property record page needs, assembled client-side from the live
 * store so it always reflects client mutations. Property analogue of
 * {@link getContactDetailClient}.
 */
export function getPropertyDetailClient(id: string): PropertyDetail | null {
  const { properties } = useDataStore.getState()
  const property = properties.get(id)
  if (!property) return null
  return {
    property,
    deals: listDealsForProperty(id),
    owners: getOwnersForProperty(id),
    contacts: getContactsForProperty(id),
    comps: listCompsForProperty(id),
  }
}

/**
 * The current (newest) in-place financial record for a property, or undefined if none.
 * Forward-looking API for Phase 3/4 (Property·Financials history views); not yet wired to a consumer.
 */
export function latestFinancialRecord(property: Property): PropertyFinancialRecord | undefined {
  return property.financialRecords[0]
}

/**
 * Resolve a deal together with the property facts it references. Deals hold no
 * property data of their own — views join through `propertyId` (+ optional `unitId`).
 * Forward-looking API for Phase 3/4 consumers that hold only a deal id and need the deal+property(+unit) bundle. Views that already hold a Listing resolve property facts with getProperty(listing.propertyId) directly, which is why this isn't yet called in-app.
 */
export function selectDealWithProperty(dealId: string):
  | { deal: Listing; property: Property | undefined; unit: PropertyUnit | undefined }
  | undefined {
  const { listings, properties } = useDataStore.getState()
  const deal = listings.get(dealId)
  if (!deal) return undefined
  const property = properties.get(deal.propertyId)
  const unit = deal.unitId && property ? property.units.find((u) => u.id === deal.unitId) : undefined
  return { deal, property, unit }
}
