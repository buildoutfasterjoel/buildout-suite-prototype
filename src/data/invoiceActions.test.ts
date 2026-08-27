import { describe, expect, it } from 'vitest'
import { createInvoiceFromReceivables, updateReceivable } from './actions'
import { useDataStore } from './dataStore'
import type { Listing } from './types'

/** A seeded deal whose voucher bills two lines to two different payers. */
function dealWithTwoPayers(): Listing {
  const deals = [...useDataStore.getState().listings.values()]
  const found = deals.find((d) => {
    const r = d.transaction.backOffice.receivables
    return r.length > 1 && new Set(r.map((x) => x.payerContactId)).size > 1
  })
  if (!found) throw new Error('seed has no voucher billing two payers')
  return found
}

/** A seeded deal whose voucher has exactly one receivable. */
function dealWithOneReceivable(): Listing {
  const deals = [...useDataStore.getState().listings.values()]
  const found = deals.find((d) => d.transaction.backOffice.receivables.length === 1)
  if (!found) throw new Error('seed has no voucher with a single receivable')
  return found
}

function reread(dealId: string): Listing {
  return useDataStore.getState().listings.get(dealId)!
}

describe('createInvoiceFromReceivables', () => {
  it('files an invoice that freezes the receivable it billed', () => {
    const deal = dealWithOneReceivable()
    const receivable = deal.transaction.backOffice.receivables[0]
    const before = reread(deal.id).invoices?.length ?? 0

    const { invoiceId, name } = createInvoiceFromReceivables(deal.id, [receivable.id])
    expect(invoiceId).not.toBeNull()
    expect(name).toMatch(/_Invoice_\d+\.pdf$/)

    const invoice = reread(deal.id).invoices!.at(-1)!
    expect(reread(deal.id).invoices).toHaveLength(before + 1)
    expect(invoice.payerContactId).toBe(receivable.payerContactId)
    expect(invoice.billToCompany).toBe(receivable.billToCompany)
    expect(invoice.dueDate).toBe(receivable.dueDate)
    expect(invoice.lineItems).toEqual([
      {
        receivableId: receivable.id,
        dueDate: receivable.dueDate,
        amount: receivable.amount,
        amountPaid: receivable.credited,
      },
    ])
  })

  it('does not follow the receivable once the invoice is out the door', () => {
    // The point of copying the amounts. A payment landing later moves the
    // receivable's `credited`; the bill that was already sent must not change.
    const deal = dealWithOneReceivable()
    const receivable = deal.transaction.backOffice.receivables[0]
    createInvoiceFromReceivables(deal.id, [receivable.id])
    const billedAmount = reread(deal.id).invoices!.at(-1)!.lineItems[0].amount

    updateReceivable(deal.id, receivable.id, {
      credited: receivable.amount,
      amount: receivable.amount + 500,
    })

    const line = reread(deal.id).invoices!.at(-1)!.lineItems[0]
    expect(line.amount).toBe(billedAmount)
    expect(line.amountPaid).toBe(receivable.credited)
  })

  it('refuses a selection that names two payers', () => {
    // One invoice bills one party. `canCreateInvoice` disables the button for
    // this, but a disabled button is a courtesy — the write path has to hold too.
    const deal = dealWithTwoPayers()
    const ids = deal.transaction.backOffice.receivables.map((r) => r.id)
    const before = reread(deal.id).invoices?.length ?? 0

    expect(createInvoiceFromReceivables(deal.id, ids)).toEqual({
      invoiceId: null,
      name: null,
    })
    expect(reread(deal.id).invoices?.length ?? 0).toBe(before)
  })

  it('refuses an empty selection, and an id that is not on the voucher', () => {
    const deal = dealWithOneReceivable()
    expect(createInvoiceFromReceivables(deal.id, [])).toEqual({ invoiceId: null, name: null })
    expect(createInvoiceFromReceivables(deal.id, ['not-a-receivable'])).toEqual({
      invoiceId: null,
      name: null,
    })
  })

  it('returns nulls for a deal that is not in the store', () => {
    expect(createInvoiceFromReceivables('no-such-deal', ['r1'])).toEqual({
      invoiceId: null,
      name: null,
    })
  })

  it('numbers a deal\'s invoices in sequence, so two to one payer do not collide', () => {
    const deal = dealWithOneReceivable()
    const id = deal.transaction.backOffice.receivables[0].id
    const first = createInvoiceFromReceivables(deal.id, [id]).name
    const second = createInvoiceFromReceivables(deal.id, [id]).name
    expect(first).not.toBe(second)
  })
})
