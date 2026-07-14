import type { Property, PropertyType, PropertyStatus } from '#/data/types'

export interface PropertyIndexFilter {
  query: string
  types: Set<PropertyType>
  statuses: Set<PropertyStatus>
}

/** Pure filter for the Properties index: substring query + type/status facets. */
export function filterProperties(properties: Property[], f: PropertyIndexFilter): Property[] {
  const q = f.query.trim().toLowerCase()
  return properties.filter((p) => {
    if (f.types.size > 0 && !f.types.has(p.propertyType)) return false
    if (f.statuses.size > 0 && !f.statuses.has(p.status)) return false
    if (!q) return true
    const haystack = [p.name, p.street, p.city, p.state, p.zip, p.submarket]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
