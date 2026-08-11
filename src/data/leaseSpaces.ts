import type { Listing, PropertyStatus } from './types'
import { getListing, getProperty, addListing, getStore, addPropertyUnit } from './store'
import { spaceTermsFromUnit } from './createListing'
import { updateDealMarketing } from './actions'

/** Re-exported so callers can spawn a unit + a bound space deal from one module. */
export { addPropertyUnit }

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

  // The parent's row for this unit — if the broker already priced it, that row
  // moves to the child rather than forking a blank copy. One editable home per unit.
  const existingRow = parent.marketing.spaceLeaseTerms?.find((t) => t.unitId === unitId)

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
    marketing: {
      ...parent.marketing,
      availableSqFt: unit.sqft,
      spaceLeaseTerms: [existingRow ? { ...existingRow } : spaceTermsFromUnit(unit)],
      // A unit's media has exactly ONE home: the building's marketing. A space's
      // Media tab is a filtered editor onto its parent, not an owner of its own
      // copy — so the child starts with all three lists empty and nothing ever
      // writes to them. Left populated, an edit made on the suite would diverge
      // from the building, and the building's Media -> Spaces section (which reads
      // the building's lists) would never see it.
      photos: [],
      links: [],
      visualMedia: [],
    },
    createdAt: now,
    updatedAt: now,
  }

  addListing(child)

  // Drop the moved row from the parent so the shell holds no space terms of its own.
  if (existingRow) {
    updateDealMarketing(parentDealId, {
      spaceLeaseTerms: (parent.marketing.spaceLeaseTerms ?? []).filter((t) => t.unitId !== unitId),
    })
  }

  return { deal: child }
}
