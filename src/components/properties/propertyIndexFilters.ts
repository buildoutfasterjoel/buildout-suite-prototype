import type {
  BuildingClass,
  DealType,
  Listing,
  Property,
  PropertyStatus,
  PropertyType,
} from '#/data/types'
import type { SpaceRow, SpaceStatus } from '#/data/propertySpaces'

/**
 * The Properties index's filters, shaped after Buildout's own property index
 * (buildout.com/research/properties, reviewed 2026-09-11): one dropdown per
 * group — Property & Building · Availability · Location · View · Sale/Lease —
 * with free min/max ranges rather than fixed size bands. Every field here is
 * one production has and this data can answer; production's Investment Type,
 * mortgage fields, micromarket and Custom Fields are left out because nothing
 * in the model backs them.
 *
 * Two of ours that production lacks: **Space Availability** (the derived
 * per-space status set) and, in the same spirit, Building Size and Available
 * SF read a building's *spaces* as well as the building — LoopNet's rule for
 * lease inventory, so a 400,000 SF tower is a hit for "under 10,000 SF"
 * through its 1,200 SF suite, and that suite is the one the row unfolds.
 */

export interface NumRange {
  min: number | null
  max: number | null
}

export const EMPTY_RANGE: NumRange = { min: null, max: null }

export function rangeSet(r: NumRange | undefined): boolean {
  return !!r && (r.min != null || r.max != null)
}

export function inRange(value: number | null | undefined, r: NumRange | undefined): boolean {
  if (!rangeSet(r)) return true
  if (value == null || Number.isNaN(value)) return false
  if (r!.min != null && value < r!.min) return false
  if (r!.max != null && value > r!.max) return false
  return true
}

/**
 * The Stage facet's values. `'none'` is a real, selectable option rather than a
 * gap: most of the database is properties with no deal, and "show me the ones
 * I'm not transacting on" is the question that finds them.
 */
export type StageFacetValue = PropertyStatus | 'none'

export type LotUnit = 'sf' | 'acres'

export interface PropertyFacetState {
  // ── Property & Building ──
  types: PropertyType[]
  classes: BuildingClass[]
  /** SF — the building, or any space in it. */
  buildingSize: NumRange
  lotSize: NumRange
  lotUnit: LotUnit
  units: NumRange
  /** Feet. */
  ceilingHeight: NumRange
  yearBuilt: NumRange
  /** SF of an Available or Vacant space. */
  availableSf: NumRange
  apn: string
  // ── Availability ──
  statuses: StageFacetValue[]
  spaceStatuses: SpaceStatus[]
  // ── Location ──
  market: string
  submarket: string
  city: string
  state: string
  zip: string
  county: string
  // ── View ──
  activeDeals: boolean
  activeListings: boolean
  // ── Sale/Lease ──
  dealTypes: DealType[]
  salePrice: NumRange
  saleYear: NumRange
  pricePerSf: NumRange
  pricePerUnit: NumRange
  /** Percent, e.g. 5.5. */
  capRate: NumRange
}

/** Everything unset — what "Clear all" restores and what the pills count against. */
export const EMPTY_FACETS: PropertyFacetState = {
  types: [],
  classes: [],
  buildingSize: EMPTY_RANGE,
  lotSize: EMPTY_RANGE,
  lotUnit: 'sf',
  units: EMPTY_RANGE,
  ceilingHeight: EMPTY_RANGE,
  yearBuilt: EMPTY_RANGE,
  availableSf: EMPTY_RANGE,
  apn: '',
  statuses: [],
  spaceStatuses: [],
  market: '',
  submarket: '',
  city: '',
  state: '',
  zip: '',
  county: '',
  activeDeals: false,
  activeListings: false,
  dealTypes: [],
  salePrice: EMPTY_RANGE,
  saleYear: EMPTY_RANGE,
  pricePerSf: EMPTY_RANGE,
  pricePerUnit: EMPTY_RANGE,
  capRate: EMPTY_RANGE,
}

