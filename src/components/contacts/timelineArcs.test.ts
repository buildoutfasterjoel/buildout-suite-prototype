import { describe, expect, it } from "vitest";
import type { Contact, DealSummary, RelationshipStage } from "#/data/types";
import { generateDataset } from "#/data/seed";
import { buildContactTimeline } from "#/components/contacts/timelineArcs";
import {
  needsAttention,
  type TimelineEventType,
} from "#/components/contacts/timeline";

const DAY_MS = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString();

function fakeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: "c-test-1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phone: "(555) 555-0100",
    company: "Analytical Holdings",
    role: "owner",
    propertyIds: [],
    assignedTo: "J. Whitfield",
    source: "Cold outreach",
    relationship: "cold",
    side: null,
    dealStage: null,
    inquiries: 0,
    phoneStatus: "valid",
    doNotCall: false,
    title: "Owner",
    createdAt: daysAgo(120),
    lastTouch: "Logged a cold call",
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

const fakeDeal: DealSummary = {
  id: "l-test-1",
  propertyId: "p-test-1",
  name: "Main Street Retail",
  city: "Charleston",
  state: "SC",
  status: "active",
  dealType: "Sale",
  planTotal: 10,
  planDone: 4,
  leadName: "J. Whitfield",
};

function types(c: Contact, deals: DealSummary[] = []): Set<TimelineEventType> {
  return new Set(buildContactTimeline(c, deals).map((e) => e.type));
}

describe("buildContactTimeline", () => {
  it("is deterministic per contact", () => {
    const c = fakeContact({ relationship: "nurturing" });
    const a = buildContactTimeline(c, [fakeDeal]);
    const b = buildContactTimeline(c, [fakeDeal]);
    expect(a.map((e) => [e.id, e.title, e.body])).toEqual(
      b.map((e) => [e.id, e.title, e.body]),
    );
  });

  it("varies copy between same-stage contacts", () => {
    const feeds = ["c-1", "c-2", "c-3", "c-4", "c-5", "c-6"].map((id) =>
      buildContactTimeline(fakeContact({ id, relationship: "nurturing" }), [])
        .map((e) => e.body ?? e.title)
        .join("|"),
    );
    expect(new Set(feeds).size).toBeGreaterThan(1);
  });

  it("cold contacts have no personal touches — that absence is the story", () => {
    for (const id of ["c-a", "c-b", "c-c", "c-d"]) {
      const t = types(fakeContact({ id, relationship: "cold" }));
      expect(t.has("created")).toBe(true);
      for (const personal of [
        "call",
        "email",
        "note",
        "meeting",
        "tour",
        "conversation",
      ] as const) {
        expect(t.has(personal)).toBe(false);
      }
    }
  });

  it("nurturing contacts get paced touches but no live-deal beats", () => {
    const t = types(fakeContact({ relationship: "nurturing" }));
    expect(t.has("call")).toBe(true);
    expect(t.has("email")).toBe(true);
    expect(t.has("note")).toBe(true);
    expect(t.has("stage-change")).toBe(false);
    expect(t.has("conversation")).toBe(false);
  });

  it("pitching sellers get the pitch flurry; buyers tour instead of meeting", () => {
    const seller = types(
      fakeContact({ relationship: "pitching", side: "seller", dealStage: "pitching" }),
      [fakeDeal],
    );
    expect(seller.has("meeting")).toBe(true);
    expect(seller.has("stage-change")).toBe(true);

    const buyer = types(
      fakeContact({
        relationship: "pitching",
        side: "buyer",
        dealStage: "pitching",
        inquiries: 1,
      }),
      [fakeDeal],
    );
    expect(buyer.has("tour")).toBe(true);
    expect(buyer.has("inquiry")).toBe(true);
  });

  it("active clients carry a live negotiation thread awaiting a reply", () => {
    const t = types(
      fakeContact({ relationship: "client", side: "seller", dealStage: "active" }),
      [fakeDeal],
    );
    expect(t.has("conversation")).toBe(true);
    expect(t.has("inbound-email")).toBe(true);
    expect(t.has("stage-change")).toBe(true);
  });

  it("under-contract clients get diligence beats", () => {
    const events = buildContactTimeline(
      fakeContact({
        relationship: "client",
        side: "buyer",
        dealStage: "under_contract",
      }),
      [fakeDeal],
    );
    expect(
      events.some((e) => e.type === "stage-change" && e.body?.includes("Under contract")),
    ).toBe(true);
    expect(events.some((e) => e.title?.includes("diligence"))).toBe(true);
  });

  it("past clients close the deal and keep the relationship warm", () => {
    const events = buildContactTimeline(
      fakeContact({
        relationship: "past_client",
        side: "seller",
        dealStage: "closed",
      }),
      [fakeDeal],
    );
    expect(
      events.some((e) => e.type === "stage-change" && e.body?.includes("Closed")),
    ).toBe(true);
    expect(events.some((e) => e.title?.includes("Post-close"))).toBe(true);
  });

  it.each(["cold", "nurturing", "pitching", "client", "past_client"] as RelationshipStage[])(
    "%s: no event predates creation or postdates now",
    (relationship) => {
      const c = fakeContact({
        relationship,
        side: relationship === "cold" || relationship === "nurturing" ? null : "seller",
        dealStage:
          relationship === "pitching"
            ? "pitching"
            : relationship === "client"
              ? "active"
              : relationship === "past_client"
                ? "closed"
                : null,
      });
      for (const e of buildContactTimeline(c, [fakeDeal])) {
        const t = new Date(e.timestamp).getTime();
        expect(t).toBeLessThanOrEqual(Date.now() + DAY_MS);
        // The created row is the floor; nothing lands meaningfully before it.
        expect(t).toBeGreaterThanOrEqual(
          new Date(c.createdAt).getTime() - 2 * DAY_MS,
        );
      }
    },
  );

  it("anchors the newest human touch to lastContactedAt", () => {
    const c = fakeContact({
      relationship: "client",
      side: "seller",
      dealStage: "active",
      lastContactedAt: daysAgo(3),
    });
    const newest = buildContactTimeline(c, [fakeDeal])
      .filter((e) => e.source === "user")
      .map((e) => new Date(e.timestamp).getTime())
      .sort((a, b) => b - a)[0];
    const drift = Math.abs(newest - new Date(c.lastContactedAt!).getTime());
    expect(drift).toBeLessThanOrEqual(2 * DAY_MS);
  });
});

