import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createTask } from "#/data/actions";
import { addDealActivity } from "#/data/store";
import {
  hasInbound,
  ownedPropertiesFor,
  searchTasks,
  loadTask,
  searchActivities,
  loadActivity,
  contactActivity,
  dealActivity,
  listAttachments,
  searchVouchers,
  loadVoucher,
  searchResearchProperties,
  loadResearchProperty,
  pipelineTotals,
} from "./recordQueries";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

/** The first seeded deal — every record test needs one to hang off. */
function firstDeal() {
  return [...useDataStore.getState().listings.values()][0];
}

describe("searchTasks", () => {
  it("splits open from complete", () => {
    const open = searchTasks({ status: "open", limit: 500 });
    const done = searchTasks({ status: "complete", limit: 500 });
    expect(open.tasks.every((t) => !t.completed)).toBe(true);
    expect(done.tasks.every((t) => t.completed)).toBe(true);
    expect(open.total + done.total).toBe(searchTasks({ limit: 500 }).total);
  });

  it("finds a task the assistant just created, by title", () => {
    createTask({ name: "Chase the estoppel", dueDate: "2026-09-01", createdByAi: true });
    const { tasks } = searchTasks({ query: "estoppel" });
    expect(tasks.map((t) => t.title)).toContain("Chase the estoppel");
  });

  it("scopes a due window to the given day", () => {
    const today = "2026-06-15";
    createTask({ name: "Yesterday's", dueDate: "2026-06-14" });
    createTask({ name: "Today's", dueDate: today });
    createTask({ name: "In three days", dueDate: "2026-06-18" });
    createTask({ name: "Next month", dueDate: "2026-07-20" });

    const titles = (due: "overdue" | "today" | "week") =>
      searchTasks({ due, limit: 500 }, today).tasks.map((t) => t.title);

    expect(titles("overdue")).toContain("Yesterday's");
    expect(titles("overdue")).not.toContain("Today's");
    expect(titles("today")).toContain("Today's");
    expect(titles("today")).not.toContain("In three days");
    // The week window is today through seven days out, so it takes today's and
    // the one three days out but not next month's.
    expect(titles("week")).toEqual(expect.arrayContaining(["Today's", "In three days"]));
    expect(titles("week")).not.toContain("Next month");
    expect(titles("week")).not.toContain("Yesterday's");
  });

  it("never counts a completed task as overdue", () => {
    const today = "2026-06-15";
    const { task } = createTask({ name: "Long done", dueDate: "2026-01-02" });
    useDataStore.setState((s) => {
      const tasks = new Map(s.tasks);
      tasks.set(task.id, { ...task, status: "complete" });
      return { tasks };
    });
    expect(
      searchTasks({ due: "overdue", limit: 500 }, today).tasks.map((t) => t.id),
    ).not.toContain(task.id);
  });

  it("returns unscheduled tasks only under the unscheduled window", () => {
    const { task } = createTask({ name: "Someday", dueDate: null });
    const ids = (due: "unscheduled" | "week") =>
      searchTasks({ due, limit: 500 }, "2026-06-15").tasks.map((t) => t.id);
    expect(ids("unscheduled")).toContain(task.id);
    expect(ids("week")).not.toContain(task.id);
  });

  it("loads a task by id and returns null for an unknown one", () => {
    const { task } = createTask({ name: "Send the LOI" });
    expect(loadTask(task.id)?.title).toBe("Send the LOI");
    expect(loadTask("nope")).toBeNull();
  });
});

