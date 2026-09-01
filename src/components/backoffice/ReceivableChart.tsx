import {
  OTHER_CREDITS_COLOR,
  RECEIVABLE_STATUS_COLORS,
  type ReceivableBucket,
} from "#/data/receivables";
import {
  MoneyBarChart,
  type MoneySeries,
} from "#/components/backoffice/MoneyBarChart";

/**
 * The four stacked series, in the order they stack — collected at the bottom,
 * still owed above it, so the height of the coloured part at the top is what is
 * left to chase.
 *
 * Deposits and Overdue borrow the status palette, so a green bar and a green
 * badge are the same green. Other Credits has no status to borrow from: nothing
 * in the data model credits a receivable except a deposit, so its series never
 * draws. The key stays in the legend on purpose — see `otherCredits` on
 * `ReceivableRow`.
 */
const SERIES: readonly MoneySeries<ReceivableBucket>[] = [
  {
    key: "deposits",
    label: "Deposits",
    color: RECEIVABLE_STATUS_COLORS["Fully Paid"],
  },
  { key: "otherCredits", label: "Other Credits", color: OTHER_CREDITS_COLOR },
  { key: "open", label: "Open", color: RECEIVABLE_STATUS_COLORS.Open },
  { key: "overdue", label: "Overdue", color: RECEIVABLE_STATUS_COLORS.Overdue },
];

/**
 * What is owed across the year, bucketed by due date.
 *
 * A collections calendar rather than a cash-received chart: the bar over June is
 * what June asked for, and how much of it is still coloured is how much is still
 * out. It reads the same filtered rows the table below does, so the two can
 * never describe different sets.
 *
 * The drawing itself is `MoneyBarChart`, shared with the Deposits index — this
 * component is now only the four series and what they mean.
 */
export function ReceivableChart({ buckets }: { buckets: ReceivableBucket[] }) {
  return <MoneyBarChart buckets={buckets} series={SERIES} />;
}