describe("hero personas in the seed", () => {
  const { contacts, listings, properties } = generateDataset();
  const heroes = new Map(
    contacts.filter((c) => c.heroKey).map((c) => [c.heroKey!, c]),
  );

  it("pins all five heroes", () => {
    expect([...heroes.keys()].sort()).toEqual(
      ["earl", "margaret", "patricia", "rosa", "victor"].sort(),
    );
  });

  it("names Earl's property and deal 'The Thompson Block', as a Sale", () => {
    const earl = heroes.get("earl")!;
    const deal = listings.find((l) => l.sellerContactIds[0] === earl.id)!;
    expect(deal.name).toContain("The Thompson Block");
    expect(deal.dealType).toBe("Sale");
    expect(properties.find((p) => p.id === deal.propertyId)?.name).toBe(
      "The Thompson Block",
    );
  });

  it.each([
    ["rosa", "nurturing", null, null],
    ["earl", "pitching", "pitching", "seller"],
    ["victor", "client", "active", "seller"],
    ["margaret", "client", "under_contract", "buyer"],
    ["patricia", "past_client", "closed", "seller"],
  ] as const)(
    "%s lands at %s / dealStage %s / side %s after reconciliation",
    (key, relationship, dealStage, side) => {
      const hero = heroes.get(key)!;
      expect(hero.relationship).toBe(relationship);
      expect(hero.dealStage).toBe(dealStage);
      expect(hero.side).toBe(side);
    },
  );

  it("gives every hero a hand-authored arc (no parameterized copy)", () => {
    for (const hero of heroes.values()) {
      const events = buildContactTimeline(hero, []);
      expect(events.length).toBeGreaterThanOrEqual(7);
      // Hand-authored arcs always end on the created row.
      expect(events.at(-1)?.type).toBe("created");
    }
  });

  it("gives every hero at least one recent needs-attention row", () => {
    for (const [key, hero] of heroes) {
      const attention = buildContactTimeline(hero, []).filter(
        (e) =>
          needsAttention(e) &&
          Date.now() - new Date(e.timestamp).getTime() < 7 * DAY_MS,
      );
      expect(
        attention.length,
        `hero ${key} has no recent needs-attention row`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("keeps every listing with at least one seller contact", () => {
    for (const l of listings) {
      expect(l.sellerContactIds.length).toBeGreaterThan(0);
    }
  });

  it("keeps every progressed deal gate-coherent: buyer linked, no double-casting", () => {
    // Mirrors the stage-gate `buyerLinked` requirement (stageGates.ts): a deal
    // can't reach Under Contract / Closed without a buyer on it.
    for (const l of listings) {
      if (l.status === "under-contract" || l.status === "closed") {
        expect(
          l.buyerContactIds.length,
          `${l.name} [${l.status}] has no buyer`,
        ).toBeGreaterThan(0);
      }
      for (const id of l.buyerContactIds) {
        expect(
          l.sellerContactIds.includes(id),
          `${l.name} casts a contact as both buyer and seller`,
        ).toBe(false);
      }
    }
  });

  it("exercises every timeline event type across the seeded book", () => {
    const dealsByContact = new Map<string, DealSummary[]>();
    for (const l of listings) {
      for (const id of [...l.sellerContactIds, ...l.buyerContactIds]) {
        const arr = dealsByContact.get(id) ?? [];
        arr.push({
          id: l.id,
          propertyId: l.propertyId,
          name: l.name,
          city: "",
          state: "",
          status: l.status,
          dealType: l.dealType,
          planTotal: 0,
          planDone: 0,
          leadName: "",
        });
        dealsByContact.set(id, arr);
      }
    }
    const seen = new Set<TimelineEventType>();
    for (const c of contacts) {
      for (const e of buildContactTimeline(c, dealsByContact.get(c.id) ?? [])) {
        seen.add(e.type);
      }
    }
    const expected: TimelineEventType[] = [
      "call",
      "email",
      "inbound-email",
      "conversation",
      "meeting",
      "tour",
      "note",
      "inquiry",
      "marketing",
      "task",
      "created",
      "stage-change",
      "assignment",
      "change-log",
    ];
    for (const t of expected) {
      expect(seen.has(t), `missing event type: ${t}`).toBe(true);
    }
  });
});
