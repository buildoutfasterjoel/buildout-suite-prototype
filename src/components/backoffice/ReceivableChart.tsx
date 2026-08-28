import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  OTHER_CREDITS_COLOR,
  RECEIVABLE_STATUS_COLORS,
  type ReceivableBucket,
} from "#/data/receivables";

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
const SERIES = [
  { key: "deposits", label: "Deposits", color: RECEIVABLE_STATUS_COLORS["Fully Paid"] },
  { key: "otherCredits", label: "Other Credits", color: OTHER_CREDITS_COLOR },
  { key: "open", label: "Open", color: RECEIVABLE_STATUS_COLORS.Open },
  { key: "overdue", label: "Overdue", color: RECEIVABLE_STATUS_COLORS.Overdue },
] as const;

/** Compact money for an axis tick: `$682k`, `$90k`, `$0`. */
function compactMoney(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** Full money for the hover card, where there is room to be exact. */
const exactMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * A two-line axis tick: the bucket over what it holds.
 *
 * A custom tick rather than two axes. Recharts positions `<text>` by the tick's
 * own coordinates, so both lines stay glued to their bar however the container
 * resizes; a second `XAxis` would have to be kept in step by hand.
 */
function BucketTick({
  x,
  y,
  payload,
  buckets,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  buckets: ReceivableBucket[];
}) {
  const bucket = buckets.find((b) => b.label === payload?.value);
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text textAnchor="middle" fill="#506079" fontSize={12} dy={14}>
        {payload?.value}
      </text>
      <text textAnchor="middle" fill="#101828" fontSize={12} fontWeight={600} dy={32}>
        {compactMoney(bucket?.total ?? 0)}
      </text>
    </g>
  );
}

/** The colour key under the chart. */
function ChartLegend() {
  return (
    <div className="d-flex justify-content-center flex-wrap gap-3">
      {SERIES.map((s) => (
        <div key={s.key} className="d-flex align-items-center gap-2 fs-small">
          <span
            className="rounded-1 flex-shrink-0"
            style={{ width: 10, height: 10, backgroundColor: s.color }}
            aria-hidden="true"
          />
          <span className="text-muted">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * What is owed across the year, bucketed by due date.
 *
 * A collections calendar rather than a cash-received chart: the bar over June is
 * what June asked for, and how much of it is still coloured is how much is still
 * out. It reads the same filtered rows the table below does, so the two can
 * never describe different sets.
 */
export function ReceivableChart({ buckets }: { buckets: ReceivableBucket[] }) {
  // ResponsiveContainer measures the DOM, so the chart is held back until after
  // mount to avoid an SSR / hydration mismatch — the same guard the email
  // performance chart uses.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const empty = buckets.every((b) => b.total === 0);

  return (
    <div className="d-flex flex-column gap-3">
      <div style={{ height: 240 }}>
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 28, left: 8 }}>
              {/* No grid and no Y axis. The figure under each bucket already
                  says what the bar is worth, and gridlines behind twelve mostly
                  empty months are more ink than answer. */}
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "#d7dbe3" }}
                tick={<BucketTick buckets={buckets} />}
                height={44}
              />
              {/* Hidden, but present: without it recharts scales the stack to
                  the tallest single series rather than to the stack total. */}
              <YAxis hide />
              {!empty && (
                <ChartTooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  contentStyle={{
                    borderRadius: 6,
                    border: "1px solid #eceef2",
                    fontSize: 12,
                  }}
                  // Recharts types the formatter's value as possibly undefined
                  // and possibly an array, so it is narrowed here rather than
                  // asserted — a stacked bar with no data for one series really
                  // does hand this `undefined`.
                  formatter={(value, name) => [
                    exactMoney(typeof value === "number" ? value : 0),
                    String(name),
                  ]}
                />
              )}
              {SERIES.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="receivables"
                  fill={s.color}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <ChartLegend />
    </div>
  );
}
