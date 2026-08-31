/**
 * The vouchers a Back Office deposit can be filed against.
 *
 * The deal page never needs this — Apply Deposit opens on a voucher that has
 * already been chosen for it. The New Deposit modal opens on nothing, so the
 * first thing it has to answer is which vouchers are even candidates.
 */
import type { FinancialDeduction, FinancialReceivable } from './types'
import { getStore, getProperty } from './store'
import { receivableBalance } from './deposits'
import { voucherHref, type VoucherStatus } from './vouchers'

export interface DepositVoucherOption {
  /** What `applyDeposit` is called with. Also the option's identity. */
  dealId: string
  /** The voucher's own name — what the combobox shows and matches on. */
  label: string
  /** The deal's address and lead broker, under the name, to tell two apart. */
  sublabel: string
  /** What its receivables still owe, summed. Always greater than zero. */
  outstanding: number
  /** Every receivable on the voucher — the modal filters to the open ones. */
  receivables: FinancialReceivable[]
  /** The deduction denominator is the whole voucher, so these come whole too. */
  deductions: FinancialDeduction[]
  /**
   * Where the voucher stands. Shown as a badge in the picker, and read for
   * whether the modal's alert promises payables now or at approval.
   *
   * The status itself rather than an `approved` boolean: the picker has to name
   * it, and a boolean would have the same fact spelled two ways in one option.
   */
  status: VoucherStatus
}

/** Money is counted in cents, so no float tail leaks into a total. */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Every voucher waiting on money, sorted by name.
 *
 * Three things are excluded, each for its own reason:
 *
 * - **Lease shells.** `voucherHref` owns the "does this deal have a voucher"
 *   question. A shell keeps the `backOffice` record it had before it was split,
 *   and depositing against it would credit lines its own suites are billing.
 * - **Pending vouchers.** `applyDeposit` refuses one outright — it is sitting
 *   with an approver — so offering it would be a pick whose Save does nothing.
 * - **Vouchers with nothing outstanding.** There is no line for the money to
 *   land on, so the pick is a dead end. The same rule the filter facets follow:
 *   an option nothing matches is worse than a shorter list.
 *
 * Sorted by voucher name rather than by what is owed. The broker filing a
 * deposit already knows which voucher they want and is typing to find it; a
 * list ordered by size would only make the same name move about as balances
 * change.
 */
export function depositVouchers(): DepositVoucherOption[] {
  return [...getStore().listings.values()]
    .flatMap((deal): DepositVoucherOption[] => {
      if (!voucherHref(deal)) return []
      const voucher = deal.transaction.backOffice
      if (voucher.status === 'Pending') return []

      const outstanding = toCents(
        voucher.receivables.reduce((total, r) => total + receivableBalance(r), 0),
      )
      if (outstanding <= 0) return []

      const property = getProperty(deal.propertyId)
      const broker = deal.internalBrokers[0]?.name
      return [
        {
          dealId: deal.id,
          label: voucher.name,
          // Address first, because two vouchers sharing a name are almost
          // always two suites in one building, and the broker is the same
          // person on both. Street and city only, not the full postal address
          // the Vouchers index shows: this sits under the name in a dropdown
          // row, where a state and a zip push the outstanding figure off the
          // end.
          sublabel: [property?.street, property?.city, broker]
            .filter(Boolean)
            .join(' · '),
          outstanding,
          receivables: voucher.receivables,
          deductions: voucher.preSplitDeductions,
          status: voucher.status,
        },
      ]
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
}
