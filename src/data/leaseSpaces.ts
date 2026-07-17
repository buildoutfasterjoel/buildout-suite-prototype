import type { Listing, PropertyStatus } from './types'
import { getListing, getProperty, addListing, getStore, addPropertyUnit } from './store'
import { emptySpaceLeaseTerms } from './createListing'
import { updateDealMarketing } from './actions'

/** Re-exported so callers can spawn a unit + a bound space deal from one module. */
export { addPropertyUnit }

/** Marketing fields a child inherits (snapshot) from its umbrella parent. */
const TEMPLATE_KEYS = [
  'leaseTitle', 'leaseDescription', 'leaseBullets', 'leaseCommissionSplitPct',
  'propertyUse', 'investmentType', 'marketingChannel', 'visibilityTier',
] as const

/** Copy the parent's template fields into a marketing object. */
function applyTemplate(target: Listing['marketing'], parent: Listing['marketing']): Listing['marketing'] {
  const patch: Partial<Listing['marketing']> = {}
  for (const k of TEMPLATE_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(patch as any)[k] = parent[k]
  }
  return { ...target, ...patch }
}

/** Children of an umbrella deal (excludes the parent itself). */
export function getChildDeals(parentDealId: string): Listing[] {
  return [...getStore().listings.values()].filter((l) => l.parentDealId === parentDealId)
}

export function isUmbrella(dealId: string): boolean {
  return getChildDeals(dealId).length > 0
}

export function spacesStageBreakdown(parentDealId: string): {
  total: number
  byStage: Record<PropertyStatus, number>
} {
  const byStage: Record<PropertyStatus, number> = {
    proposal: 0, active: 0, 'under-contract': 0, closed: 0, inactive: 0,
  }
  const children = getChildDeals(parentDealId)
  for (const c of children) byStage[c.status] += 1
  return { total: children.length, byStage }
}

export function addSpaceToDeal(
  parentDealId: string,
  unitId: string,
): { deal: Listing } | null {
  const parent = getListing(parentDealId)
  if (!parent) return null
  const property = getProperty(parent.propertyId)
  const unit = property?.units.find((u) => u.id === unitId)
  if (!property || !unit) return null

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const dealId = `D-${String(Math.floor(Date.now() % 100000)).padStart(5, '0')}`
  const childrenCount = getChildDeals(parentDealId).length

  const child: Listing = {
    ...parent,
    id,
    dealId,
    parentDealId,
    unitId,
    name: `${parent.name} — ${unit.label}`,
    slug: `${parent.slug}-space-${childrenCount + 1}`,
    status: 'proposal',
    publishedAt: null,
    // Own pipeline state — start clean, do not inherit the parent's parties/history.
    sellerContactIds: [...parent.sellerContactIds],
    buyerContactIds: [],
    tenantContactIds: [],
    otherContactIds: [],
    tasks: [],
    messages: [],
    activities: [],
    history: [
      { id: crypto.randomUUID(), label: 'Created under', fromStage: null, toStage: 'proposal', actor: 'You (Listing Broker)', timestamp: now },
    ],
    documents: [],
    marketing: applyTemplate(
      {
        ...parent.marketing,
        availableSqFt: unit.sqft,
        spaceLeaseTerms: [{ ...emptySpaceLeaseTerms(unitId) }],
      },
      parent.marketing,
    ),
    createdAt: now,
    updatedAt: now,
  }

  addListing(child)
  return { deal: child }
}

export function resyncChildFromParent(childId: string): { deal: Listing } | null {
  const child = getListing(childId)
  if (!child || !child.parentDealId) return null
  const parent = getListing(child.parentDealId)
  if (!parent) return null
  const merged = applyTemplate(child.marketing, parent.marketing)
  const patch: Partial<Listing['marketing']> = {}
  for (const k of TEMPLATE_KEYS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(patch as any)[k] = (merged as any)[k]
  }
  const res = updateDealMarketing(childId, patch)
  return res.deal ? { deal: res.deal } : null
}
