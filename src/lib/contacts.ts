import { createServerFn } from '@tanstack/react-start'
import { getStore } from '#/data/store'
import type { Contact, ListContactsInput } from '#/data/types'

export const listContacts = createServerFn({ method: 'GET' })
  .inputValidator((data: ListContactsInput) => data)
  .handler(async ({ data }): Promise<Contact[]> => {
    const { contacts } = getStore()
    let results = Array.from(contacts.values())

    if (data.role) results = results.filter((c) => c.role === data.role)
    if (data.propertyId) results = results.filter((c) => c.propertyIds.includes(data.propertyId!))

    return results
  })

export const getContactById = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Contact | null> => {
    const { contacts } = getStore()
    return contacts.get(data.id) ?? null
  })
