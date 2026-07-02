import { createServerFn } from '@tanstack/react-start'
import { getStore, getListingsForProperty } from '#/data/store'
import type {
  Contact,
  ContactDetail,
  DealSummary,
  Listing,
  ListContactsInput,
} from '#/data/types'

export const listContacts = createServerFn({ method: 'GET' })
  .validator((data: ListContactsInput) => data)
  .handler(async ({ data }): Promise<Contact[]> => {
    const { contacts } = getStore()
    let results = Array.from(contacts.values())

    if (data.role) results = results.filter((c) => c.role === data.role)
    if (data.propertyId) results = results.filter((c) => c.propertyIds.includes(data.propertyId!))

    return results
  })

export const getContactById = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Contact | null> => {
    const { contacts } = getStore()
    return contacts.get(data.id) ?? null
  })

export const getContactDetail = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<ContactDetail | null> => {
    const contact = getStore().contacts.get(data.id)
    if (!contact) return null

    // Linked properties → their listings (deduped by listing id).
    const seen = new Set<string>()
    const listings: Listing[] = []
    for (const propertyId of contact.propertyIds) {
      for (const listing of getListingsForProperty(propertyId)) {
        if (!seen.has(listing.id)) {
          seen.add(listing.id)
          listings.push(listing)
        }
      }
    }

    const deals: DealSummary[] = listings.map((l) => ({
      id: l.id,
      name: l.name,
      city: l.city,
      state: l.state,
      status: l.status,
      dealType: l.dealType,
      planTotal: l.tasks.length,
      planDone: l.tasks.filter((t) => t.status === 'complete').length,
      leadName: l.internalBrokers[0]?.name ?? contact.assignedTo,
    }))

    const openTaskCount = listings.reduce(
      (n, l) =>
        n + l.tasks.filter((t) => t.status === 'open' || t.status === 'overdue').length,
      0,
    )

    return { contact, deals, openTaskCount }
  })
