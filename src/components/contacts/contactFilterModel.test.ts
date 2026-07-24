import { describe, expect, it } from "vitest";
import {
  contactFilterChips,
  deserializeContactFilters,
  emptyContactFilters,
  filtersEqual,
  matchesContactFilters,
  serializeContactFilters,
  type ContactFilterState,
} from "./contactFilterModel";
import type { Contact } from "#/data/types";

/** Minimal Contact stub — only the fields the filter predicate reads matter. */
function contact(over: Partial<Contact> = {}): Contact {
  return {
    id: "c1",
    assignedTo: "J. Whitfield",
    source: "Referral",
    side: null,
    dealStage: null,
    relationship: "cold",
    tags: [],
    propertyIds: [],
    lastContactedAt: null,
    openTaskCount: 0,
    inquiries: 0,
    doNotCall: false,
    ...over,
  } as Contact;
}

function filters(over: Partial<ContactFilterState> = {}): ContactFilterState {
  return { ...emptyContactFilters(), ...over };
}

describe("listing-inquiries filter", () => {
  const inquirer = contact({
    inquiries: 2,
    inquiredListingIds: ["deal-1", "deal-2"],
  });
  const quiet = contact();

  it('"none" matches everyone (filter off)', () => {
    expect(matchesContactFilters(inquirer, filters())).toBe(true);
    expect(matchesContactFilters(quiet, filters())).toBe(true);
  });

  it('"any" requires at least one listing inquiry', () => {
    const f = filters({ listingInquiries: "any" });
    expect(matchesContactFilters(inquirer, f)).toBe(true);
    expect(matchesContactFilters(quiet, f)).toBe(false);
  });

  it('"listing" matches only contacts who inquired about that listing', () => {
    const f = filters({
      listingInquiries: "listing",
      inquiryListingId: "deal-2",
    });
    expect(matchesContactFilters(inquirer, f)).toBe(true);
    expect(matchesContactFilters(quiet, f)).toBe(false);
    expect(
      matchesContactFilters(
        contact({ inquiries: 1, inquiredListingIds: ["deal-9"] }),
        f,
      ),
    ).toBe(false);
  });

  it('"listing" with no listing picked yet does not filter', () => {
    const f = filters({ listingInquiries: "listing", inquiryListingId: null });
    expect(matchesContactFilters(quiet, f)).toBe(true);
  });

  it("chips: one chip for the group, none until it actually filters", () => {
    expect(contactFilterChips(filters()).length).toBe(0);
    expect(
      contactFilterChips(
        filters({ listingInquiries: "listing", inquiryListingId: null }),
      ).length,
    ).toBe(0);

    const anyChips = contactFilterChips(filters({ listingInquiries: "any" }));
    expect(anyChips.length).toBe(1);
    expect(anyChips[0].value).toBe("Any Listing Inquiry");

    // Clearing the chip resets both mode and picked listing.
    const cleared = anyChips[0].clear(
      filters({ listingInquiries: "any", inquiryListingId: "deal-1" }),
    );
    expect(cleared.listingInquiries).toBe("none");
    expect(cleared.inquiryListingId).toBe(null);
  });

  it("round-trips through serialize/deserialize", () => {
    const f = filters({
      listingInquiries: "listing",
      inquiryListingId: "deal-3",
    });
    const back = deserializeContactFilters(serializeContactFilters(f));
    expect(back.listingInquiries).toBe("listing");
    expect(back.inquiryListingId).toBe("deal-3");
    expect(filtersEqual(f, back)).toBe(true);
  });

  it("deserialize defaults missing fields to off (older saved lists)", () => {
    const legacy = serializeContactFilters(filters());
    delete (legacy as Partial<typeof legacy>).listingInquiries;
    delete (legacy as Partial<typeof legacy>).inquiryListingId;
    const back = deserializeContactFilters(legacy);
    expect(back.listingInquiries).toBe("none");
    expect(back.inquiryListingId).toBe(null);
  });
});
