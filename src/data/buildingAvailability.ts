import type { LeaseRateUnits } from './types'
import { getListing, getProperty } from './store'
import { getChildDeals } from './leaseSpaces'
import { spaceAvailability, type SpaceAvailability } from './dealShape'

export interface AvailabilityRow {
  dealId: string
  unitId: string
  label: string
  sqft: number
  leaseRate: number | null
  leaseRateUnits: LeaseRateUnits
  leaseTermMonths: number | null
  availability: SpaceAvailability
  /** False for a space the building is not currently advertising (Inactive or Lost). */
  advertised: boolean
}

/**
 * The building's availability table. Sourced entirely from the shell's child
 * deals — each space owns its own terms, and its deal stage IS its advertised
 * status, so there is nothing to keep in sync.
 */
export function buildingAvailability(shellDealId: string): AvailabilityRow[] {
  const shell = getListing(shellDealId)
  if (!shell) return []
  const property = getProperty(shell.propertyId)

  return getChildDeals(shellDealId).flatMap((child) => {
    if (!child.unitId) return []
    const unit = property?.units.find((u) => u.id === child.unitId)
    const terms = child.marketing.spaceLeaseTerms?.[0]
    const availability = spaceAvailability(child.status)
    return [{
      dealId: child.id,
      unitId: child.unitId,
      label: unit?.label ?? child.name,
      sqft: unit?.sqft ?? 0,
      leaseRate: terms?.leaseRate ?? null,
      leaseRateUnits: terms?.leaseRateUnits ?? 'SF/Yr',
      leaseTermMonths: terms?.leaseTermMonths ?? null,
      availability,
      advertised: availability !== 'Not advertised',
    }]
  })
}

/** The rows the building actually advertises — what a public marketing surface renders. */
export function advertisedAvailability(shellDealId: string): AvailabilityRow[] {
  return buildingAvailability(shellDealId).filter((r) => r.advertised)
}
