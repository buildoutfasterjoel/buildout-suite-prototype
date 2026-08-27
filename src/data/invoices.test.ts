import { describe, expect, it } from 'vitest'
import {
  invoiceDueDate,
  invoiceFileName,
  invoiceLineItems,
  invoicePayerFileLabel,
} from './invoices'
import type { FinancialReceivable } from './types'

function receivable(over: Partial<FinancialReceivable> = {}): FinancialReceivable {
  return {
    id: 'r1',
    payerContactId: 'c1',
    billToCompany: false,
    dueDate: '2026-01-31',
    billingDescription: 'Full Payment',
    amount: 3600,
    credited: 0,
    ...over,
  }
}

describe('invoiceFileName', () => {
  it('turns a payer label into a filename with the invoice ordinal', () => {
    expect(invoiceFileName('ABC, Corp.', 1)).toBe('ABC_Corp_Invoice_1.pdf')
  })

  it('leaves no trailing separator when the label ends in punctuation', () => {
    // "ABC, Corp." ends in a period, so a naive replace leaves "ABC_Corp__Invoice".
    expect(invoiceFileName('Corp.', 2)).toBe('Corp_Invoice_2.pdf')
  })

  it('collapses runs of punctuation and spaces into one separator', () => {
    expect(invoiceFileName('Frederick   Burke — Jr.', 3)).toBe('Frederick_Burke_Jr_Invoice_3.pdf')
  })

  it('falls back to Invoice when the label has nothing usable in it', () => {
    // A contact removed from the store resolves to a label we cannot spell a
    // filename from; the ordinal still makes the row identifiable.
    expect(invoiceFileName('—', 4)).toBe('Invoice_4.pdf')
  })
})

describe('invoiceLineItems', () => {
  it('freezes each receivable amount and credit as a line', () => {
    const lines = invoiceLineItems([
      receivable({ id: 'r1', amount: 3600, credited: 0 }),
      receivable({ id: 'r2', amount: 1000, credited: 250, dueDate: '2026-02-15' }),
    ])
    expect(lines).toEqual([
      { receivableId: 'r1', dueDate: '2026-01-31', amount: 3600, amountPaid: 0 },
      { receivableId: 'r2', dueDate: '2026-02-15', amount: 1000, amountPaid: 250 },
    ])
  })

  it('keeps the receivables in the order given', () => {
    const lines = invoiceLineItems([
      receivable({ id: 'later', dueDate: '2026-03-01' }),
      receivable({ id: 'earlier', dueDate: '2026-01-01' }),
    ])
    expect(lines.map((l) => l.receivableId)).toEqual(['later', 'earlier'])
  })
})

describe('invoiceDueDate', () => {
  it('is the earliest line due date, whatever order the lines are in', () => {
    // The invoice states one DUE DATE beside its total. The earliest is the one
    // that binds: money is late once the first line is.
    const lines = invoiceLineItems([
      receivable({ id: 'r1', dueDate: '2026-03-01' }),
      receivable({ id: 'r2', dueDate: '2026-01-31' }),
    ])
    expect(invoiceDueDate(lines)).toBe('2026-01-31')
  })

  it('returns the only date on a single-line invoice', () => {
    expect(invoiceDueDate(invoiceLineItems([receivable()]))).toBe('2026-01-31')
  })
})

describe('invoicePayerFileLabel', () => {
  const payer = { name: 'Frederick Burke', company: 'ABC, Corp.' }

  it('takes the company when the receivable bills the company', () => {
    expect(invoicePayerFileLabel(payer, true)).toBe('ABC, Corp.')
  })

  it('takes the person otherwise', () => {
    expect(invoicePayerFileLabel(payer, false)).toBe('Frederick Burke')
  })

  it('falls back to the person when billToCompany is set but there is no company', () => {
    // `billToCompany` is only offered for a contact that has one, but the flag
    // outlives the company field — a contact can be edited afterwards.
    expect(invoicePayerFileLabel({ name: 'Rosa Delgado', company: '' }, true)).toBe('Rosa Delgado')
  })

  it('never carries an email, unlike the receivables table label', () => {
    // `receivablePayerLabel` appends "(email)" to tell two same-named contacts
    // apart in a table cell. Spelled into a filename that reads as noise, which
    // is why this is a separate helper rather than a reuse of that one.
    expect(invoicePayerFileLabel(payer, false)).not.toContain('(')
  })
})
