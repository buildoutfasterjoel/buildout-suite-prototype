import {
  DEPOSIT_SERIES_COLORS,
  type DepositBucket,
} from "#/data/depositIndex";
import {
  MoneyBarChart,
  type MoneySeries,
} from "#/components/backoffice/MoneyBarChart";

/**
 * The four bands, bottom of the stack first.
 *
 * Settled at the foot and unfinished business on top, the same rule the
 * Receivables chart follows: the brokerage's own collected split is the base,
 * the brokers' cheques sit on it, and the two bands anybody has to act on —
 * money held back and money still owed out — ride at the cap where they are
 * easiest to spot on a short bar.
 */
const SERIES: readonly MoneySeries<DepositBucket>[] = [
  {
    key: "collectedHouseSplit",
    label: "Collected House Split",
    color: DEPOSIT_SERIES_COLORS.collectedHouseSplit,
  },
  {
    key: "paidToBrokers",
    label: "Paid to Brokers",
    color: DEPOSIT_SERIES_COLORS.paidToBrokers,
  },
  {
    key: "deductedPreSplit",
    label: "Deducted Pre-Split",
    color: DEPOSIT_SERIES_COLORS.deductedPreSplit,
  },
  {
    key: "openPayables",
    label: "Open Payables",
    color: DEPOSIT_SERIES_COLORS.openPayables,
  },
];

/**
 * The key's order, which is not the stack's.
 *
 * It runs in the order the money is spent: held back off the top, paid out to
 * brokers, still owed to them, and whatever the house kept. That is the sentence
 * the four columns of the table read left to right, so the legend and the table
 * header say the same thing in the same order.
 */
const LEGEND: readonly MoneySeries<DepositBucket>[] = [
  SERIES[2],
  SERIES[1],
  SERIES[3],
  SERIES[0],
];

/**
 * Where the year's cash went, bucketed by the day it landed.
 *
 * The bar over May is what May brought in; the stack is where all of it ended
 * up. It reads the same filtered rows the table below does, so the two can never
 * describe different books.
 */
export function DepositChart({ buckets }: { buckets: DepositBucket[] }) {
  return <MoneyBarChart buckets={buckets} series={SERIES} legend={LEGEND} />;
}
