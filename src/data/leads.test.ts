import { describe, expect, it } from "vitest";
import { getContactsForProperty, getLeadsForProperty } from "./store";
import { getClientReportLeads } from "./listingClientReport";
import {
  getContactDetailClient,
  listDealsForContact,
  listLeadDealsForContact,
} from "./selectors";
import { useDataStore } from "./dataStore";

/**
 * A deal's assigned seller is the broker's client. Surfacing them alongside the
 * inbound leads they're paying the broker to attract breaks the demo's fiction
 * — and on the client report, shows the client to themselves.
 */
describe("leads exclude the deal's assigned seller", () => {
  const listings = () => [...useDataStore.getState().listings.values()];

  it("drops every seller named on a property's deals", () => {
    for (const listing of listings()) {
      const leadIds = new Set(
        getLeadsForProperty(listing.propertyId).map((c) => c.id),
      );
      for (const sellerId of listing.sellerContactIds) {
        expect(leadIds.has(sellerId)).toBe(false);
      }
    }
  });

  it("still leaves every seeded deal with leads to show", () => {
    for (const listing of listings()) {
      expect(getLeadsForProperty(listing.propertyId).length).toBeGreaterThan(0);
    }
  });

  it("keeps the non-seller contacts — the filter is narrow", () => {
    const listing = listings()[0];
    const linked = getContactsForProperty(listing.propertyId);
    const leads = getLeadsForProperty(listing.propertyId);
    expect(leads.length).toBe(linked.length - listing.sellerContactIds.length);
  });

  it("keeps the seller off the client report they receive", () => {
    for (const listing of listings()) {
      const property = useDataStore.getState().properties.get(listing.propertyId)!;
      const reportIds = new Set(getClientReportLeads(property).map((l) => l.id));
      for (const sellerId of listing.sellerContactIds) {
        expect(reportIds.has(sellerId)).toBe(false);
      }
    }
  });
});

/**
 * Deal → Leads tab → contact → Deals section has to land back on the deal you
 * started from. Without this the trail dead-ends: a lead's record showed no
 * deals at all, because they aren't a named party to any of them.
 */
describe("a lead's deals close the loop back to the deal", () => {
  const listings = () => [...useDataStore.getState().listings.values()];

  it("shows every deal whose Leads tab lists the contact", () => {
    for (const listing of listings()) {
      for (const lead of getLeadsForProperty(listing.propertyId)) {
        const reachable = new Set([
          ...listDealsForContact(lead.id).map((l) => l.id),
          ...listLeadDealsForContact(lead.id).map((l) => l.id),
        ]);
        expect(reachable.has(listing.id)).toBe(true);
      }
    }
  });

  it("never double-counts a deal the contact is already a party to", () => {
    for (const contact of useDataStore.getState().contacts.values()) {
      const partyIds = new Set(listDealsForContact(contact.id).map((l) => l.id));
      for (const l of listLeadDealsForContact(contact.id)) {
        expect(partyIds.has(l.id)).toBe(false);
      }
    }
  });

  it("never lists a deal the contact is the seller on as a lead deal", () => {
    for (const contact of useDataStore.getState().contacts.values()) {
      for (const l of listLeadDealsForContact(contact.id)) {
        expect(l.sellerContactIds).not.toContain(contact.id);
      }
    }
  });

  it("leaves the contact detail's party deals untouched", () => {
    const contact = [...useDataStore.getState().contacts.values()].find(
      (c) => listLeadDealsForContact(c.id).length > 0,
    )!;
    const detail = getContactDetailClient(contact.id)!;
    expect(detail.deals.map((d) => d.id)).toEqual(
      listDealsForContact(contact.id).map((l) => l.id),
    );
    expect(detail.leadDeals.length).toBeGreaterThan(0);
  });
});
