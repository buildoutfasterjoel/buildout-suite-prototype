import type { Listing } from "#/data/types";
import { formatPrice } from "#/components/properties/propertyDisplay";

/** Whole-dollar currency, e.g. $10,000,000 — used in deal tables. */
export function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

/** Full currency, e.g. $10,000,000.00 — matches the deal overview / financials. */
export function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** A bare `YYYY-MM-DD`, with no time or zone attached. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An ISO string as a Date the local calendar agrees with.
 *
 * A date-only string names a calendar day and carries no zone, but
 * `new Date('2026-08-14')` reads it as UTC midnight — so anywhere west of
 * Greenwich every such date renders as the day *before* the one stored. Building
 * it from parts pins it to local midnight instead. A full timestamp does carry
 * an offset, so `Date` is right to convert it and is left alone.
 *
 * `formatMonthYear` below has always done this for itself; the day-level
 * formatters simply never got the same treatment, which put the voucher index's
 * Close Date column a day behind the close-date filter beside it.
 */
function parseIsoDate(iso: string): Date {
  if (!DATE_ONLY.test(iso)) return new Date(iso);
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** MM/DD/YYYY from an ISO date string, or a dash when absent. */
export function formatDate(iso: string | null): string {
  if (!iso) return "--";
  const d = parseIsoDate(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** "Jul 4, 2026" from an ISO string, or a dash when absent. */
export function formatLongDate(iso: string | null): string {
  if (!iso) return "--";
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * "Mar 2027" from an ISO string, or a dash when absent — no day.
 *
 * Parses the `YYYY-MM-DD` parts directly rather than handing the string to
 * `Date`: `new Date('2027-04-01')` parses as UTC midnight, so in any
 * negative-offset timezone `toLocaleDateString` renders the month before —
 * "Mar 2027" instead of "Apr 2027". Building the `Date` from local parts (the
 * way `localISO` in `stageGates.ts` goes the other direction, `Date` → parts)
 * keeps this on the month the string actually names.
 */
export function formatMonthYear(iso: string | null): string {
  if (!iso) return "--";
  return parseIsoDate(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** "Jun 12, 2026 · 3:40 PM" from an ISO string, or a dash when absent. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** The lease terms shown on a card — the deal's own unit, else the first. */
function primaryLeaseTerms(listing: Listing) {
  const terms = listing.marketing.spaceLeaseTerms ?? [];
  return terms.find((t) => t.unitId === listing.unitId) ?? terms[0];
}

/**
 * Numeric deal headline for sorting/forecasting: sale asking price, or an
 * annualized lease value for Lease deals (rate normalized by its units).
 */
export function dealHeadlineValue(listing: Listing): number {
  if (listing.dealType !== "Lease") return listing.financials.askingPrice;
  const t = primaryLeaseTerms(listing);
  if (!t || t.leaseRate == null) return 0;
  const sqft = listing.marketing.availableSqFt || 0;
  switch (t.leaseRateUnits) {
    case "Monthly":
      return t.leaseRate * 12;
    case "SF/Mo":
      return t.leaseRate * 12 * sqft;
    default: // "SF/Yr"
      return t.leaseRate * sqft;
  }
}

/** Formatted deal headline for cards: "$45/SF" for leases, formatPrice() otherwise. */
export function dealHeadlineLabel(listing: Listing): string {
  if (listing.dealType === "Lease") {
    const t = primaryLeaseTerms(listing);
    return t?.leaseRate != null ? `$${t.leaseRate}/SF` : "—";
  }
  return formatPrice(listing.financials.askingPrice);
}
