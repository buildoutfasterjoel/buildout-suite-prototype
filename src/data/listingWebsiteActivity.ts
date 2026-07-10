import { hash } from "#/components/properties/propertyDisplay";
import { SYNDICATION_NETWORK_NAMES } from "#/data/listingSyndication";

const EVENT_TYPES = [
  "Page View",
  "Page View",
  "Page View",
  "Lead Form Submitted",
  "Document Downloaded",
  "Contact Clicked",
] as const;

const PAGES = ["/overview", "/photos", "/financials", "/documents", "/contact"];

const SOURCES = [
  "Direct",
  "Organic Search",
  "Email Campaign",
  "Referral",
  ...SYNDICATION_NETWORK_NAMES,
];

const DEVICES = ["Desktop", "Mobile", "Tablet"] as const;

const LOCATIONS = [
  "Chicago, IL",
  "Dallas, TX",
  "Atlanta, GA",
  "Denver, CO",
  "Phoenix, AZ",
  "Seattle, WA",
  "Charlotte, NC",
  "Austin, TX",
];

const FIRST_NAMES = ["Jordan", "Casey", "Morgan", "Riley", "Avery", "Taylor"];
const LAST_NAMES = ["Reed", "Brooks", "Kim", "Patel", "Nguyen", "Ortiz"];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** A single visitor event on a listing's marketing site. */
export interface WebsiteVisitEvent {
  id: string;
  timestamp: string;
  visitor: string;
  eventType: (typeof EVENT_TYPES)[number];
  page: string;
  source: string;
  device: (typeof DEVICES)[number];
  location: string;
}

function fmtTimestamp(d: Date): string {
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours24 < 12 ? "AM" : "PM";
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${hours12}:${minutes} ${ampm}`;
}

const EVENT_COUNT = 48;

/**
 * Deterministic per-listing website visit events derived from the listing id,
 * so values stay stable across renders (same approach as `getListingTraffic`).
 */
export function getListingWebsiteActivity(listingId: string): WebsiteVisitEvent[] {
  // Anchor date matches the prototype "today" used by listingTraffic.ts.
  const anchor = new Date(2026, 5, 26);

  return Array.from({ length: EVENT_COUNT }, (_, i) => {
    const h = hash(`${listingId}-visit-${i}`);
    const date = new Date(anchor);
    date.setDate(date.getDate() - (h % 30));
    date.setHours((h >>> 4) % 24, (h >>> 8) % 60);

    const isAnonymous = h % 5 !== 0;
    const visitor = isAnonymous
      ? "Anonymous"
      : `${FIRST_NAMES[h % FIRST_NAMES.length]} ${LAST_NAMES[(h >>> 2) % LAST_NAMES.length]}`;

    return {
      id: `${listingId}-visit-${i}`,
      date,
      visitor,
      eventType: EVENT_TYPES[(h >>> 3) % EVENT_TYPES.length],
      page: PAGES[(h >>> 5) % PAGES.length],
      source: SOURCES[(h >>> 6) % SOURCES.length],
      device: DEVICES[(h >>> 7) % DEVICES.length],
      location: LOCATIONS[(h >>> 9) % LOCATIONS.length],
    };
  })
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map(({ date, ...rest }) => ({ ...rest, timestamp: fmtTimestamp(date) }));
}
