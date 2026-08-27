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
 *
 * This is the root of the chain, not the whole rule. A contact's flag is this
 * and nothing else, because a customer either exists in QuickBooks or does not.
 * A receivable additionally requires its payer to be there — there is no A/R
 * record against a customer QuickBooks has never heard of — and an invoice
 * requires all of its receivables (see {@link invoiceQuickbooksSynced}). The
 * chain is what stops the seed from showing an impossible pair: a bill filed
 * against a party that is missing.
 */
export function isQuickbooksSynced(id: string): boolean {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1_000_003
  }
  return hash % 4 !== 0
}

/**
 * What the badge's tooltip says, in each state. One pair of strings, so the
 * three surfaces that show the badge cannot word it three ways.
 *
 * The unsynced wording names the consequence rather than the mechanism. "Not
 * synced" describes a job that has not run; a broker reading a voucher needs to
 * know the record is not THERE, because that is what will stop the bill.
 */
export const QUICKBOOKS_SYNCED_LABEL = 'Connected to QuickBooks'
export const QUICKBOOKS_UNSYNCED_LABEL = 'Not in QuickBooks'

/**
 * Whether an invoice is in QuickBooks: derived from the receivables it bills,
 * never stored.
 *
 * An invoice is the document a set of receivables went out on, so it cannot be
 * in QuickBooks unless its lines are. Deriving is what makes that impossible to
 * violate — a stored flag could drift and show an invoice as connected above a
 * receivable that is not, which is the exact contradiction the badge exists to
 * rule out.
 *
 * An invoice whose receivables have been deleted resolves to unsynced. That is
 * the honest answer: we can no longer show it is there.
 */
export function invoiceQuickbooksSynced(
  lineItems: readonly { receivableId: string }[],
  receivables: readonly { id: string; quickbooksSynced?: boolean }[],
): boolean {
  if (lineItems.length === 0) return false
  const syncedIds = new Set(
    receivables.filter((r) => r.quickbooksSynced).map((r) => r.id),
  )
  return lineItems.every((line) => syncedIds.has(line.receivableId))
}
