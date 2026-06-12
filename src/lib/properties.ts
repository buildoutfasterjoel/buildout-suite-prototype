import { createServerFn } from '@tanstack/react-start'
import { getStore } from '#/data/store'
import type { ListPropertiesInput, Property } from '#/data/types'

export const listProperties = createServerFn({ method: 'GET' })
  .inputValidator((data: ListPropertiesInput) => data)
  .handler(async ({ data }): Promise<Property[]> => {
    const { properties } = getStore()
    let results = Array.from(properties.values())

    if (data.status) results = results.filter((p) => p.status === data.status)
    if (data.propertyType) results = results.filter((p) => p.propertyType === data.propertyType)
    if (data.buildingClass) results = results.filter((p) => p.buildingClass === data.buildingClass)
    if (data.city) results = results.filter((p) => p.city.toLowerCase() === data.city!.toLowerCase())
    if (data.state) results = results.filter((p) => p.state === data.state)
    if (data.county) results = results.filter((p) => p.county.toLowerCase() === data.county!.toLowerCase())
    if (data.submarket) results = results.filter((p) => p.submarket === data.submarket)
    if (data.minAskingPrice != null) results = results.filter((p) => p.askingPrice >= data.minAskingPrice!)
    if (data.maxAskingPrice != null) results = results.filter((p) => p.askingPrice <= data.maxAskingPrice!)
    if (data.minCapRate != null) results = results.filter((p) => p.capRate >= data.minCapRate!)
    if (data.maxCapRate != null) results = results.filter((p) => p.capRate <= data.maxCapRate!)
    if (data.minBuildingSqFt != null) results = results.filter((p) => p.buildingSqFt >= data.minBuildingSqFt!)
    if (data.maxBuildingSqFt != null) results = results.filter((p) => p.buildingSqFt <= data.maxBuildingSqFt!)

    return results
  })

export const getPropertyById = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<Property | null> => {
    const { properties } = getStore()
    return properties.get(data.id) ?? null
  })

export const getPropertyBySlug = createServerFn({ method: 'GET' })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<Property | null> => {
    const { properties } = getStore()
    for (const p of properties.values()) {
      if (p.slug === data.slug) return p
    }
    return null
  })

export const getPropertyByApn = createServerFn({ method: 'GET' })
  .inputValidator((data: { apn: string }) => data)
  .handler(async ({ data }): Promise<Property | null> => {
    const { properties } = getStore()
    for (const p of properties.values()) {
      if (p.apn === data.apn) return p
    }
    return null
  })