/** The facets that describe deals or spaces — meaningless on a prospect record, which has neither. */
export const DEAL_SIDE_FACETS = [
  'statuses',
  'spaceStatuses',
  'availableSf',
  'activeDeals',
  'activeListings',
  'dealTypes',
  'salePrice',
  'saleYear',
  'pricePerSf',
  'pricePerUnit',
  'capRate',
] as const satisfies readonly (keyof PropertyFacetState)[]

/** The state with every deal-side facet cleared — what applies in Prospecting mode. */
export function withoutDealSideFacets(f: PropertyFacetState): PropertyFacetState {
  const next = { ...f }
  for (const k of DEAL_SIDE_FACETS) (next as Record<string, unknown>)[k] = EMPTY_FACETS[k]
  return next
}

export type FacetGroup = 'property' | 'availability' | 'location' | 'view' | 'saleLease'

/** Which group each facet sits in — drives the count badge on each dropdown. */
export const FACET_GROUP: Record<keyof PropertyFacetState, FacetGroup | null> = {
  types: 'property',
  classes: 'property',
  buildingSize: 'property',
  lotSize: 'property',
  lotUnit: null, // a unit for lotSize, not a facet of its own
  units: 'property',
  ceilingHeight: 'property',
  yearBuilt: 'property',
  availableSf: 'property',
  apn: 'property',
  statuses: 'availability',
  spaceStatuses: 'availability',
  market: 'location',
  submarket: 'location',
  city: 'location',
  state: 'location',
  zip: 'location',
  county: 'location',
  activeDeals: 'view',
  activeListings: 'view',
  dealTypes: 'saleLease',
  salePrice: 'saleLease',
  saleYear: 'saleLease',
  pricePerSf: 'saleLease',
  pricePerUnit: 'saleLease',
  capRate: 'saleLease',
}

/** Whether one facet is set. */
export function facetActive(f: PropertyFacetState, key: keyof PropertyFacetState): boolean {
  const v = f[key]
  if (key === 'lotUnit') return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return v.trim().length > 0
  return rangeSet(v as NumRange)
}

export function activeFacetKeys(f: PropertyFacetState): (keyof PropertyFacetState)[] {
  return (Object.keys(f) as (keyof PropertyFacetState)[]).filter((k) => facetActive(f, k))
}

export function countActiveFacets(f: PropertyFacetState, group?: FacetGroup): number {
  return activeFacetKeys(f).filter((k) => !group || FACET_GROUP[k] === group).length
}

/** What the filter needs beyond the property itself, injected so it stays pure. */
export interface PropertyFilterContext {
  query: string
  /** A property's spaces; `[]` when there are none. */
  spacesOf?: (p: Property) => SpaceRow[]
  /** The deals on a property, top-level and children alike. */
  dealsOf?: (p: Property) => Listing[]
}

const AVAILABLE_STATUSES: ReadonlySet<SpaceStatus> = new Set(['Available', 'Vacant'])

/** Whether any facet describes spaces rather than the building — what makes a row unfold its matches. */
export function spaceFacetsActive(f: PropertyFacetState): boolean {
  return f.spaceStatuses.length > 0 || rangeSet(f.buildingSize) || rangeSet(f.availableSf)
}

/**
 * The spaces of one property that satisfy every active space-level facet —
 * the ones the row unfolds under "2 of 6 spaces match". Empty when no space
 * facet is set, so a plain list stays a plain list.
 */
export function matchingSpaces(rows: SpaceRow[], f: PropertyFacetState): SpaceRow[] {
  if (!spaceFacetsActive(f)) return []
  return rows.filter(
    (r) =>
      (f.spaceStatuses.length === 0 || f.spaceStatuses.includes(r.status)) &&
      inRange(r.sqft, f.buildingSize) &&
      (!rangeSet(f.availableSf) || (AVAILABLE_STATUSES.has(r.status) && inRange(r.sqft, f.availableSf))),
  )
}

const text = (s: string) => s.trim().toLowerCase()
const has = (hay: string | undefined | null, needle: string) =>
  !text(needle) || (hay ?? '').toLowerCase().includes(text(needle))

function saleYear(p: Property): number | null {
  const y = Number(p.lastPurchaseDate?.slice(0, 4))
  return Number.isFinite(y) && y > 0 ? y : null
}

