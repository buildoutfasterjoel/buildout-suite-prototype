import { hash } from "#/components/properties/propertyDisplay";
import { DELGADO_WEBSITE_TRAFFIC, isDelgadoListing } from "#/data/rosaDemoStats";

/** One day's view count for the traffic trend chart. */
export interface TrafficDayMetric {
  /** "Jun 13" — short label for the chart axis. */
  date: string;
  views: number;
}

/** Deterministic mock website-traffic for a listing's marketing site. */
export interface ListingTraffic {
  /** Total page views over the last 30 days. */
  pageViews: number;
  uniqueVisitors: number;
  /** Leads generated from the listing site over the period. */
  leads: number;
  /** Percent change in page views vs. the prior period (can be negative). */
  changePct: number;
  /** Daily views for the last 14 days, ending on the prototype "today". */
  series: TrafficDayMetric[];
  /** Outreach emails sent about this listing in the last 30 days. */
  sent: number;
  /** Replies received to those sends. */
  replies: number;
  /** Confidentiality Agreements Signed — prospective buyers who executed an NDA. */
  cas: number;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Deterministic per-listing traffic derived from the listing id, so values stay
 * stable across renders (same approach as `getEmails` / `PropertyDetailDashboard`).
 */
export function getListingTraffic(listingId: string): ListingTraffic {
  const h = hash(listingId);

  // 14 days ending on the prototype "today" (2026-06-26).
  const anchor = new Date(2026, 5, 26);
  const series: TrafficDayMetric[] = Array.from({ length: 14 }, (_, i) => {
    const dh = hash(`${listingId}-day-${i}`);
    const date = new Date(anchor);
    date.setDate(date.getDate() - (13 - i));
    return {
      date: `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`,
      views: 20 + (dh % 80), // 20–99 views/day
    };
  });

  const sent = 8 + (h % 40); // 8–47
  const replies = Math.round(sent * (0.1 + ((h >>> 3) % 30) / 100)); // ~10–40% reply rate
  const cas = Math.round(replies * (0.2 + ((h >>> 5) % 25) / 100)); // subset of replies

  // The Delgado Building's headline numbers are pinned for the Rosa demo, and
  // the chart is scaled down to match — 14 days of bars should add up to
  // roughly 14/30ths of the 30-day page-view total, not five times it.
  if (isDelgadoListing(listingId)) {
    const scaled = scaleSeriesTo(
      series,
      Math.round((DELGADO_WEBSITE_TRAFFIC.pageViews * 14) / 30),
    );
    return {
      ...DELGADO_WEBSITE_TRAFFIC,
      changePct: changePctFor(scaled),
      series: scaled,
      sent,
      replies,
      cas,
    };
  }

  const pageViews = 400 + (h % 1600); // 400–1999 over 30 days
  return {
    pageViews,
    uniqueVisitors: Math.round(pageViews * (0.55 + ((h >>> 2) % 25) / 100)),
    leads: 3 + (h % 40), // 3–42
    changePct: changePctFor(series),
    series,
    sent,
    replies,
    cas,
  };
}

/** Percent change in views, last 7 days vs. the 7 before. */
function changePctFor(series: TrafficDayMetric[]): number {
  const last7 = series.slice(7).reduce((sum, d) => sum + d.views, 0);
  const prev7 = series.slice(0, 7).reduce((sum, d) => sum + d.views, 0);
  return prev7 === 0 ? 0 : Math.round(((last7 - prev7) / prev7) * 100);
}

/** Rescale a series so its bars keep their shape but sum to about `total`. */
function scaleSeriesTo(
  series: TrafficDayMetric[],
  total: number,
): TrafficDayMetric[] {
  const sum = series.reduce((acc, d) => acc + d.views, 0);
  if (sum === 0) return series;
  return series.map((d) => ({
    ...d,
    views: Math.max(1, Math.round((d.views * total) / sum)),
  }));
}
