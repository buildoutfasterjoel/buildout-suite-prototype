import type { PropertyStatus } from "#/data/types";

/**
 * Serializable filter payloads a tool result can hand to the chat's summary
 * card. When a tool returns more than one entity, the assistant sidebar shows a
 * single "N deals / N contacts" summary card (instead of a flood of item cards)
 * whose button pushes one of these payloads into the destination's bridge store
 * and navigates there — landing the broker on a pre-filtered view.
 */

/** Explicit Listings-grid facets (see `-useListingsFilter`). */
export interface ListingsFacets {
  statuses?: PropertyStatus[];
  dealType?: "Sale" | "Lease";
  search?: string;
}

/** Explicit People-directory filters (see `-useContactsFilter`). */
export interface ContactsFilterPayload {
  relationship?: string;
  tag?: string;
  search?: string;
}

/**
 * A summary + "get there" descriptor for one entity category in a tool result.
 * `listingsFacets` / `contactsFilter` are optional — when absent the summary
 * card's button just opens the section page unfiltered (used for scoped tools
 * like "a contact's deals" where a filter view doesn't apply).
 */
export interface ResultNav {
  entity: "deals" | "contacts" | "properties";
  count: number;
  summary: string;
  listingsFacets?: ListingsFacets;
  contactsFilter?: ContactsFilterPayload;
}
