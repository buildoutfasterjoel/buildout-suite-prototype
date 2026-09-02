/**
 * The Back Office payables index — every payable in the book, grouped by the
 * broker it is owed to.
 *
 * The third of the three money indexes, and the only one that is not a flat
 * table. `receivables.ts` asks what has been billed; `depositIndex.ts` asks
 * where the cash that arrived went. This one asks the question a person acts
 * on: **who do we owe, and how much.** A broker is the unit of that answer —
 * cheques are written per person, not per deal — so the rows arrive already
 * gathered under the broker rather than sorted and left for the eye to group.
 *
 * Nothing here reads the clock, for the reason `depositIndex.ts` gives: a
 * payable is raised by money that has already landed, so no figure on the page
 * turns over at midnight. {@link payableYears} takes `now` as a parameter, and
 * it is the only function in the module that wants one.
 *
 * Every figure comes from `payables.ts` rather than being re-derived here, so
 * this page and the voucher's own Payables section cannot drift into telling
 * two stories about the same debt.
 */
import type {
  DealType,
  PropertyStatus,
  PropertyType,
  VoucherPayable,
} from './types'
import { getStore, getProperty } from './store'
import { payableBalance, payableBrokers, payableGrossPaid } from './payables'
import { voucherHref, type VoucherTarget } from './vouchers'
import { brokerFace, type ReceivableBroker } from './receivables'

/**
 * Where a payable stands. Derived on read — nothing stores it — so a row cannot
 * be marked settled while it still owes money.
 *
 * Two values, not three. There is deliberately no `Partially Paid`, the same
 * call `ReceivableStatus` makes and for the same reason: the badge is
 * answering "does anybody still need to cut this cheque", and a part-paid row
 * already says so twice over, in Amount and in Balance.
 */
export type PayableStatus = 'Outstanding' | 'Fully Paid'

/** Filter order, and the order the status facet lists them: unfinished first. */
export const PAYABLE_STATUSES: PayableStatus[] = ['Outstanding', 'Fully Paid']

export interface PayableRow {
  /**
   * `${dealId}:${payableId}` — the row's identity for React keys and for the
   * selection set. A bare payable id would do today, but ids are only unique
   * within their own voucher by construction, and a selection keyed on one
   * would silently merge two rows the day that stopped being true.
   */
  key: string
  dealId: string
  payableId: string
  /** The voucher's own name — what the Payable For cell reads. */
  voucherName: string
  /** Where the Payable For cell links: this deal's voucher tab. */
  target: VoucherTarget
  /** `yyyy-mm-dd` — the date of the deposit that raised it. See {@link VoucherPayable.date}. */
  date: string
  /** This broker's share of what that deposit brought in. */
  amount: number
  /** Written against it so far, before the broker's split. */
  paid: number
  /** What is still owed. The figure a payment is written against. */
  balance: number
  status: PayableStatus

  // --- Facets, carried onto the row so the filter predicate reads one flat
  // object rather than walking back to the store for every test.
  dealStage: PropertyStatus
  dealType: DealType
  propertyType: PropertyType | null
  /** Lower-cased haystack: broker, voucher, amounts. */
  searchText: string
}

/** One broker, and everything the brokerage owes them. */
export interface PayableGroup {
  /** The broker's email, lower-cased — see {@link brokerKey} for why not the id. */
  key: string
  broker: ReceivableBroker
  /** True for a co-broke. Outside brokers sort first — see {@link allPayableGroups}. */
  outside: boolean
  rows: PayableRow[]
  /**
   * What the broker row states as Total due: the sum of the group's
   * BALANCES, not its amounts.
   *
   * "Total due" is a debt, and a payable that has been paid in full is not one.
   * Footing the Amount column instead would have a broker with nothing
   * outstanding still reading a five-figure total.
   */
  totalDue: number
}

/** Money is counted in cents, so no float tail leaks into a total. */
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * What gathers two payables under one person.
 *
 * The email, NOT `DealBroker.id`. An id is drawn fresh per deal — the same
 * broker on five deals carries five of them — so grouping on it would give one
 * person five groups of one row each, which is the exact thing this page
 * exists to avoid. Email is stable for the house's own people because the seed
 * takes their identity from `TEAMMATES`.
 *
 * Falls back to the name when a broker carries no email, and to the id when
 * they carry neither, so a group key is never empty and two nameless brokers
 * can never merge into one.
 */
function brokerKey(broker: { id: string; name: string; email: string }): string {
  const email = broker.email.trim().toLowerCase()
  if (email) return email
  const name = broker.name.trim().toLowerCase()
  return name || broker.id
}

/** Where a payable stands. See {@link PayableStatus}. */
export function payableStatus(payable: VoucherPayable): PayableStatus {
  return payableBalance(payable) > 0 ? 'Outstanding' : 'Fully Paid'
}

