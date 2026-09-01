import { describe, expect, it, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { useRoster } from "#/components/settings/users/useRoster";
import { SEED_ROSTER, withRoles } from "#/data/roster";
import {
  PRIVATE_CONTACT_LABEL,
  maskContactForText,
  placeholderCode,
  viewContact,
} from "#/components/contacts/contactRights";

/** A private contact of Sarah's the signed-in user isn't shared into. */
function hiddenFromEthan() {
  const s = useDataStore.getState();
  return [...s.contacts.values()].find(
    (c) =>
      c.isPrivate &&
      c.assignedTo === "Sarah Chen" &&
      !(s.contactShares.get(c.id) ?? []).some((sh) => sh.member.id === "you"),
  )!;
}

describe("viewContact / maskContactForText", () => {
  beforeEach(() => {
    useDataStore.setState(seedSlice());
    // The Broker seat: no View Private Contacts, so privacy actually bites.
    useRoster.setState({ users: withRoles(SEED_ROSTER, "you", ["broker"]) });
  });

  it("masks a private contact the viewer has no relationship with", () => {
    const c = hiddenFromEthan();
    expect(c).toBeDefined();
    const v = viewContact(c);
    expect(v.kind).toBe("private");
    if (v.kind !== "private") return;
    expect(v.askName).toBe("Sarah Chen");
    expect(v.code).toBe(placeholderCode(c.id));
    const m = maskContactForText(c);
    expect(m.private).toBe(true);
    expect(m.name.startsWith(PRIVATE_CONTACT_LABEL)).toBe(true);
    expect(m.name).not.toContain(c.firstName);
    expect(m.email).toBe("");
    expect(m.phone).toBe("");
  });

  it("keeps the record whole for its owner", () => {
    const mine = [...useDataStore.getState().contacts.values()].find(
      (c) => c.assignedTo === "Ethan Thompson",
    )!;
    expect(viewContact(mine).kind).toBe("contact");
    expect(maskContactForText(mine).name).toContain(mine.firstName);
  });

  it("lets a Managing Director with View Private Contacts see through", () => {
    useRoster.setState({ users: SEED_ROSTER });
    expect(viewContact(hiddenFromEthan()).kind).toBe("contact");
  });

  it("the placeholder code is stable, short, and not the id", () => {
    const c = hiddenFromEthan();
    const code = placeholderCode(c.id);
    expect(code).toHaveLength(6);
    expect(code).toBe(placeholderCode(c.id));
    expect(c.id).not.toContain(code.toLowerCase());
  });

  it("seeds at least one private party on a visible deal", () => {
    const s = useDataStore.getState();
    const sellerIds = new Set([...s.listings.values()].flatMap((l) => l.sellerContactIds));
    const privateSeller = [...s.contacts.values()].find(
      (c) => c.isPrivate && sellerIds.has(c.id) && c.assignedTo !== "Ethan Thompson",
    );
    expect(privateSeller).toBeDefined();
  });
});
