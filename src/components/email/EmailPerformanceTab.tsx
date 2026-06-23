import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/pro-regular-svg-icons";
import type { EmailPerformance } from "#/data/emails";

/** Chart series colors, from the Figma mock. */
const COLOR_OPENS = "#8833ea";
const COLOR_CLICKS = "#2968e7";
const COLOR_UNSUBS = "#e27400";

const SERIES = [
  { label: "Unique Opens", color: COLOR_OPENS },
  { label: "Clicks", color: COLOR_CLICKS },
  { label: "Unsubscribes", color: COLOR_UNSUBS },
];

/** Legend matching the mock: each series in a bordered box with a tall swatch. */
function ChartLegend() {
  return (
    <div className="d-flex justify-content-center">
      <div className="d-inline-flex border rounded overflow-hidden">
        {SERIES.map((s, i) => (
          <div
            key={s.label}
            className={`d-flex align-items-center gap-2 px-3 py-2${i > 0 ? " border-start" : ""}`}
          >
            <span
              className="d-inline-block"
              style={{
                width: 8,
                height: 14,
                borderRadius: 2,
                backgroundColor: s.color,
              }}
              aria-hidden="true"
            />
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

type StatDef = {
  label: string;
  value: number;
  tip: string;
};

/** One aggregate-rate card: big percentage, muted label, info tooltip. */
function StatCard({ stat }: { stat: StatDef }) {
  return (
    <div
      className="position-relative border rounded p-3 flex-fill"
      style={{ minWidth: 160 }}
    >
      <div className="fs-2 fw-semibold lh-1">{stat.value}%</div>
      <div className="text-muted mt-1">{stat.label}</div>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <span
              className="position-absolute top-0 end-0 m-2 text-muted lh-1"
              role="button"
              tabIndex={0}
              aria-label={`About ${stat.label}`}
            >
              <FontAwesomeIcon icon={faCircleInfo} />
            </span>
          }
        />
        <Tooltip.Content>{stat.tip}</Tooltip.Content>
      </Tooltip>
    </div>
  );
}

/** Performance tab: five aggregate-rate cards over a daily engagement chart. */
export function EmailPerformanceTab({
  performance,
}: {
  performance: EmailPerformance;
}) {
  // ResponsiveContainer measures the DOM, so only render the chart after mount
  // to avoid an SSR / hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const stats: StatDef[] = [
    {
      label: "Delivered",
      value: performance.delivered,
      tip: "Percentage of sent emails that reached the recipient's inbox.",
    },
    {
      label: "Opens",
      value: performance.opens,
      tip: "Percentage of delivered emails that were opened at least once.",
    },
    {
      label: "Clicks",
      value: performance.clicks,
      tip: "Percentage of delivered emails where a link was clicked.",
    },
    {
      label: "Bounced",
      value: performance.bounced,
      tip: "Percentage of emails that could not be delivered.",
    },
    {
      label: "Unsubscribed",
      value: performance.unsubscribed,
      tip: "Percentage of recipients who opted out after this send.",
    },
  ];

  return (
    <div className="d-flex flex-column gap-4">
      {/* Stat cards */}
      <div className="d-flex flex-wrap gap-2">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>

      {/* Engagement chart */}
      <ChartLegend />
      <div style={{ height: 360 }}>
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={performance.series}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceef2" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "#506079" }}
                tickLine={false}
                axisLine={{ stroke: "#eceef2" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: "#506079" }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                contentStyle={{
                  borderRadius: 6,
                  border: "1px solid #eceef2",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="uniqueOpens"
                name="Unique Opens"
                fill={COLOR_OPENS}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="clicks"
                name="Clicks"
                fill={COLOR_CLICKS}
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="unsubscribes"
                name="Unsubscribes"
                fill={COLOR_UNSUBS}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
