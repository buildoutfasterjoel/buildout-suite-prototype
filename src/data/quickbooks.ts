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
 * record against a customer QuickBooks has never heard of. The chain is what
 * stops the seed from showing an impossible pair: an A/R row filed against a
 * party that is missing.
 *
 * It used to run one link further, to the invoice: a bill was in QuickBooks
 * when every receivable it billed was. The Invoices table no longer shows a
 * sync badge — an invoice's own row says what has happened to it instead — so
 * that derivation went with the column.
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
 * surfaces that show the badge cannot word it two ways.
 *
 * The unsynced wording names the consequence rather than the mechanism. "Not
 * synced" describes a job that has not run; a broker reading a voucher needs to
 * know the record is not THERE, because that is what will stop the bill.
 */
export const QUICKBOOKS_SYNCED_LABEL = 'Connected to QuickBooks'
export const QUICKBOOKS_UNSYNCED_LABEL = 'Not in QuickBooks'
