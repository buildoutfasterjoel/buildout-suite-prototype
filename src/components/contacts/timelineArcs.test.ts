import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import type { Contact, DealSummary, RelationshipStage } from "#/data/types";
import { generateDataset } from "#/data/seed";
import { useDataStore } from "#/data/dataStore";
import { hiddenMessageCount } from "./timeline";
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

  it("inquired leads show the inquiry and nothing we've done since", () => {
    const t = types(
      fakeContact({
        relationship: "inquired",
        source: "Listing inquiry",
        lastContactedAt: null,
        inquiries: 1,
      }),
    );
    expect(t.has("created")).toBe(true);
    // The routing row is what an inbound lead gets instead of a first touch.
    expect(t.has("assignment")).toBe(true);
    for (const personal of ["call", "email", "note", "meeting", "tour"] as const) {
      expect(t.has(personal)).toBe(false);
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

  it.each([
    "cold",
    "inquired",
    "nurturing",
    "pitching",
    "client",
    "past_client",
  ] as RelationshipStage[])(
    "%s: no event predates creation or postdates now",
    (relationship) => {
      const dealless =
        relationship === "cold" ||
        relationship === "inquired" ||
        relationship === "nurturing";
      const c = fakeContact({
        relationship,
        side: dealless ? null : "seller",
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

describe("listing inquiries as timeline rows", () => {
  /** Put one real listing in the store — inquiry rows resolve names from it. */
  function withListing(): { id: string; name: string } {
    const ds = generateDataset();
    useDataStore.setState({
      properties: new Map(ds.properties.map((p) => [p.id, p])),
      listings: new Map(ds.listings.map((l) => [l.id, l])),
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    } as never);
    const l = ds.listings[0];
    return { id: l.id, name: l.name };
  }

  it("emits one inquiry row per inquired listing, linked to that listing", () => {
    const listing = withListing();
    const events = buildContactTimeline(
      fakeContact({ inquiries: 1, inquiredListingIds: [listing.id] }),
      [],
    );
    const inquiries = events.filter((e) => e.type === "inquiry");
    expect(inquiries).toHaveLength(1);
    // The channel is drawn from a pool, so only the stable part is pinned here.
    expect(inquiries[0].title).toContain(`Inquired about ${listing.name} via `);
    // The link the timeline renders through to the deal.
    expect(inquiries[0].associations?.[0]?.id).toBe(listing.id);
    expect(inquiries[0].direction).toBe("in");
    expect(needsAttention(inquiries[0])).toBe(true);
  });

  it("skips listings the arc already opened on, so no row shows twice", () => {
    const listing = withListing();
    // A buy-side pitching arc authors its own inquiry about `deals[0]`.
    const deal: DealSummary = { ...fakeDeal, id: listing.id, name: listing.name };
    const events = buildContactTimeline(
      fakeContact({
        relationship: "pitching",
        side: "buyer",
        dealStage: "pitching",
        inquiries: 1,
        inquiredListingIds: [listing.id],
      }),
      [deal],
    );
    expect(events.filter((e) => e.type === "inquiry")).toHaveLength(1);
  });

  it("shows the contact's own words and channel when the record carries them", () => {
    const listing = withListing();
    const events = buildContactTimeline(
      fakeContact({
        inquiries: 1,
        inquiredListingIds: [listing.id],
        inquiryDetails: {
          [listing.id]: { message: "Send the T-12.", channel: "LoopNet" },
        },
      }),
      [],
    );
    const inquiry = events.find((e) => e.type === "inquiry")!;
    expect(inquiry.body).toBe("Send the T-12.");
    // The record's own channel, folded into the headline.
    expect(inquiry.title).toBe(`Inquired about ${listing.name} via LoopNet`);
  });

  it("falls back to synthesized copy for inquiries the record doesn't detail", () => {
    const ds = generateDataset();
    useDataStore.setState({
      properties: new Map(ds.properties.map((p) => [p.id, p])),
      listings: new Map(ds.listings.map((l) => [l.id, l])),
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    } as never);
    const [a, b] = ds.listings.slice(0, 2).map((l) => l.id);
    const events = buildContactTimeline(
      fakeContact({
        inquiries: 2,
        inquiredListingIds: [a, b],
        // Only the first is detailed.
        inquiryDetails: { [a]: { message: "Mine.", channel: "Crexi" } },
      }),
      [],
    );
    const rows = events.filter((e) => e.type === "inquiry");
    expect(rows).toHaveLength(2);
    expect(rows[0].body).toBe("Mine.");
    expect(rows[1].body).not.toBe("Mine.");
    expect(rows[1].body).toBeTruthy();
  });

  it("gives a contact's own inquiries distinct copy — two identical rows read as a bug", () => {
    const ds = generateDataset();
    useDataStore.setState({
      properties: new Map(ds.properties.map((p) => [p.id, p])),
      listings: new Map(ds.listings.map((l) => [l.id, l])),
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    } as never);
    const ids = ds.listings.slice(0, 3).map((l) => l.id);
    // Every contact id, so no single PRNG seed can hide a collision.
    for (const id of ["c-1", "c-2", "c-3", "c-4", "c-5", "c-6", "c-7"]) {
      const rows = buildContactTimeline(
        fakeContact({ id, inquiries: 3, inquiredListingIds: ids }),
        [],
      ).filter((e) => e.type === "inquiry");
      expect(rows).toHaveLength(3);
      expect(new Set(rows.map((r) => r.body)).size).toBe(3);
      // The channel now lives at the tail of the headline.
      expect(new Set(rows.map((r) => r.title?.split(" via ").pop())).size).toBe(3);
    }
  });

  it("ignores inquiries pointing at a listing that no longer exists", () => {
    withListing();
    const events = buildContactTimeline(
      fakeContact({ inquiries: 1, inquiredListingIds: ["gone-listing"] }),
      [],
    );
    expect(events.some((e) => e.type === "inquiry")).toBe(false);
  });

  it("pins a just-added lead's inquiry to the moment they came in, above the created row", () => {
    const listing = withListing();
    const createdAt = new Date().toISOString();
    const c = fakeContact({
      createdAt,
      lastContactedAt: null,
      inquiries: 1,
      inquiredListingIds: [listing.id],
    });
    const events = buildContactTimeline(c, []);
    const inquiry = events.find((e) => e.type === "inquiry")!;
    const created = events.find((e) => e.type === "created")!;
    expect(inquiry.timestamp).toBe(createdAt);
    // Same instant — the newer `seq` is what floats the inquiry to the top.
    expect(inquiry.seq).toBeGreaterThan(created.seq);
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

  // Victor's offer-strategy thread is the app's reference example of a deep
  // email thread, so its shape is pinned: a shallow two-message thread here
  // would quietly remove the only place the component gets exercised properly.
  it("gives Victor a deep, multi-turn email thread", () => {
    const victor = heroes.get("victor")!;
    const events = buildContactTimeline(victor, []);
    const convo = events.find((e) => e.type === "conversation")!;
    const thread = convo.thread!;

    expect(thread.messages.length).toBeGreaterThanOrEqual(5);
    // The latest message is the row's own content, so the toggle opens everything
    // behind it — one fewer than the thread holds.
    expect(hiddenMessageCount(thread)).toBe(thread.messages.length - 1);
    // And the preview has to be that latest message, not an arbitrary one.
    expect(thread.latestBody).toBe(thread.messages.at(-1)!.body);

    // Both directions, and at least one same-sender pair — the two shapes a
    // two-message thread can't produce.
    const dirs = thread.messages.map((m) => m.direction);
    expect(new Set(dirs).size).toBe(2);
    expect(dirs.some((d, i) => i > 0 && d === dirs[i - 1])).toBe(true);

    // Oldest first, and the preview reflects the newest message.
    const times = thread.messages.map((m) => new Date(m.timestamp).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    const newest = thread.messages.at(-1)!;
    expect(thread.latestBody).toBe(newest.body);
    expect(thread.latestSender).toBe(newest.sender);
    // Ends inbound, which is what holds the row in "awaiting a reply".
    expect(newest.direction).toBe("in");
    expect(needsAttention(convo)).toBe(true);

    // Every message also exists as its own row, so per-message filters and the
    // expanded thread agree.
    const members = events.filter(
      (e) => e.threadId === convo.threadId && e.type !== "conversation",
    );
    expect(members.map((e) => e.messageId).sort()).toEqual(
      thread.messages.map((m) => m.id).sort(),
    );
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

  it("keeps every progressed deal gate-coherent: counterparty linked, no double-casting", () => {
    // Mirrors the stage-gate counterparty requirement (stageGates.ts): a deal
    // can't reach Under Contract / Closed without the other side linked. Which
    // side that is depends on the deal — a sale gates on `buyerLinked`, a lease
    // on `tenantLinked`, and `tenantContactIds` is a dedicated dataset rather
    // than a rename of `buyerContactIds` (see the Listing type).
    for (const l of listings) {
      if (l.status === "under-contract" || l.status === "closed") {
        expect(
          l.buyerContactIds.length + l.tenantContactIds.length,
          `${l.name} [${l.status}] has no counterparty`,
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

describe("the record's own beginning", () => {
  /**
   * Whole-dataset scan: "Contact created" must be the oldest row on every
   * contact's feed. It stopped being that for 16 of the 80 seeded contacts —
   * `createdAt` was drawn from the last year while `lastContactedAt` reached back
   * two, so the arc (anchored on the touch) ran entirely before the record
   * existed and "Contact created" sorted to the top of the feed as the newest
   * thing that had happened. Both halves are guarded here rather than only the
   * seed, because a beat's date can also come from an absolute offset or the
   * clock's minimum-spread floor.
   */
  it("is the oldest row on every seeded contact's timeline", () => {
    const ds = generateDataset();
    useDataStore.setState({
      properties: new Map(ds.properties.map((p) => [p.id, p])),
      listings: new Map(ds.listings.map((l) => [l.id, l])),
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    } as never);

    const offenders: string[] = [];
    for (const c of ds.contacts) {
      const deals = ds.listings.filter(
        (l) =>
          l.sellerContactIds.includes(c.id) ||
          l.buyerContactIds.includes(c.id) ||
          l.otherContactIds.includes(c.id),
      );
      const events = buildContactTimeline(c, deals as never);
      const created = events.find((e) => e.type === "created");
      expect(created, `${c.firstName} ${c.lastName} has no created row`).toBeDefined();
      const earlier = events.filter(
        (e) =>
          e !== created &&
          Date.parse(e.timestamp) < Date.parse(created!.timestamp),
      );
      if (earlier.length > 0) {
        offenders.push(
          `${c.firstName} ${c.lastName} (${c.relationship}): ${earlier.length} rows before creation, oldest ${earlier[0].type}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never predates the last touch or an inquiry the seed recorded", () => {
    const { contacts } = generateDataset();
    for (const c of contacts) {
      if (c.lastContactedAt) {
        expect(
          c.createdAt <= c.lastContactedAt,
          `${c.firstName} ${c.lastName} was created after we last spoke to them`,
        ).toBe(true);
      }
      for (const [listingId, d] of Object.entries(c.inquiryDetails ?? {})) {
        if (!d.date) continue;
        expect(
          c.createdAt <= d.date,
          `${c.firstName} ${c.lastName} inquired on ${listingId} before the record existed`,
        ).toBe(true);
      }
    }
  });
});
