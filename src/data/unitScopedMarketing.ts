import type { VisualMediaLink } from './types'

/**
 * A space shows its own assets plus the building-wide ones — a suite with no
 * photos of its own should still show the building's.
 */
export function mediaForUnit(
  links: VisualMediaLink[],
  unitId: string | null,
): VisualMediaLink[] {
  if (!unitId) return links
  return links.filter((l) => l.unitId === unitId || l.unitId == null)
}

/**
 * Leads do NOT fall back: an inquiry about the building is not an inquiry about
 * Suite 200, and showing it as one would misattribute the broker's pipeline.
 */
export function leadsForUnit<T extends { unitId: string | null }>(
  leads: T[],
  unitId: string | null,
): T[] {
  if (!unitId) return leads
  return leads.filter((l) => l.unitId === unitId)
}