/**
 * Every payable in the book, gathered by broker.
 *
 * A deal with no voucher contributes nothing — `voucherHref` owns the "does
 * this deal have a voucher" question, so the rule stays in one place — and
 * neither does a voucher with no payables, which is every Draft and Pending
 * one: there is nothing to pay out of a commission nobody has signed off.
 *
 * **Group order: outside brokers first, then the house's own, each block
 * alphabetical.** That is the order `payableBrokers` already puts them in on
 * the voucher, and it is not cosmetic — a co-broke comes off the top of the
 * commission before the brokerage splits what is left with its own people, so
 * reading the outside broker first is reading the money in the order it
 * actually leaves.
 *
 * **Row order within a group: newest first.** A broker opening this page is
 * looking at what they are owed now, and the debts raised most recently are the
 * ones that have not yet been dealt with.
 */
export function allPayableGroups(): PayableGroup[] {
  const groups = new Map<string, PayableGroup>()

  for (const deal of getStore().listings.values()) {
    const target = voucherHref(deal)
    if (!target) continue

    const voucher = deal.transaction.backOffice
    const payables = voucher.payables ?? []
    if (payables.length === 0) continue

    const property = getProperty(deal.propertyId)
    const brokers = payableBrokers(deal)

    for (const payable of payables) {
      const broker = brokers.find((b) => b.id === payable.brokerId)
      // A payable whose broker cannot be found. {@link VoucherPayable} explains
      // why the data should not reach this state; it is skipped rather than
      // rendered under an "Unknown" heading, because a group with no name is
      // not a person anybody can write a cheque to.
      if (!broker) continue

      const key = brokerKey(broker)
      const balance = payableBalance(payable)

      const row: PayableRow = {
        key: `${deal.id}:${payable.id}`,
        dealId: deal.id,
        payableId: payable.id,
        voucherName: voucher.name,
        target,
        date: payable.date,
        amount: payable.grossAmount,
        paid: payableGrossPaid(payable),
        balance,
        status: payableStatus(payable),
        dealStage: deal.status,
        dealType: deal.dealType,
        propertyType: property?.propertyType ?? null,
        // Amounts go in unformatted as well as grouped, so "10100.97" and
        // "10,100.97" both find the same row — the same promise the receivables
        // search bar makes.
        searchText: [
          broker.name,
          voucher.name,
          String(payable.grossAmount),
          String(balance),
        ]
          .join(' ')
          .toLowerCase(),
      }

      const existing = groups.get(key)
      if (existing) {
        existing.rows.push(row)
        existing.totalDue = toCents(existing.totalDue + balance)
      } else {
        groups.set(key, {
          key,
          broker: brokerFace(broker.name),
          outside: broker.side === 'outside',
          rows: [row],
          totalDue: balance,
        })
      }
    }
  }

  const ordered = [...groups.values()]
  for (const group of ordered) {
    group.rows.sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.voucherName.localeCompare(b.voucherName),
    )
  }

  return ordered.sort((a, b) => {
    if (a.outside !== b.outside) return a.outside ? -1 : 1
    return a.broker.name.localeCompare(b.broker.name, 'en', { numeric: true })
  })
}

/**
 * The groups again, holding only the rows that survive `keep`, with every
 * empty group dropped and each total re-footed.
 *
 * The page filters through here rather than flattening and re-grouping,
 * because a total that did not move with its rows would leave a broker row
 * claiming a debt the table beneath it no longer shows.
 */
export function filterPayableGroups(
  groups: PayableGroup[],
  keep: (row: PayableRow) => boolean,
): PayableGroup[] {
  return groups.flatMap((group) => {
    const rows = group.rows.filter(keep)
    if (rows.length === 0) return []
    return [
      {
        ...group,
        rows,
        totalDue: rows.reduce((total, r) => toCents(total + r.balance), 0),
      },
    ]
  })
}

/** How many payables the groups hold — what "Displaying N payables" counts. */
export function countPayables(groups: PayableGroup[]): number {
  return groups.reduce((total, g) => total + g.rows.length, 0)
}

/** Every row in the groups, in the order the table renders them. */
export function payableRows(groups: PayableGroup[]): PayableRow[] {
  return groups.flatMap((g) => g.rows)
}

/**
 * The years the Creation Date dropdown offers: every year a payable was raised
 * in, newest first, with the current year always present.
 *
 * Derived from the book rather than a fixed range, for the reason
 * `depositYears` is — an option nothing matches is a dead end. The
 * current year is forced in so the dropdown always has something selectable on
 * a book with nothing raised this year.
 */
export function payableYears(groups: PayableGroup[], now: Date): number[] {
  const years = new Set(
    payableRows(groups).map((r) => Number(r.date.slice(0, 4))),
  )
  years.add(now.getFullYear())
  return [...years].sort((a, b) => b - a)
}
