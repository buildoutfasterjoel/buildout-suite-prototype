import type { FinancialDeduction, FinancialReceivable, VoucherDeposit } from './types'

/**
 * Deposits: spreading one cash receipt across the receivables it pays and the
 * pre-split deductions it covers.
 *
 * Pure on purpose, the same way `invoices.ts` is — no store reads, no clock, no
 * ids generated here. Everything that writes lives in `actions.ts`, and the seed
 * calls into here while it is still BUILDING the store (see
 * `reference-seed-cannot-read-store`), so a single `useDataStore` read would
 * throw at seed time.
 *
 * Payables are NOT computed here. The Apply Deposit modal says a deposit creates
 * payables for brokers and the voucher's Payables section says the same, but that
 * record does not exist yet — writing the arithmetic for it ahead of the type it
 * would fill would be guessing at that record's shape.
 */

/** One row of the Deposit Application Preview. */
export interface DepositPreviewLine {
  /** A `FinancialReceivable.id` or a `FinancialDeduction.id`. */
  targetId: string
  /** What is still outstanding on it before this deposit lands. */
  balance: number
  /** What this deposit puts against it. */
  applied: number
}

export interface DepositPreview {
  /** One line per selected receivable, oldest due date first. */
  receivables: DepositPreviewLine[]
  /** One line per pre-split deduction, in voucher order. */
  deductions: DepositPreviewLine[]
  /** Cash the selected receivables could not absorb. */
  unapplied: number
}

/**
 * Money is counted in cents, so every share lands on one.
 *
 * `Math.round` on the scaled value rather than `toFixed`, which returns a string
 * and would have every caller parse it back.
 */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

/** What a receivable still owes. Never negative — an over-credited line owes nothing. */
export function receivableBalance(r: FinancialReceivable): number {
  return Math.max(0, toCents(r.amount - r.credited))
}

/** What a deduction has left to cover. `covered` is null on one nothing has touched. */
export function deductionBalance(d: FinancialDeduction): number {
  return Math.max(0, toCents(d.amount - (d.covered ?? 0)))
}

/**
 * How a deposit of `amount` would land.
 *
 * **Receivables are filled oldest first, not pro-rata.** The deposit fills each
 * selected receivable up to its outstanding balance in due-date order until it
 * runs out; the rows past that point stay in the preview reading $0.00, because a
 * broker checking where their money went needs to see the lines it did not reach
 * as much as the ones it did.
 *
 * **Deductions take a proportional share, based on the WHOLE voucher.** A
 * deduction is a claim on the entire commission, not on the lines that happen to
 * be selected, so its share is
 *
 *     applied = amount x (deduction amount / total receivable amount)
 *
 * with `allReceivables` as the denominator. Basing it on `selected` instead would
 * over-cover the deduction whenever a voucher is paid in parts: two deposits, each
 * against one of two receivables, would each hand it a full-voucher share.
 *
 * A deduction does not consume the deposit. In the reference design a $5,555.55
 * deposit puts the whole $5,555.55 against a receivable AND $192.49 against a
 * deduction — the deduction is a second reading of the same money, not a slice
 * taken out of it. That is why `unapplied` counts only the receivable lines.
 *
 * Both sides are capped at their own balance, so nothing here can over-pay a line
 * or over-cover a deduction however large the deposit is.
 */
export function previewDeposit({
  amount,
  selected,
  allReceivables,
  deductions,
}: {
  amount: number
  /** The receivables this deposit may touch — one row, or a toolbar selection. */
  selected: FinancialReceivable[]
  /** Every receivable on the voucher. The deduction denominator, nothing else. */
  allReceivables: FinancialReceivable[]
  deductions: FinancialDeduction[]
}): DepositPreview {
  // Sorted here rather than trusted from the caller: a row's own menu passes one
  // receivable and the toolbar passes a Set-derived selection, so neither arrives
  // in a guaranteed order. `yyyy-mm-dd` sorts chronologically as a plain string,
  // which is why these are compared directly rather than parsed.
  const ordered = [...selected].sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  let remaining = Math.max(0, toCents(amount))
  const receivables = ordered.map((r) => {
    const balance = receivableBalance(r)
    const applied = Math.min(remaining, balance)
    remaining = toCents(remaining - applied)
    return { targetId: r.id, balance, applied }
  })

  const receivableTotal = allReceivables.reduce((total, r) => total + r.amount, 0)
  const deductionLines = deductions.map((d) => {
    const balance = deductionBalance(d)
    // A voucher with nothing billed has no denominator. Its deductions read $0.00
    // applied rather than dividing by zero into Infinity.
    const share = receivableTotal > 0 ? toCents((amount * d.amount) / receivableTotal) : 0
    return { targetId: d.id, balance, applied: Math.max(0, Math.min(share, balance)) }
  })

  return { receivables, deductions: deductionLines, unapplied: remaining }
}

/**
 * A four-digit reference for a deposit that arrived without one.
 *
 * **Every deposit carries a reference.** The field is optional to the broker —
 * money often lands before its paperwork does — but a deposit with nothing in
 * that column is a row nobody can match against a bank statement later, so one
 * is generated at the point of save rather than left blank.
 *
 * Bare digits, the same shape a cheque or wire reference has, because the seeded
 * deposits already read that way and a `DEP-` prefix on half the rows would say
 * "these two came from us" — a distinction nothing in the product acts on.
 *
 * Hashed from `seed` rather than drawn at random or from faker. The seed calls
 * this while `generateDataset` is still building the store, and a `faker` call
 * there would move the shared stream and shift every property, contact and deal
 * generated after it (the same reason `isQuickbooksSynced` is a hash). Being
 * deterministic also means a reseed produces the same references.
 *
 * `taken` makes it unique within its voucher — including against references the
 * broker typed by hand, so a generated one cannot collide with a real cheque
 * number already on the page. It steps forward from the hash rather than
 * rehashing, so the first free number near it wins.
 */
export function generateDepositReference(
  seed: string,
  taken: Iterable<string>,
): string {
  const used = new Set(taken)
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_003
  }
  // 9000 candidates, so this exhausts the range before giving up. A voucher with
  // 9000 deposits on it is not a state worth failing over — the last candidate
  // is returned even if it collides, since a duplicate reference is a far
  // smaller problem than a deposit that refuses to save.
  for (let step = 0; step < 9000; step++) {
    const candidate = String(1000 + ((hash + step) % 9000))
    if (!used.has(candidate)) return candidate
  }
  return String(1000 + (hash % 9000))
}

/** One deposit as it appears under the receivable it paid. */
export interface ReceivableDeposit {
  deposit: VoucherDeposit
  /** What THIS deposit put against THIS receivable, not its whole amount. */
  amount: number
}

/**
 * The deposits that landed on one receivable, oldest first.
 *
 * The amount is the allocation, not `deposit.amount`: one deposit can be split
 * across several receivables, and a child row under a $10,000 line that reads
 * the deposit's full $25,000 would be stating someone else's money.
 *
 * Sorted by the date the money landed rather than by the order the deposits were
 * filed, so a back-dated correction sits where it belongs rather than at the end.
 */
export function depositsForReceivable(
  deposits: VoucherDeposit[] | undefined,
  receivableId: string,
): ReceivableDeposit[] {
  return (deposits ?? [])
    .flatMap((deposit) => {
      const applied = deposit.receivableAllocations.find(
        (a) => a.targetId === receivableId,
      )
      return applied ? [{ deposit, amount: applied.amount }] : []
    })
    .sort((a, b) => a.deposit.date.localeCompare(b.deposit.date))
}
