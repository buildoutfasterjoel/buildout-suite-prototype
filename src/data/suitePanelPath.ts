import type { Listing } from './types'
import {
  SPACE_PANEL_LEAVES,
  DEFAULT_SPACE_PANEL_LEAF,
} from '#/components/deals/spacePanelTabs'

/**
 * Where a legacy suite URL should land now that a suite is a panel over its building.
 *
 * Every panel leaf kept the slug its section already had, so this is one rewrite
 * rather than a mapping table. Two exceptions: a bare suite URL opens the default
 * leaf, and the edit form maps to Terms — the only genuinely new slug.
 *
 * Returns null when the listing is not a space deal, meaning there is nothing to
 * rewrite and the caller should let the route render normally.
 */
export function suitePanelPath(
  listing: Listing,
  subPath: string | null,
): string | null {
  const shellId = listing.parentDealId
  if (!shellId) return null

  const base = `/listings/${shellId}/spaces/${listing.id}`
  if (!subPath) return `${base}/${DEFAULT_SPACE_PANEL_LEAF}`
  if (subPath === 'edit') return `${base}/terms`
  if ((SPACE_PANEL_LEAVES as string[]).includes(subPath)) return `${base}/${subPath}`
  // A building-only surface (website, documents, the deleted hub). The suite has no
  // such section, so land on Details rather than 404.
  return `${base}/${DEFAULT_SPACE_PANEL_LEAF}`
}
