import type { Listing } from "#/data/types";
import { getActivityFunnel, type ClientReportKpis } from "#/data/listingClientReport";
import { Section } from "../listingWidgets";

/** Sequential purple ramp (dark → light), same hue family as the Website traffic chart's accent. */
const FUNNEL_COLORS = [
  "#3a1264",
  "#46177d",
  "#5c1fa3",
  "#7228c9",
  "#8833ea",
  "#9a55ee",
  "#ac77f1",
  "#be99f4",
];

/** Smallest visible bar width, so a late-stage count near zero doesn't vanish entirely. */
const MIN_BAR_PCT = 6;

/**
 * Activity funnel as a bar per stage rather than a recharts trapezoid — each bar's
 * width is directly comparable to the one above it (the trapezoid's taper made that
 * comparison harder to read, and clipped labels in a narrow column). The percentage
 * next to each count makes the stage-to-stage drop-off explicit.
 */
export function ClientReportFunnel({
  listing,
  kpis,
}: {
  listing: Listing;
  kpis: ClientReportKpis;
}) {
  const stages = getActivityFunnel(listing.id, kpis.casSigned);
  const topCount = stages[0]?.count ?? 1;

  return (
    <Section title="Activity Funnel">
      <div className="d-flex flex-column gap-3">
        {stages.map((s, i) => {
          const prev = stages[i - 1];
          const widthPct = Math.max(MIN_BAR_PCT, Math.round((s.count / topCount) * 100));
          const pctOfPrev = prev ? Math.round((s.count / prev.count) * 100) : null;
          return (
            <div key={s.stage} className="d-flex flex-column gap-1">
              <div className="d-flex align-items-baseline justify-content-between gap-2">
                <span className="fw-semibold text-nowrap">{s.stage}</span>
                <span className="d-flex align-items-baseline gap-2 text-nowrap">
                  <span className="fw-bold">{s.count.toLocaleString()}</span>
                  {pctOfPrev !== null && (
                    <span className="text-muted fs-small">{pctOfPrev}% of prior</span>
                  )}
                </span>
              </div>
              <div className="bg-secondary-subtle rounded-pill" style={{ height: 10 }}>
                <div
                  className="h-100 rounded-pill"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
