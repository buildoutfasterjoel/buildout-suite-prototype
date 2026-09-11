import type { Property, PropertyType, PropertyStatus } from '#/data/types'
import type { SpaceStatus } from '#/data/propertySpaces'

/** Building-size bands offered by the Properties toolbar. */
export type SizeBand = 'all' | 'lt10k' | '10k-50k' | '50k-100k' | 'gt100k'

export const SIZE_BAND_LABELS: Record<SizeBand, string> = {
  all: 'Any size',
  lt10k: 'Under 10,000 SF',
  '10k-50k': '10,000 – 50,000 SF',
  '50k-100k': '50,000 – 100,000 SF',
  gt100k: 'Over 100,000 SF',
}

const SIZE_BAND_RANGES: Record<Exclude<SizeBand, 'all'>, [number, number]> = {
  lt10k: [0, 10_000],
  '10k-50k': [10_000, 50_000],
  '50k-100k': [50_000, 100_000],
  gt100k: [100_000, Number.POSITIVE_INFINITY],
}

export const SIZE_BANDS = Object.keys(SIZE_BAND_LABELS) as SizeBand[]

/**
 * The Stage facet's values. `'none'` is a real, selectable option rather than a
 * gap: most of the database is properties with no deal, and "show me the ones
 * I'm not transacting on" is the question that finds them.
 */
export type StageFacetValue = PropertyStatus | 'none'

export interface PropertyIndexFilter {
  query: string
  types: Set<PropertyType>
  statuses: Set<StageFacetValue>
  /** Omitted means no size constraint — same as `'all'`. */
  size?: SizeBand
  /**
   * Space availability. A property matches when **any** of its spaces carries
   * one of these statuses — a building with 3 of 6 available is in the
   * `Available` set. This is the reason `propertyAvailability` has no `Mixed`
   * value: a single mixed label would exclude exactly the buildings this
   * facet exists to find.
   */
  availability?: Set<SpaceStatus>
  /**
   * The statuses a property's spaces carry, or null for a property with no
   * spaces. Injected rather than read from the store so this stays a pure
   * function over the list it is given.
   */
  availabilityOf?: (p: Property) => ReadonlySet<SpaceStatus> | null
}

function matchesSize(sqFt: number, band: SizeBand | undefined): boolean {
  if (!band || band === 'all') return true
  const [min, max] = SIZE_BAND_RANGES[band]
  return sqFt >= min && sqFt < max
}

/** Pure filter for the Properties index: substring query + type/status/size facets. */
export function filterProperties(properties: Property[], f: PropertyIndexFilter): Property[] {
  const q = f.query.trim().toLowerCase()
  return properties.filter((p) => {
    if (f.types.size > 0 && !f.types.has(p.propertyType)) return false
    if (f.statuses.size > 0 && !f.statuses.has(p.status ?? 'none')) return false
    if (!matchesSize(p.buildingSqFt, f.size)) return false
    if (f.availability && f.availability.size > 0) {
      const has = f.availabilityOf?.(p)
      // A property with no spaces has no availability to match.
      if (!has || ![...f.availability].some((s) => has.has(s))) return false
    }
    if (!q) return true
    const haystack = [p.name, p.street, p.city, p.state, p.zip, p.submarket]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
