import type { DealInvoiceLineItem, FinancialReceivable, Listing } from './types'

/**
 * Invoices: turning receivables the voucher says are owed into the record of a
 * bill that was sent.
 *
 * Pure on purpose — no store reads at all. `generateDataset` calls into here
 * while it is still BUILDING the store, so anything that reached for
 * `useDataStore` would throw at seed time; that is why the payer arrives as a
 * name rather than as a contact id. Everything that writes lives in
 * `actions.ts`, beside `createGeneratedDocument`.
 *
 * There is deliberately no `invoiceView` here. The invoice document itself is
 * not rendered yet, and the fields it will need — the property address, the
 * agent, the acquiring party — are all already on the deal. Deriving them ahead
 * of a screen that reads them would be guessing at that screen's shape.
 */

/**
 * The parts of a payer a filename needs. Structural rather than a contact id, so
 * both callers can satisfy it: the create action passes a `VoucherParty` resolved
 * from the store, and the seed passes a contact it already holds in hand — which
 * it must, since it runs before the store exists.
 */
export interface InvoicePayerName {
  name: string
  company: string
}

/**
 * How a payer is named in a filename.
 *
 * Not `receivablePayerLabel`, which appends "(email)" so a table cell can tell
 * two same-named contacts apart. Spelled into a filename that reads as noise,
 * so this asks the narrower question and takes the company or the bare name.
 */
export function invoicePayerFileLabel(
  payer: InvoicePayerName,
  billToCompany: boolean,
): string {
  if (billToCompany && payer.company) return payer.company
  return payer.name
}

/**
 * `ABC_Corp_Invoice_1.pdf` — what the Invoices table shows.
 *
 * The ordinal is the invoice's position on the deal, not per payer, so two
 * invoices to the same party cannot collide. Punctuation collapses to a single
 * underscore and trailing separators are trimmed, or "ABC, Corp." would spell
 * `ABC_Corp__Invoice_1.pdf`.
 */
export function invoiceFileName(payerLabel: string, ordinal: number): string {
  const slug = payerLabel.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  // A contact that has left the store can resolve to a label with no letters in
  // it at all. The ordinal alone still names the row.
  return slug ? `${slug}_Invoice_${ordinal}.pdf` : `Invoice_${ordinal}.pdf`
}

/** The ordinal the deal's next invoice takes. */
export function nextInvoiceOrdinal(deal: Listing): number {
  return (deal.invoices?.length ?? 0) + 1
}

/**
 * Freeze the selected receivables as billed lines.
 *
 * `amount` and `amountPaid` are copied rather than referenced: an invoice states
 * what was owed the day it was sent, and a payment landing later must move the
 * receivable without rewriting the bill. See {@link DealInvoiceLineItem}.
 *
 * Order is the caller's, which is the order the receivables sit in on the
 * voucher — the same order the broker just selected them in.
 */
export function invoiceLineItems(
  receivables: FinancialReceivable[],
): DealInvoiceLineItem[] {
  return receivables.map((r) => ({
    receivableId: r.id,
    dueDate: r.dueDate,
    amount: r.amount,
    amountPaid: r.credited,
  }))
}

/**
 * The one due date the invoice states beside its total: the earliest of its
 * lines. Money is late once the first line is, so the earliest is what binds.
 */
export function invoiceDueDate(lineItems: DealInvoiceLineItem[]): string {
  // `yyyy-mm-dd` sorts chronologically as a plain string, which is why these are
  // compared directly rather than parsed.
  return lineItems.reduce(
    (earliest, l) => (l.dueDate < earliest ? l.dueDate : earliest),
    lineItems[0].dueDate,
  )
}
