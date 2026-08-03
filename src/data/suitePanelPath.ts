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

/**
 * The part of a legacy listing URL after `/listings/{id}/`, or null when there is none.
 *
 * Split on the FIRST occurrence only: a panel URL contains the shell's id followed by
 * `/spaces/{suiteId}/{leaf}`, and truncating at a later occurrence would mangle it.
 */
export function legacySubPath(pathname: string, listingId: string): string | null {
  const marker = `/listings/${listingId}/`
  const at = pathname.indexOf(marker)
  if (at === -1) return null
  const rest = pathname.slice(at + marker.length).replace(/\/$/, '')
  return rest === '' ? null : rest
}

/**
 * Which of the building's own sections a path belongs to — the FIRST segment after
 * the listing id, not the last.
 *
 * The distinction matters because a suite panel's leaf slugs deliberately mirror the
 * building's section slugs (that mirroring is what makes the legacy rewrite one rule
 * instead of a table). So `/listings/L1/spaces/S1/overview` must resolve to `spaces`,
 * not `overview`: the broker is on the building's Spaces section with a panel over
 * it. Matching the last segment instead lights up the wrong sidebar item the moment
 * a panel opens, and switches it back when the panel closes.
 */
export function buildingSectionHref(
  pathname: string,
  listingId: string,
): string | null {
  return legacySubPath(pathname, listingId)?.split('/')[0] ?? null
}
