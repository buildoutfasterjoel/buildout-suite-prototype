import { hash } from "#/components/properties/propertyDisplay";

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

  const last7 = series.slice(7).reduce((sum, d) => sum + d.views, 0);
  const prev7 = series.slice(0, 7).reduce((sum, d) => sum + d.views, 0);
  const changePct = prev7 === 0 ? 0 : Math.round(((last7 - prev7) / prev7) * 100);

  const pageViews = 400 + (h % 1600); // 400–1999 over 30 days
  const sent = 8 + (h % 40); // 8–47
  const replies = Math.round(sent * (0.1 + ((h >>> 3) % 30) / 100)); // ~10–40% reply rate
  const cas = Math.round(replies * (0.2 + ((h >>> 5) % 25) / 100)); // subset of replies
  return {
    pageViews,
    uniqueVisitors: Math.round(pageViews * (0.55 + ((h >>> 2) % 25) / 100)),
    leads: 3 + (h % 40), // 3–42
    changePct,
    series,
    sent,
    replies,
    cas,
  };
}
