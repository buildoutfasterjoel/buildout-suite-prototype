/**
 * The Back Office money palette.
 *
 * Every index in Back Office splits an amount the same way — some of it has
 * settled, some of it is still out, some of it is late, some of it was held
 * back before anyone was paid. Receivables and Deposits answer different
 * questions but draw the same four bands, and a green bar on one page next to a
 * different green on the other would read as two unrelated facts.
 *
 * So the colours are named for what the band MEANS, not for the status or
 * series that happens to use it. `Fully Paid` on Receivables and `Collected
 * House Split` on Deposits are both `settled`: money that has arrived and
 * stopped moving.
 */
export const MONEY_COLORS = {
  /** Arrived and finished moving. */
  settled: '#3fa76a',
  /** Still out, but nobody is late. */
  outstanding: '#2431a8',
  /** Still out, past the date it was owed. */
  late: '#d92d20',
  /** Taken off the top before the split — never a debt, never a collection. */
  withheld: '#e27400',
} as const
