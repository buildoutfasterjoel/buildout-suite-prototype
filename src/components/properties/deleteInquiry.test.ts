import { describe, expect, it, beforeEach } from "vitest";
import type { Contact, Listing } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { deleteInquiry } from "#/data/actions";

/**
 * Two listings on property P, one on property Q — enough to prove the property
 * link is dropped only when no inquiry on *that* property survives.
 */
const LISTINGS = new Map<string, Listing>([
  ["L1", { id: "L1", propertyId: "P" } as Listing],
  ["L2", { id: "L2", propertyId: "P" } as Listing],
  ["L9", { id: "L9", propertyId: "Q" } as Listing],
]);

function seedContact(patch: Partial<Contact>): Contact {
  return {
    id: "c1",
    firstName: "Dana",
    lastName: "Reyes",
    propertyIds: ["P"],
    inquiredListingIds: ["L1"],
    inquiries: 1,
    ...patch,
  } as Contact;
}

function install(contact: Contact) {
  useDataStore.setState({
    contacts: new Map([[contact.id, contact]]),
    listings: LISTINGS,
  } as never);
}

const read = () => useDataStore.getState().contacts.get("c1")!;

describe("deleteInquiry", () => {
  beforeEach(() => {
    useDataStore.setState({ persist: () => {} } as never);
  });

  it("drops the inquiry and its stored edits", () => {
    install(
      seedContact({
        inquiryDetails: { L1: { accessLevel: "High" }, L9: { status: "New" } },
        inquiredListingIds: ["L1", "L9"],
        inquiries: 2,
      }),
    );
    deleteInquiry("c1", "L1");
    const c = read();
    expect(c.inquiredListingIds).toEqual(["L9"]);
    expect(c.inquiries).toBe(1);
    expect(c.inquiryDetails?.L1).toBeUndefined();
    // An edit on another deal is untouched.
    expect(c.inquiryDetails?.L9).toEqual({ status: "New" });
  });

  it("removes the property link when no inquiry on it survives", () => {
    // Otherwise the contact is still on the property's roster through
    // `getContactsForProperty`, and the row the broker just deleted stays put.
    install(seedContact({ inquiredListingIds: ["L1"], inquiries: 1 }));
    deleteInquiry("c1", "L1");
    expect(read().propertyIds).toEqual([]);
  });

  it("keeps the property link while another inquiry on it remains", () => {
    // Losing one suite must not sweep them off the building or the other suite.
    install(
      seedContact({ inquiredListingIds: ["L1", "L2"], inquiries: 2 }),
    );
    deleteInquiry("c1", "L1");
    const c = read();
    expect(c.inquiredListingIds).toEqual(["L2"]);
    expect(c.propertyIds).toEqual(["P"]);
  });

  it("leaves an unrelated property's link alone", () => {
    install(
      seedContact({
        propertyIds: ["P", "Q"],
        inquiredListingIds: ["L1", "L9"],
        inquiries: 2,
      }),
    );
    deleteInquiry("c1", "L1");
    expect(read().propertyIds).toEqual(["Q"]);
  });

  it("is a no-op for a contact that isn't there", () => {
    install(seedContact({}));
    expect(() => deleteInquiry("nobody", "L1")).not.toThrow();
    expect(read().inquiredListingIds).toEqual(["L1"]);
  });
});