describe("ownedPropertiesFor", () => {
  /**
   * The reported bug: "make a deal for Rosa" → "she has no property on file",
   * while the contact page next to it showed a Properties panel with her
   * building in it. The panel reads `ownedPropertyIds`; the assistant read
   * neither that nor the properties behind her deals.
   */
  it("finds the building a contact owns outright, with no deal on it", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find(
      (c) => c.firstName === "Rosa" && c.lastName === "Delgado",
    );
    expect(rosa).toBeDefined();
    const owned = ownedPropertiesFor(rosa!);
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.some((p) => /delgado/i.test(p.name))).toBe(true);
  });

  it("unions stamped ownership with the properties behind their deals", () => {
    const store = useDataStore.getState();
    const listedAsSeller = (id: string) =>
      [...store.listings.values()].some((l) => l.sellerContactIds.includes(id));
    const withDeal = [...store.contacts.values()].find((c) => listedAsSeller(c.id));
    expect(withDeal).toBeDefined();
    const owned = ownedPropertiesFor(withDeal!);
    const dealProps = [...store.listings.values()]
      .filter((l) => l.sellerContactIds.includes(withDeal!.id))
      .map((l) => l.propertyId);
    for (const pid of dealProps) {
      expect(owned.map((p) => p.id)).toContain(pid);
    }
  });

  it("returns nothing for a contact who owns nothing and has no deals", () => {
    const store = useDataStore.getState();
    const bare = [...store.contacts.values()].find(
      (c) =>
        (c.ownedPropertyIds?.length ?? 0) === 0 &&
        ![...store.listings.values()].some(
          (l) =>
            l.sellerContactIds.includes(c.id) ||
            l.buyerContactIds.includes(c.id) ||
            l.otherContactIds.includes(c.id),
        ),
    );
    if (!bare) return;
    expect(ownedPropertiesFor(bare)).toEqual([]);
  });
});

describe("activity reads", () => {
  it("reads a deal's activity newest first", () => {
    const deal = firstDeal();
    addDealActivity(deal.id, { type: "note", note: "First", actor: "Broker" });
    addDealActivity(deal.id, { type: "call", note: "Second", actor: "Broker" });
    const rows = dealActivity(deal.id);
    expect(rows[0].body).toBe("Second");
    expect(rows[0].parentKind).toBe("deal");
    expect(rows[0].parentName).toBe(deal.name);
  });

  it("filters a deal's activity by type", () => {
    const deal = firstDeal();
    addDealActivity(deal.id, { type: "note", note: "A note", actor: "Broker" });
    addDealActivity(deal.id, { type: "call", note: "A call", actor: "Broker" });
    const { activities } = searchActivities({ dealId: deal.id, type: "call" });
    expect(activities.map((a) => a.body)).toEqual(["A call"]);
  });

  it("returns nothing when neither a contact nor a deal is scoped", () => {
    expect(searchActivities({}).total).toBe(0);
  });

  it("builds a contact's activity from their timeline", () => {
    // A `pitching` contact has a hand-authored arc, so their feed is never empty
    // — a cold contact's legitimately is (an empty timeline IS the cold story).
    const contact = [...useDataStore.getState().contacts.values()].find(
      (c) => c.relationship === "pitching",
    );
    if (!contact) return;
    const rows = contactActivity(contact.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].parentKind).toBe("contact");
    // Newest first.
    expect(rows[0].timestamp >= rows[rows.length - 1].timestamp).toBe(true);
  });

  /**
   * The reported bug: asked to read Rosa's latest email, the assistant said it
   * saw nothing from her. Her reply is stored INSIDE the outbound email it
   * answers, and the row handed to the model carried only the outbound body —
   * so the assistant was reporting a payload that was missing half the exchange.
   */
  it("carries a nested reply through to the row", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find(
      (c) => c.firstName === "Rosa" && c.lastName === "Delgado",
    );
    // Asserted, not guarded: a skipped regression test is worse than none.
    expect(rosa).toBeDefined();
    const withReply = contactActivity(rosa!.id).filter((a) => a.reply);
    expect(withReply.length).toBeGreaterThan(0);

    const email = withReply.find((a) => a.type === "email");
    expect(email).toBeDefined();
    // The row is outbound, and her words are still on it.
    expect(email!.direction).toBe("out");
    expect(email!.reply!.body).toContain("Miguel would have framed it");
    expect(email!.reply!.from).toBeTruthy();
  });

  it("counts an answered outbound email as something from the contact", () => {
    const rosa = [...useDataStore.getState().contacts.values()].find(
      (c) => c.firstName === "Rosa" && c.lastName === "Delgado",
    );
    expect(rosa).toBeDefined();
    const answered = contactActivity(rosa!.id).find((a) => a.direction === "out" && a.reply);
    expect(answered).toBeDefined();
    expect(hasInbound(answered!)).toBe(true);

    // ...and the `in` filter must return it, or "read her last email" finds nothing.
    const inbound = searchActivities({ contactId: rosa!.id, direction: "in", limit: 100 });
    expect(inbound.activities.map((a) => a.id)).toContain(answered!.id);
  });

  it("does not report an outbound-only message as inbound", () => {
    const outboundOnly: Parameters<typeof hasInbound>[0] = {
      id: "x",
      type: "email",
      timestamp: "2026-07-04T12:51:00.000Z",
      actor: "Ethan Thompson",
      direction: "out",
      parentKind: "contact",
      parentId: "c1",
      parentName: "Rosa Delgado",
      title: "The piece on your block I mentioned",
      body: "No business in this email.",
    };
    expect(hasInbound(outboundOnly)).toBe(false);
  });

  it("loads one activity within its parent record", () => {
    const deal = firstDeal();
    addDealActivity(deal.id, { type: "note", note: "Findable", actor: "Broker" });
    const row = dealActivity(deal.id)[0];
    expect(loadActivity(row.id, { dealId: deal.id })?.body).toBe("Findable");
    expect(loadActivity("missing", { dealId: deal.id })).toBeNull();
  });
});

