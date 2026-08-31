import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * The Back Office money chart: one stacked bar per bucket, a two-line axis tick
 * under each, a colour key below.
 *
 * Every Back Office index draws the same picture — an amount split into bands
 * across a year — and differs only in what the bands are called and which date
 * files a row into which bucket. So the bucketing stays in each page's own data
 * module and the drawing lives here once.
 *
 * Generic over the bucket rather than typed to a shared bucket interface. Each
 * page's bucket carries its own named figures (`overdue` on Receivables,
 * `openPayables` on Deposits), and `keyof T` is what makes a series key that
 * names a field the bucket does not have a compile error rather than a silently
 * blank band.
 */

/** One stacked band: which figure on the bucket, what to call it, what colour. */
export interface MoneySeries<T> {
  key: Extract<keyof T, string>;
  label: string;
  color: string;
}

/** Every bucket must say what it is called and what its whole bar is worth. */
export interface MoneyBucketBase {
  label: string;
  total: number;
}

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
  buckets: MoneyBucketBase[];
}) {
  const bucket = buckets.find((b) => b.label === payload?.value);
  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text textAnchor="middle" fill="#506079" fontSize={12} dy={14}>
        {payload?.value}
      </text>
      <text
        textAnchor="middle"
        fill="#101828"
        fontSize={12}
        fontWeight={600}
        dy={32}
      >
        {compactMoney(bucket?.total ?? 0)}
      </text>
    </g>
  );
}

/** The colour key under the chart. */
function ChartLegend<T>({ series }: { series: readonly MoneySeries<T>[] }) {
  return (
    <div className="d-flex justify-content-center flex-wrap gap-3">
      {series.map((s) => (
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
 * A year of money, split into bands.
 *
 * `series` is given bottom-up: the first entry is the foot of every stack. Each
 * page orders it so the settled money sits at the bottom and whatever is still
 * moving rides on top, which makes the coloured cap the part worth looking at.
 *
 * The legend is a separate order from the stack — `legend`, when given, is the
 * order the key reads in. Stacks are built from the ground up and legends are
 * read left to right, and the reference designs do not agree that those are the
 * same order.
 */
export function MoneyBarChart<T extends MoneyBucketBase>({
  buckets,
  series,
  legend,
}: {
  buckets: T[];
  /** Bottom of the stack first. */
  series: readonly MoneySeries<T>[];
  /** The key's own order. Defaults to the stack's. */
  legend?: readonly MoneySeries<T>[];
}) {
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
            <BarChart
              data={buckets}
              margin={{ top: 8, right: 8, bottom: 28, left: 8 }}
            >
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
              {series.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  stackId="money"
                  fill={s.color}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <ChartLegend series={legend ?? series} />
    </div>
  );
}
