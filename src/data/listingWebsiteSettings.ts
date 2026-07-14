import { hash } from "#/components/properties/propertyDisplay";
import type { Listing } from "#/data/types";

const TEMPLATE_NAMES = [
  "Modern Listing",
  "Classic Brochure",
  "Minimal Grid",
  "Investment Highlight",
] as const;

export const VISIBILITY_OPTIONS = ["Public", "Private", "Password Protected"] as const;
export type WebsiteVisibility = (typeof VISIBILITY_OPTIONS)[number];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Deterministic per-listing marketing-site status and SEO settings. */
export interface ListingWebsiteSettings {
  published: boolean;
  templateName: string;
  lastUpdated: string;
  websiteUrl: string;
  visibility: WebsiteVisibility;
  metaTitle: string;
  metaDescription: string;
}

/**
 * Deterministic per-listing website settings derived from the listing id, so
 * values stay stable across renders (same approach as `getListingTraffic`).
 */
export function getListingWebsiteSettings(
  listing: Listing,
): ListingWebsiteSettings {
  const h = hash(listing.id);

  // Anchor date matches the prototype "today" used by listingTraffic.ts.
  const anchor = new Date(2026, 5, 26);
  const updated = new Date(anchor);
  updated.setDate(updated.getDate() - (h % 30));

  return {
    published: h % 5 !== 0,
    templateName: TEMPLATE_NAMES[h % TEMPLATE_NAMES.length],
    lastUpdated: `${MONTHS_SHORT[updated.getMonth()]} ${updated.getDate()}, ${updated.getFullYear()}`,
    websiteUrl: `https://properties.buildout.com/${listing.slug}`,
    visibility: VISIBILITY_OPTIONS[h % VISIBILITY_OPTIONS.length],
    metaTitle: `${listing.name} | ${listing.propertyTypeLabel} for ${listing.dealType} in ${listing.city}, ${listing.state}`,
    metaDescription: `${listing.marketing.availableSqFt.toLocaleString()} SF ${listing.propertyTypeLabel.toLowerCase()} property located at ${listing.street}, ${listing.city}, ${listing.state}. Contact us to learn more about this ${listing.dealType.toLowerCase()} opportunity.`,
  };
}
