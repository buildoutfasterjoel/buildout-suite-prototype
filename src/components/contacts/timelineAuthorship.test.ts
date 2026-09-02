import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import type { Contact, DealSummary } from "#/data/types";
import { TEAMMATES, type ContactShare } from "#/data/teammates";
import { buildContactTimeline } from "#/components/contacts/timelineArcs";
import { workingSetFor } from "#/components/contacts/timelineKit";

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

function contactFor(assignedTo: string, over: Partial<Contact> = {}): Contact {
  return {
    id: "c-auth-1",
    firstName: "Andreane",
    lastName: "Daugherty",
    email: "andreane@example.com",
    phone: "(555) 555-0100",
    company: "Weber LLC",
    role: "owner",
    propertyIds: [],
    assignedTo,
    source: "Cold outreach",
    relationship: "nurturing",
    side: null,
    dealStage: null,
    inquiries: 0,
    phoneStatus: "valid",
    doNotCall: false,
    title: "Owner",
    createdAt: daysAgo(200),
    lastTouch: "Logged a call",
    lastContactedAt: daysAgo(10),
    openTaskCount: 0,
    street: "1 Main St",
    city: "Charleston",
    state: "SC",
    zip: "29401",
    tags: [],
    ...over,
  };
}

const deal: DealSummary = {
  id: "l-auth-1",
  propertyId: "p-auth-1",
  name: "Weber Plaza",
  city: "Charleston",
  state: "SC",
  status: "active",
  dealType: "Sale",
  planTotal: 10,
  planDone: 4,
  leadName: "Sarah Chen",
};

const marcus = TEAMMATES.find((t) => t.id === "marcus-patel")!;
const nina = TEAMMATES.find((t) => t.id === "nina-alvarez")!;

/** Outbound, user-authored rows — the ones a broker wrote. */
const authored = (c: Contact, shares: ContactShare[] = []) =>
  buildContactTimeline(c, [deal], shares).filter(
    (e) => e.source === "user" && e.direction !== "in",
  );

describe("timeline authorship follows who works the record", () => {
  it("an unshared contact's history is written entirely by its assignee", () => {
    const rows = authored(contactFor("Sarah Chen"));
    expect(rows.length).toBeGreaterThan(3);
    expect(new Set(rows.map((r) => r.actor.name))).toEqual(new Set(["Sarah Chen"]));
    // With the roster face, not a bare name.
    expect(rows[0].actor.avatarUrl).toBeTruthy();
  });

  it("inbound rows are addressed to the assignee", () => {
    // Client arcs carry the inbound beats (a reply, an inquiry); nurturing ones don't.
    const inbound = buildContactTimeline(
      contactFor("Sarah Chen", { relationship: "client", dealStage: "active", side: "seller" }),
      [deal],
    ).filter((e) => e.direction === "in");
    expect(inbound.length).toBeGreaterThan(0);
    for (const e of inbound) expect(e.contact?.name).toBe("Sarah Chen");
  });

  it("emails sign off in the assignee's first name", () => {
    const emails = buildContactTimeline(
      contactFor("Sarah Chen", { relationship: "client", dealStage: "active", side: "seller" }),
      [deal],
    ).filter((e) => e.type === "email" && e.body);
    expect(emails.length).toBeGreaterThan(0);
    // Not every email is signed (some end on a sentence), but every signed one
    // is signed by Sarah, and none by the signed-in user.
    expect(emails.some((e) => e.body!.trimEnd().endsWith("\n\nSarah"))).toBe(true);
    for (const e of emails) expect(e.body).not.toContain("Ethan");
  });

  it("a Contributor shared in writes some notes but never emails or calls", () => {
    const shares: ContactShare[] = [{ member: marcus, tier: "contributor" }];
    const rows = authored(contactFor("Sarah Chen"), shares);
    const byMarcus = rows.filter((r) => r.actor.name === marcus.name);
    expect(byMarcus.length).toBeGreaterThan(0);
    for (const r of byMarcus) expect(["note", "meeting", "tour"]).toContain(r.type);
    expect(rows.some((r) => r.actor.name === "Sarah Chen")).toBe(true);
  });

  it("an Outreach collaborator may log calls as well", () => {
    const shares: ContactShare[] = [{ member: nina, tier: "outreach" }];
    // A long, call-heavy arc so the collaborator's share includes a call.
    const rows = authored(
      contactFor("Sarah Chen", { relationship: "client", dealStage: "active", side: "buyer", createdAt: daysAgo(400) }),
      shares,
    );
    const byNina = rows.filter((r) => r.actor.name === nina.name);
    expect(byNina.length).toBeGreaterThan(0);
    expect(byNina.some((r) => r.type === "call")).toBe(true);
    expect(byNina.every((r) => r.type !== "email")).toBe(true);
  });

  it("a View-only share reads but never writes", () => {
    const shares: ContactShare[] = [{ member: marcus, tier: "view" }];
    const rows = authored(contactFor("Sarah Chen"), shares);
    expect(rows.some((r) => r.actor.name === marcus.name)).toBe(false);
  });

  it("ignores a share that names the assignee themselves", () => {
    const sarah = TEAMMATES.find((t) => t.id === "sarah-chen")!;
    const set = workingSetFor(contactFor("Sarah Chen"), [{ member: sarah, tier: "outreach" }]);
    expect(set.collaborators).toEqual([]);
  });

  it("the creation stamp 'You' resolves to the signed-in user", () => {
    const rows = authored(contactFor("You"));
    expect(new Set(rows.map((r) => r.actor.name))).toEqual(new Set(["Ethan Thompson"]));
  });
});

describe("history survives a hand-off", () => {
  it("stays authored by whoever worked the record before it changed hands", () => {
    const rows = authored(
      contactFor("Marcus Patel", { historyAuthoredBy: "Sarah Chen" }),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.actor.name))).toEqual(new Set(["Sarah Chen"]));
  });
});
