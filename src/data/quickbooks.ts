/**
 * QuickBooks sync status — the badge that says a record has a counterpart in
 * QuickBooks.
 *
 * Display only at this stage. Nothing here talks to QuickBooks, and nothing
 * writes the flag after seeding: the badge exists so the voucher can show what
 * the integration WILL report, not to report it.
 *
 * Pure and faker-free, for two reasons that both matter:
 *
 * 1. `generateDataset` calls in while it is still building the store, so
 *    anything that read `useDataStore` would throw at seed time — the same trap
 *    the invoice helpers fell into.
 * 2. Drawing the flag from faker would advance the seed's random stream, which
 *    shifts every value generated after it. The demo's tracked contacts and
 *    properties are pinned to positions in that stream, so a new `faker` call
 *    inside the contact loop would quietly re-address the flagship story.
 *    Hashing an id the seed has already drawn costs the stream nothing.
 */

/**
 * Whether a record is synced, derived from its id.
 *
 * Roughly three in four are — enough that a synced badge reads as the normal
 * state, while the gaps are common enough to be visible on any one voucher.
 * Same id always gives the same answer, so a reseed does not reshuffle which
 * contacts are connected.
 */
export function isQuickbooksSynced(id: string): boolean {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1_000_003
  }
  return hash % 4 !== 0
}

/** What the badge's tooltip says. One string, so three surfaces cannot word it three ways. */
export const QUICKBOOKS_SYNCED_LABEL = 'Connected to QuickBooks'
