import { describe, expect, it } from "vitest";
import {
  assigneeFor,
  resolveContactOwnership,
  viewerOwns,
} from "#/data/contactOwnership";
import { SEED_ROSTER, withOverride, withRoles } from "#/data/roster";
import {
  DEFAULT_CONTACT_ACCESS_SETTINGS,
  OWN_CONTACTS,
  PRIVATE_CONTACTS,
  type ContactAccessSettings,
} from "#/data/contactAccess";

const COMPANY = "Buse Built Investments";
const MODEL_B = DEFAULT_CONTACT_ACCESS_SETTINGS;
const MODEL_A: ContactAccessSettings = { ...MODEL_B, brokersCanOwnContacts: false };
const TRANSPARENT: ContactAccessSettings = { ...MODEL_B, ownedContactsCanBePrivate: false };
const PER_PERSON: ContactAccessSettings = {
  ...MODEL_B,
  ownDefault: "granted",
  privateDefault: "granted",
};

/** Ethan as a Broker — the "Viewing as Broker" seat. */
const ETHAN_BROKER = withRoles(SEED_ROSTER, "you", ["broker"]);

describe("assigneeFor", () => {
  it("resolves a roster member's full name", () => {
    expect(assigneeFor({ assignedTo: "Sarah Chen" }, SEED_ROSTER)?.id).toBe("sarah-chen");
  });

  it("resolves the creation stamp 'You' to the signed-in user", () => {
    expect(assigneeFor({ assignedTo: "You" }, SEED_ROSTER)?.id).toBe("you");
  });

  it("resolves an unknown name to nobody", () => {
    expect(assigneeFor({ assignedTo: "J. Whitfield" }, SEED_ROSTER)).toBeUndefined();
  });
});

describe("resolveContactOwnership", () => {
  const sarahs = { assignedTo: "Sarah Chen", isPrivate: true };

  it("Model A: the company owns it and the assignee works it", () => {
    const r = resolveContactOwnership(sarahs, SEED_ROSTER, MODEL_A, COMPANY);
    expect(r.owner).toEqual({ kind: "company", name: COMPANY });
    expect(r.assignee?.id).toBe("sarah-chen");
    expect(r).toMatchObject({ canMarkPrivate: false, isPrivate: false });
  });

  it("Model B: a Broker assignee owns it and may mark it private", () => {
    const r = resolveContactOwnership(sarahs, SEED_ROSTER, MODEL_B, COMPANY);
    expect(r.owner).toMatchObject({ kind: "person", user: { id: "sarah-chen" } });
    expect(r).toMatchObject({ canMarkPrivate: true, isPrivate: true });
  });

  it("own-but-transparent: owned, but the private flag has no effect", () => {
    const r = resolveContactOwnership(sarahs, SEED_ROSTER, TRANSPARENT, COMPANY);
    expect(r.owner.kind).toBe("person");
    expect(r).toMatchObject({ canMarkPrivate: false, isPrivate: false });
  });

  it("Ethan owns his contacts in the default Managing Director seat", () => {
    // MDs carry Own Contacts by default (unlike Own Listings), so the signed-in
    // user sees the lock on arrival without switching seats.
    const r = resolveContactOwnership(
      { assignedTo: "Ethan Thompson" },
      SEED_ROSTER,
      MODEL_B,
      COMPANY,
    );
    expect(r.owner).toMatchObject({ kind: "person", user: { id: "you" } });
    expect(viewerOwns(r)).toBe(true);
    expect(r.canMarkPrivate).toBe(true);
  });

  it("…and still owns them viewing as a Broker", () => {
    const r = resolveContactOwnership(
      { assignedTo: "Ethan Thompson" },
      ETHAN_BROKER,
      MODEL_B,
      COMPANY,
    );
    expect(r.owner).toMatchObject({ kind: "person", user: { id: "you" } });
    expect(viewerOwns(r)).toBe(true);
  });

  it("a sharing-only assignee never owns, so the company does", () => {
    // Riley Park is an Office Admin — a role with no book of its own.
    const r = resolveContactOwnership(
      { assignedTo: "Riley Park" },
      SEED_ROSTER,
      MODEL_B,
      COMPANY,
    );
    expect(r.owner.kind).toBe("company");
    expect(r.assignee?.id).toBe("riley-park");
    expect(viewerOwns(r)).toBe(false);
  });

  it("per-person defaults: a Broker's contacts are company-owned until granted (Summit)", () => {
    const before = resolveContactOwnership(sarahs, SEED_ROSTER, PER_PERSON, COMPANY);
    expect(before.owner.kind).toBe("company");

    let granted = withOverride(SEED_ROSTER, "sarah-chen", OWN_CONTACTS, true);
    const ownedNotPrivate = resolveContactOwnership(sarahs, granted, PER_PERSON, COMPANY);
    expect(ownedNotPrivate.owner.kind).toBe("person");
    expect(ownedNotPrivate).toMatchObject({ canMarkPrivate: false, isPrivate: false });

    granted = withOverride(granted, "sarah-chen", PRIVATE_CONTACTS, true);
    const bob = resolveContactOwnership(sarahs, granted, PER_PERSON, COMPANY);
    expect(bob).toMatchObject({ canMarkPrivate: true, isPrivate: true });
  });

  it("an unresolvable assignee reads as company-owned with no roster row", () => {
    const r = resolveContactOwnership(
      { assignedTo: "J. Whitfield" },
      SEED_ROSTER,
      MODEL_B,
      COMPANY,
    );
    expect(r.assignee).toBeUndefined();
    expect(r.owner.kind).toBe("company");
  });
});
