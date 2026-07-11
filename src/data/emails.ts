import type { PropertyType } from "#/data/types";
import { hash, PROPERTY_TYPES } from "#/components/properties/propertyDisplay";

export type EmailStatus = "draft" | "sent" | "scheduled";

export interface Email {
  id: string;
  status: EmailStatus;
  campaign: string;
  subject: string;
  type: PropertyType;
  primaryBroker: string;
  list: string;
  createdAt: string;
  lastEditedAt: string;
  lastEditedBy: string;
  archived: boolean;
  /** ISO YYYY-MM-DD — when this email lives on the calendar (sent date, scheduled send date, or created date). */
  calendarDate: string;
}

const STATUSES: EmailStatus[] = ["draft", "sent", "scheduled"];

const BROKERS = [
  "Mia Jackson",
  "Joe Smith",
  "Ava Martinez",
  "Liam Chen",
  "Noah Patel",
  "Olivia Brown",
  "Ethan Thompson",
  "Sophia Nguyen",
];

const EDITORS = ["Joe Smith", "Mia Jackson", "Ava Martinez", "Liam Chen"];

const CAMPAIGN_WORDS = [
  "Medial",
  "Gateway",
  "Summit",
  "Harbor",
  "Crossing",
  "Plaza",
  "Heights",
  "Commons",
  "Landing",
  "Park",
];

const SUBJECTS = [
  "New Listing Available",
  "Price Reduction",
  "Open House Invitation",
  "Investment Opportunity",
  "Just Closed",
  "Q1 Market Update",
  "Exclusive Offering",
  "Schedule a Property Tour",
];

/** "Primary Broker" filter options. */
export const EMAIL_BROKERS = BROKERS;

/** "Type" filter options (property types, shown with their display labels). */
export const EMAIL_TYPES = PROPERTY_TYPES;

/** "Status" filter options. */
export const EMAIL_STATUSES = STATUSES;

/** "Lists" filter options (audience lists). */
export const EMAIL_LISTS = [
  "All Contacts",
  "Buyers",
  "Sellers",
  "Investors",
  "Tenants",
  "Past Clients",
];

function fmtDateTime(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${d.getMonth() + 1}/${d.getDate()}/${yy} / ${h}:${min}${ampm} MDT`;
}

function fmtDate(d: Date): string {
  const yy = String(d.getFullYear()).slice(-2);
  return `${d.getMonth() + 1}/${d.getDate()}/${yy}`;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** One day's worth of engagement counts for the performance chart. */
export interface EmailDayMetric {
  date: string; // "MM-DD-YYYY"
  uniqueOpens: number;
  clicks: number;
  unsubscribes: number;
}

/** Per-campaign performance + meta details (only meaningful for sent emails). */
export interface EmailPerformance {
  fromEmail: string;
  sentAt: string; // "May 23, 2026 at 12:32pm CDT"
  propertyCount: number;
  recipientCount: number;
  /** Aggregate rates shown in the stat cards, as integer percentages. */
  delivered: number;
  opens: number;
  clicks: number;
  bounced: number;
  unsubscribed: number;
  /** Daily engagement series for the chart. */
  series: EmailDayMetric[];
}

const EMAIL_COUNT = 48;

let _emails: Email[] | null = null;

/** Deterministic mock email campaigns — stable across renders (see `hash`). */
export function getEmails(): Email[] {
  if (_emails !== null) return _emails;

  const base = new Date(2026, 2, 22, 9, 15); // 3/22/26 9:15am

  // Calendar anchor: June 23, 2026 (today in the prototype)
  const calAnchor = new Date(2026, 5, 23);

  _emails = Array.from({ length: EMAIL_COUNT }, (_, i) => {
    const id = `email-${i + 1}`;
    const h = hash(id);

    const created = new Date(base);
    created.setDate(created.getDate() - (h % 90));
    created.setHours(8 + (h % 9), (h * 7) % 60);

    const edited = new Date(created);
    edited.setDate(edited.getDate() + ((h >>> 2) % 5));

    const status = STATUSES[h % STATUSES.length];

    // calendarDate: scheduled → future ±30 days; sent → past 60 days; draft → past 90 days
    const calDate = new Date(calAnchor);
    if (status === "scheduled") {
      calDate.setDate(calDate.getDate() + 1 + (h % 30));
    } else if (status === "sent") {
      calDate.setDate(calDate.getDate() - (h % 60));
    } else {
      calDate.setDate(calDate.getDate() - (h % 90));
    }

    return {
      id,
      status,
      campaign: `${10000 + (h % 90000)} ${CAMPAIGN_WORDS[(h >>> 1) % CAMPAIGN_WORDS.length]}`,
      subject: SUBJECTS[(h >>> 2) % SUBJECTS.length],
      type: PROPERTY_TYPES[(h >>> 3) % PROPERTY_TYPES.length],
      primaryBroker: BROKERS[(h >>> 4) % BROKERS.length],
      list: EMAIL_LISTS[(h >>> 6) % EMAIL_LISTS.length],
      createdAt: fmtDateTime(created),
      lastEditedAt: fmtDate(edited),
      lastEditedBy: EDITORS[(h >>> 5) % EDITORS.length],
      archived: h % 4 === 0,
      calendarDate: isoDate(calDate),
    };
  });

  return _emails;
}

/** Look up a single campaign by id. */
export function getEmailById(id: string): Email | undefined {
  return getEmails().find((e) => e.id === id);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "May 23, 2026 at 12:32pm CDT" */
function fmtSentAt(d: Date): string {
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${h}:${min}${ampm} CDT`;
}

/** "04-25-2026" */
function fmtShortDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
}

/** broker name → "first.last@example.com" */
function brokerEmail(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
}

/**
 * Deterministic per-campaign performance derived from the campaign id, so the
 * detail page stays stable across renders (same approach as `getEmails`).
 * Only meaningful for `status === "sent"` campaigns.
 */
export function getEmailPerformance(email: Email): EmailPerformance {
  const h = hash(`${email.id}-perf`);

  // Sent date — recent, within ~30 days of the mock's timeframe.
  const sent = new Date(2026, 3, 25, 8 + (h % 9), (h * 7) % 60); // base 4/25/26
  sent.setDate(sent.getDate() + (h % 14));

  const opens = 45 + (h % 35); // 45–79
  const clicks = Math.round(opens * (0.55 + ((h >>> 3) % 25) / 100)); // ~55–80% of opens

  const series: EmailDayMetric[] = Array.from({ length: 7 }, (_, d) => {
    const dh = hash(`${email.id}-day-${d}`);
    const date = new Date(sent);
    date.setDate(date.getDate() + d);
    return {
      date: fmtShortDate(date),
      uniqueOpens: 60 + (dh % 35), // 60–94
      clicks: 35 + ((dh >>> 2) % 35), // 35–69
      unsubscribes: 2 + ((dh >>> 4) % 12), // 2–13
    };
  });

  return {
    fromEmail: brokerEmail(email.primaryBroker),
    sentAt: fmtSentAt(sent),
    propertyCount: 1 + (h % 8), // 1–8
    recipientCount: 200 + (h % 400), // 200–599
    delivered: 96 + (h % 5), // 96–100
    opens,
    clicks,
    bounced: 1 + ((h >>> 5) % 6), // 1–6
    unsubscribed: 1 + ((h >>> 6) % 5), // 1–5
    series,
  };
}
