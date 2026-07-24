/**
 * Standalone mock data for the Suite home dashboard. The pipeline-stage summary
 * below is a lightweight "signal → close" snapshot distinct from the Listing
 * lifecycle (`PropertyStatus`) — it tracks pre-listing relationship stages
 * (seller signal, nurturing, pitching) that have no equivalent on a Listing.
 */

/** "Today" for the dashboard's mock data — a Monday, matching the reference design. */
export const DASHBOARD_TODAY = new Date(2026, 6, 6);

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
  id: "marcus-pinckney",
  thumbnailId: "marcus-pinckney-upper-king",
  kicker: "Overnight signal · Insights by Buildout",
  headline: "Marcus Pinckney · Upper King Boutique Block",
  detail:
    "$22M CMBS loan matures Q3 '26. He extended once, so this is the listing window. Phone verified yesterday.",
  potentialTag: "~$20M potential",
  matchTag: "Matches your search · Upper Peninsula retail, 10K+ SF",
  primaryCta: "Call Marcus",
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
    timestamp: "2026-07-05T12:47:00",
  },
  {
    id: "activity-2",
    kind: "call",
    contactName: "Caroline Heyward",
    durationSecs: 38,
    body: "Voicemail — left a message about the Meeting Street walkthrough.",
    timestamp: "2026-07-04T12:47:00",
  },
  {
    id: "activity-3",
    kind: "call",
    contactName: "Sandra Vega",
    durationSecs: 372,
    body: "Warm — walked the closing checklist and confirmed Friday's signing.",
    timestamp: "2026-07-04T12:47:00",
  },
  {
    id: "activity-4",
    kind: "note",
    contactName: "Hector Ravenel",
    body: "BAR attorney suggested we reach out to Charleston Historical Foundation before filing.",
    timestamp: "2026-07-03T12:47:00",
  },
  {
    id: "activity-5",
    kind: "call",
    contactName: "Hector Ravenel",
    durationSecs: 728,
    body: "Warm — discussed the valuation cap and the listing window timeline.",
    timestamp: "2026-07-02T12:47:00",
  },
];

export const AI_FOCUS_NEXT = {
  paragraph:
    "3 overnight signals are surfacing in your cold pool — those should jump the line once today's queue is clear. 4 contacts you've reached are sitting without an opportunity — re-engage or convert. 1 listing is actively marketing in Showcase — check engagement and push the next email beat. 3 deals in closing — make sure no DD checklist is lingering. 27 cold pool targets are ready to surface via Prospect when you have bandwidth.",
  actions: ["Run Prospect scan", "Re-engage stalled contacts", "Review marketing"],
};
