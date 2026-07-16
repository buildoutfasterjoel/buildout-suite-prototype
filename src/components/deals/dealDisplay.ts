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

/** MM/DD/YYYY from an ISO date string, or a dash when absent. */
export function formatDate(iso: string | null): string {
  if (!iso) return "--";
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** "Jul 4, 2026" from an ISO string, or a dash when absent. */
export function formatLongDate(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
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
