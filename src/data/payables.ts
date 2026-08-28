import type {
  DealBroker,
  FinancialReceivable,
  Listing,
  VoucherDeposit,
  VoucherPayable,
  VoucherPayment,
} from './types'

/**
 * Payables: what the brokerage owes its brokers once money has actually come in,
 * and what is left after the cheques written against it.
 *
 * Pure on purpose, the same way `deposits.ts` and `invoices.ts` are — no store
 * reads, no clock, no ids generated here. Everything that writes lives in
 * `actions.ts`, and the seed calls into here while it is still BUILDING the
 * store (see `reference-seed-cannot-read-store`), so a single `useDataStore`
 * read would throw at seed time.
 *
 * The counterpart of `deposits.ts`: that module spreads money coming IN across
 * the receivables it pays, this one spreads the same money OUT across the
 * brokers who earned it.
 */

/**
 * Money is counted in cents, so every share lands on one.
 *
 * `Math.round` on the scaled value rather than `toFixed`, which returns a string
 * and would have every caller parse it back. Same helper `deposits.ts` keeps
 * privately, duplicated rather than shared because exporting it would make two
 * modules that are deliberately independent depend on each other for four lines.
 */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Every broker who can be paid off this deal, in the order the payables table
 * lists them: outside brokers first, then the house's own.
 *
 * That order is not cosmetic. A co-broke comes off the top of the commission
 * before the brokerage splits what is left with its own people, so reading the
 * outside broker first is reading the money in the order it actually leaves.
 *
 * Takes the deal rather than two arrays because every caller has the deal and
 * none of them has a reason to know which list a broker came from.
 */
export function payableBrokers(deal: Listing): DealBroker[] {
  return [...deal.outsideBrokers, ...deal.internalBrokers]
}

/**
 * One broker by id, across both lists. Undefined once the id is unknown — a
 * state the data should not reach (see {@link VoucherPayable}), which is why
 * every caller renders a fallback rather than throwing.
 */
export function findPayableBroker(
  deal: Listing,
  brokerId: string,
): DealBroker | undefined {
  return payableBrokers(deal).find((b) => b.id === brokerId)
}

/**
 * What one broker is owed out of one deposit.
 *
 * **Proportional to the deposit, measured against the WHOLE voucher.**
 *
 *     share = broker.grossCommission x (deposit amount / total receivable amount)
 *
 * The denominator is every receivable on the voucher, not the ones this deposit
 * happened to land on. This is the same rule `previewDeposit` uses for deduction
 * coverage, and it is there for the same reason: a voucher paid in two parts —
 * two deposits, each against one of two receivables — would otherwise hand the
 * broker a full share twice, and pay out double what came in.
 *
 * A voucher with nothing billed has no denominator. Its payables read $0.00
 * rather than dividing by zero into Infinity.
 */
export function payableShare({
  broker,
  depositAmount,
  allReceivables,
}: {
  broker: DealBroker
  /** The cash that arrived, not the sum of its allocations. */
  depositAmount: number
  /** Every receivable on the voucher. The denominator, nothing else. */
  allReceivables: FinancialReceivable[]
}): number {
  const billed = allReceivables.reduce((total, r) => total + r.amount, 0)
  if (billed <= 0) return 0
  return Math.max(0, toCents((broker.grossCommission * depositAmount) / billed))
}

/**
 * The payables one deposit raises, ready for `actions.ts` or the seed to put an
 * id on.
 *
 * Returns them without ids because this module generates none — the write path
 * spells a uuid and the seed spells a stable string, and neither belongs in a
 * pure function.
 *
 * A broker whose share rounds to nothing gets no row. A payable reading $0.00
 * would sit in the table stating the brokerage owes them nothing, which is not
 * a debt anybody records.
 */
export function payablesForDeposit({
  deposit,
  brokers,
  allReceivables,
}: {
  deposit: VoucherDeposit
  /** In table order — see {@link payableBrokers}. */
  brokers: DealBroker[]
  allReceivables: FinancialReceivable[]
}): Omit<VoucherPayable, 'id'>[] {
  return brokers.flatMap((broker) => {
    const grossAmount = payableShare({
      broker,
      depositAmount: deposit.amount,
      allReceivables,
    })
    if (grossAmount <= 0) return []
    return [
      {
        brokerId: broker.id,
        depositId: deposit.id,
        // The deposit's date, not today's. A payable dates from the money that
        // funded it, which is what makes the Date column mean the same thing on
        // a back-filled row and on one raised live.
        date: deposit.date,
        grossAmount,
        payments: [],
      },
    ]
  })
}

/**
 * The broker's own cut, as a fraction.
 *
 * An outside broker carries no `personalSplitPct` — their `grossCommission` IS
 * their cheque, the co-broke having already been struck as a percentage of the
 * deal's commission. So a missing split means all of it, not none of it.
 */
function splitFraction(broker: DealBroker | undefined): number {
  return (broker?.personalSplitPct ?? 100) / 100
}

/** What a payment's deductions come to. */
export function paymentDeductionTotal(payment: {
  deductions: { amount: number }[]
}): number {
  return toCents(payment.deductions.reduce((total, d) => total + d.amount, 0))
}

/**
 * What the broker actually receives from one payment.
 *
 *     net = gross x the broker's own split - this payment's deductions
 *
 * The split comes first and the deductions second, which is the order the
 * Create Payment modal shows: the broker's share of the gross is what the
 * brokerage owes them, and a hold-back comes off the cheque, not off the
 * commission.
 *
 * Floored at zero. Deductions larger than the cheque are a data state the modal
 * warns about rather than prevents, and a negative net would read as the broker
 * paying the brokerage.
 */
export function paymentNet(
  payment: VoucherPayment,
  broker: DealBroker | undefined,
): number {
  const gross = toCents(payment.grossAmount * splitFraction(broker))
  return Math.max(0, toCents(gross - paymentDeductionTotal(payment)))
}

/** What has been paid against a payable, before the broker's split. */
export function payableGrossPaid(payable: VoucherPayable): number {
  return toCents(payable.payments.reduce((total, p) => total + p.grossAmount, 0))
}

/** What the broker has actually taken home from a payable. */
export function payableNetPaid(
  payable: VoucherPayable,
  broker: DealBroker | undefined,
): number {
  return toCents(
    payable.payments.reduce((total, p) => total + paymentNet(p, broker), 0),
  )
}

/**
 * What is still owed on a payable.
 *
 * Gross, not net: it is the figure the next payment is written against, and the
 * Create Payment modal seeds its Gross Amount from it. Never negative — a
 * payable that has somehow been over-paid owes nothing rather than owing back.
 */
export function payableBalance(payable: VoucherPayable): number {
  return Math.max(0, toCents(payable.grossAmount - payableGrossPaid(payable)))
}

/** True once nothing is left to pay — the row drops its Pay action. */
export function isPayableSettled(payable: VoucherPayable): boolean {
  return payableBalance(payable) <= 0
}
