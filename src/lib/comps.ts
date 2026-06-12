import { createServerFn } from '@tanstack/react-start'
import { getStore } from '#/data/store'
import type { Comp, ListCompsInput } from '#/data/types'

export const listComps = createServerFn({ method: 'GET' })
  .inputValidator((data: ListCompsInput) => data)
  .handler(async ({ data }): Promise<Comp[]> => {
    const { comps } = getStore()
    let results = Array.from(comps.values())

    if (data.propertyId) results = results.filter((c) => c.propertyId === data.propertyId)
    if (data.compType) results = results.filter((c) => c.compType === data.compType)
    if (data.minDate) results = results.filter((c) => c.date >= data.minDate!)
    if (data.maxDate) results = results.filter((c) => c.date <= data.maxDate!)

    return results
  })

export const getCompsByPropertyId = createServerFn({ method: 'GET' })
  .inputValidator((data: { propertyId: string }) => data)
  .handler(async ({ data }): Promise<Comp[]> => {
    const { comps } = getStore()
    return Array.from(comps.values()).filter((c) => c.propertyId === data.propertyId)
  })

export const getCompById = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Comp | null> => {
    const { comps } = getStore()
    return comps.get(data.id) ?? null
  })
