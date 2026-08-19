/**
 * Standalone mock data for the Suite home dashboard. The pipeline-stage summary
 * below is a lightweight "signal → close" snapshot distinct from the Listing
 * lifecycle (`PropertyStatus`) — it tracks pre-listing relationship stages
 * (seller signal, inquired, nurturing, pitching) that have no equivalent on a
 * Listing. Inquired and Nurturing carry no dollar figure by design: neither has
 * a deal behind it yet, so they don't roll into `FORECAST.openPipeline`.
 */
import type { HeroKey } from "#/data/types";

/** Local midnight on the real current date. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * "Today" for the dashboard's mock data. Live, not pinned: it used to be frozen
 * at 2026-07-06 (a Monday, matching the reference design), so every demo after
 * that week opened on a visibly stale date. Local midnight, because its readers
 * compare whole days — the home page's date line, the pipeline report's
 * close-date filters, and the relative labels in Recent activity.
 *
 * Evaluated once per page load, which is the right granularity for a demo.
 */
export const DASHBOARD_TODAY = startOfToday();

/**
 * A local ISO timestamp `daysAgo` days before {@link DASHBOARD_TODAY} at
 * `hh:mm`. Fixture "when"s go through here rather than being written as literal
 * dates, so the activity feed keeps its intended spacing ("11h ago", "2d ago")
 * no matter when the demo runs.
 */
function daysBeforeToday(daysAgo: number, hour: number, minute: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}:00`;
}

export interface PipelineStageSummary {
  id: string;
  label: string;
  count: number;
  subtext: string;
  /** True only for the lead "Seller signal" tile — gets the AI/purple treatment. */
  accent?: boolean;
}

export const PIPELINE_SUMMARY: PipelineStageSummary[] = [
  {
    id: "seller-signal",
    label: "Seller signal",
    count: 1,
    subtext: "~$20.0M potential",
    accent: true,
  },
  {
    id: "inquired",
    label: "Inquired",
    count: 4,
    subtext: "Inbound · not yet worked",
  },
  {
    id: "nurturing",
    label: "Nurturing",
    count: 3,
    subtext: "Touched · no live deal",
  },
  { id: "pitching", label: "Pitching", count: 1, subtext: "$4.0M" },
  { id: "active", label: "Active", count: 3, subtext: "$20.9M" },
  {
    id: "under-contract",
    label: "Under Contract",
    count: 1,
    subtext: "$2.1M",
  },
  { id: "closed", label: "Closed", count: 1, subtext: "$12.4M" },
];

export const FORECAST = {
  openPipeline: "$27.0M",
  openDeals: 5,
  closedValue: "$12.4M",
};

export interface FocusSignal {
  id: string;
  /** The hero-persona contact this signal is about — resolves to the live record. */
  heroKey: HeroKey;
  thumbnailId: string;
  kicker: string;
  headline: string;
  detail: string;
  potentialTag: string;
  matchTag: string;
  primaryCta: string;
  secondaryCta: string;
}

export const FOCUS_SIGNAL: FocusSignal = {
  id: "rosa-delgado",
  heroKey: "rosa",
  thumbnailId: "rosa-delgado-building",
  kicker: "Overnight signal · Insights by Buildout",
  headline: "Rosa Delgado · The Delgado Building",
  detail:
    "A balloon note on her 48-unit building matures soon — she found the loan papers in Miguel's things and left a voicemail asking to understand her options. No ask yet.",
  potentialTag: "~$6.2M potential",
  matchTag: "Matches your search · Workforce multifamily, 40+ units",
  primaryCta: "Call Rosa",
  secondaryCta: "Open record",
};

/**
 * Recent-activity feed items, shaped to render with the contact detail page's
 * timeline styles (`.tl-row`): the actor line is "you › contact", calls carry a
 * duration, and `body` is the note/call summary text.
 */
export interface ActivityItem {
  id: string;
  kind: "note" | "call";
  contactName: string;
  /** Call length in seconds — rendered "(m:ss)" after the actor line. */
  durationSecs?: number;
  body?: string;
  /** ISO timestamp. */
  timestamp: string;
}

export const RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: "activity-1",
    kind: "note",
    contactName: "Sandra Vega",
    body: "Closing-day gift idea: frame a print of the 1940s Spring Street streetscape for the lobby.",
    timestamp: daysBeforeToday(1, 12, 47),
  },
  {
    id: "activity-2",
    kind: "call",
    contactName: "Caroline Heyward",
    durationSecs: 38,
    body: "Voicemail — left a message about the Meeting Street walkthrough.",
    timestamp: daysBeforeToday(2, 12, 47),
  },
  {
    id: "activity-3",
    kind: "call",
    contactName: "Sandra Vega",
    durationSecs: 372,
    body: "Warm — walked the closing checklist and confirmed Friday's signing.",
    timestamp: daysBeforeToday(2, 12, 47),
  },
  {
    id: "activity-4",
    kind: "note",
    contactName: "Hector Ravenel",
    body: "BAR attorney suggested we reach out to Charleston Historical Foundation before filing.",
    timestamp: daysBeforeToday(3, 12, 47),
  },
  {
    id: "activity-5",
    kind: "call",
    contactName: "Hector Ravenel",
    durationSecs: 728,
    body: "Warm — discussed the valuation cap and the listing window timeline.",
    timestamp: daysBeforeToday(4, 12, 47),
  },
];

export const AI_FOCUS_NEXT = {
  paragraph:
    "3 overnight signals are surfacing in your cold pool — those should jump the line once today's queue is clear. 4 contacts you've reached are sitting without an opportunity — re-engage or convert. 1 listing is actively marketing in Showcase — check engagement and push the next email beat. 3 deals in closing — make sure no DD checklist is lingering. 27 cold pool targets are ready to surface via Prospect when you have bandwidth.",
  actions: ["Run Prospect scan", "Re-engage stalled contacts", "Review marketing"],
};