describe("listAttachments", () => {
  it("flattens a deal's vault and resolves folder paths", () => {
    const deal = firstDeal();
    const items = listAttachments(deal.id);
    if (items.length === 0) return;
    // Nothing at the root claims a folder path; nothing deleted comes back.
    for (const i of items) {
      expect(typeof i.folder).toBe("string");
      expect(i.folder).not.toContain("undefined");
    }
  });

  it("returns an empty list for a deal with no vault", () => {
    expect(listAttachments("no-such-deal")).toEqual([]);
  });
});

describe("vouchers", () => {
  it("filters by status", () => {
    const pending = searchVouchers({ status: "Pending", limit: 500 });
    expect(pending.vouchers.every((v) => v.status === "Pending")).toBe(true);
  });

  it("loads a voucher by its DEAL id", () => {
    const first = searchVouchers({ limit: 1 }).vouchers[0];
    if (!first) return;
    const loaded = loadVoucher(first.dealId);
    expect(loaded?.voucher.dealId).toBe(first.dealId);
    expect(loaded?.deal.id).toBe(first.dealId);
  });

  it("returns null for a deal that has no voucher", () => {
    expect(loadVoucher("not-a-deal")).toBeNull();
  });
});

describe("research properties", () => {
  it("filters Insights records by state and size", () => {
    const all = searchResearchProperties({ limit: 500 });
    expect(all.total).toBeGreaterThan(0);
    const big = searchResearchProperties({ minSqFt: 50_000, limit: 500 });
    expect(big.properties.every((p) => (p.buildingSqFt ?? 0) >= 50_000)).toBe(true);
    expect(big.total).toBeLessThanOrEqual(all.total);
  });

  it("loads a research property that is NOT in the broker's store", () => {
    const p = searchResearchProperties({ limit: 1 }).properties[0];
    expect(loadResearchProperty(p.id)?.id).toBe(p.id);
    // The whole point of a prospect: it isn't yours until you add it.
    expect(useDataStore.getState().properties.has(p.id)).toBe(false);
  });
});

describe("pipelineTotals", () => {
  it("totals every stage and matches the store", () => {
    const totals = pipelineTotals();
    const listings = [...useDataStore.getState().listings.values()];
    const counted = totals.stages.reduce((n, s) => n + s.count, 0);
    expect(counted).toBe(listings.length);
    expect(totals.openDeals).toBe(
      listings.filter((l) => ["proposal", "active", "under-contract"].includes(l.status)).length,
    );
    expect(totals.closedDeals).toBe(listings.filter((l) => l.status === "closed").length);
  });

  it("narrows to one deal type", () => {
    const sale = pipelineTotals("Sale");
    const listings = [...useDataStore.getState().listings.values()];
    expect(sale.stages.reduce((n, s) => n + s.count, 0)).toBe(
      listings.filter((l) => l.dealType === "Sale").length,
    );
  });

  it("values closed deals at their sale price, not their asking price", () => {
    const closed = [...useDataStore.getState().listings.values()].filter(
      (l) => l.status === "closed",
    );
    if (closed.length === 0) return;
    const expected = closed.reduce((n, l) => n + l.transaction.salePrice, 0);
    expect(pipelineTotals().closedValue).toBe(expected);
  });
});