function unitCount(p: Property): number {
  return p.residentialUnits ?? p.units.length
}

/** The building's ceiling height, or the tallest of its units' when the building has none. */
function ceiling(p: Property): number | null {
  if (p.ceilingHeight != null) return p.ceilingHeight
  const heights = p.units.map((u) => u.ceilingHeight).filter((h): h is number => h != null)
  return heights.length ? Math.max(...heights) : null
}

/** Pure filter for the Properties index: substring query plus every facet above. */
export function filterProperties(
  properties: Property[],
  f: PropertyFacetState,
  ctx: PropertyFilterContext,
): Property[] {
  const q = text(ctx.query)
  return properties.filter((p) => {
    const spaces = ctx.spacesOf?.(p) ?? []
    const deals = ctx.dealsOf?.(p) ?? []
    const topLevel = deals.filter((d) => d.parentDealId == null)

    // ── Property & Building ──
    if (f.types.length > 0 && !f.types.includes(p.propertyType)) return false
    if (f.classes.length > 0 && !f.classes.includes(p.buildingClass)) return false
    // Size: the building, or any space in it (LoopNet's rule for lease inventory).
    if (!inRange(p.buildingSqFt, f.buildingSize) && !spaces.some((s) => inRange(s.sqft, f.buildingSize))) return false
    if (!inRange(f.lotUnit === 'acres' ? p.lotSqFt / 43_560 : p.lotSqFt, f.lotSize)) return false
    if (!inRange(unitCount(p), f.units)) return false
    if (rangeSet(f.ceilingHeight) && !inRange(ceiling(p), f.ceilingHeight)) return false
    if (rangeSet(f.yearBuilt) && !inRange(p.yearBuilt > 0 ? p.yearBuilt : null, f.yearBuilt)) return false
    if (
      rangeSet(f.availableSf) &&
      !spaces.some((s) => AVAILABLE_STATUSES.has(s.status) && inRange(s.sqft, f.availableSf))
    )
      return false
    if (!has(p.apn, f.apn)) return false

    // ── Availability ──
    if (f.statuses.length > 0 && !f.statuses.includes(p.status ?? 'none')) return false
    if (f.spaceStatuses.length > 0 && !spaces.some((s) => f.spaceStatuses.includes(s.status))) return false

    // ── Location ──
    if (f.market && text(p.market ?? '') !== text(f.market)) return false
    if (f.submarket && text(p.submarket) !== text(f.submarket)) return false
    if (!has(p.city, f.city) || !has(p.state, f.state) || !has(p.zip, f.zip) || !has(p.county, f.county))
      return false

    // ── View ──
    if (f.activeDeals && !topLevel.some((d) => d.status !== 'closed' && d.status !== 'inactive')) return false
    if (
      f.activeListings &&
      !topLevel.some((d) => d.publishedAt != null && d.status !== 'closed' && d.status !== 'inactive')
    )
      return false

    // ── Sale/Lease ──
    if (f.dealTypes.length > 0 && !topLevel.some((d) => f.dealTypes.includes(d.dealType))) return false
    if (rangeSet(f.salePrice) && !inRange(p.lastPurchasePrice > 0 ? p.lastPurchasePrice : null, f.salePrice))
      return false
    if (rangeSet(f.saleYear) && !inRange(saleYear(p), f.saleYear)) return false
    if (
      rangeSet(f.pricePerSf) &&
      !inRange(p.lastPurchasePrice > 0 && p.buildingSqFt > 0 ? p.lastPurchasePrice / p.buildingSqFt : null, f.pricePerSf)
    )
      return false
    if (
      rangeSet(f.pricePerUnit) &&
      !inRange(
        p.lastPurchasePrice > 0 && unitCount(p) > 0 ? p.lastPurchasePrice / unitCount(p) : null,
        f.pricePerUnit,
      )
    )
      return false
    if (rangeSet(f.capRate) && !inRange(p.capRate > 0 ? p.capRate * 100 : null, f.capRate)) return false

    if (!q) return true
    const haystack = [p.name, p.street, p.city, p.state, p.zip, p.submarket]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
