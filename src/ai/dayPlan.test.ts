import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { createContact, createTask, setTaskCompleted } from "#/data/actions";
import { buildDayPlan } from "./dayPlan";

beforeEach(() => {
  useDataStore.setState(seedSlice());
});

/**
 * Clear seeded deals and tasks so each case controls the whole queue. Contacts
 * are cleared too so Rosa's pinned overnight signal doesn't occupy slot one.
 */
function withNoTasks() {
  useDataStore.setState({ tasks: new Map(), listings: new Map(), contacts: new Map() });
}

describe("buildDayPlan", () => {
  it("ranks the most overdue task first, then today's", () => {
    withNoTasks();
    createTask({ name: "Due today", dueDate: "2026-08-12", source: "none" });
    createTask({ name: "Two days late", dueDate: "2026-08-10", source: "none" });
    createTask({ name: "Ten days late", dueDate: "2026-08-02", source: "none" });

    const { items, totalDue } = buildDayPlan("2026-08-12");

    expect(items.map((i) => i.headline)).toEqual(["Ten days late", "Two days late", "Due today"]);
    expect(items[0].daysOverdue).toBe(10);
    expect(items[2].daysOverdue).toBe(0);
    expect(totalDue).toBe(3);
  });

  it("excludes future, unscheduled, and completed tasks", () => {
    withNoTasks();
    createTask({ name: "Future", dueDate: "2026-09-01", source: "none" });
    createTask({ name: "Unscheduled", dueDate: null, source: "none" });
    const { task: done } = createTask({ name: "Done", dueDate: "2026-08-01", source: "none" });
    createTask({ name: "Overdue", dueDate: "2026-08-11", source: "none" });
    setTaskCompleted(done.id, true);

    expect(buildDayPlan("2026-08-12").items.map((i) => i.headline)).toEqual(["Overdue"]);
  });

  it("names the contact in the headline and flags call tasks", () => {
    withNoTasks();
    const { contact } = createContact({
      firstName: "Rosa",
      lastName: "Delgado",
      company: "Delgado Holdings",
    });
    createTask({
      name: "clear due diligence items",
      dueDate: "2026-08-09",
      contactId: contact.id,
      type: "call",
      source: "contact",
    });

    const [item] = buildDayPlan("2026-08-12").items;
    expect(item.headline).toBe("Rosa → clear due diligence items");
    expect(item.reason).toBe("Due 3 days ago. Rosa Delgado.");
    expect(item.isCall).toBe(true);
    expect(item.contactId).toBe(contact.id);
  });

  it("does not offer a call when there is nobody to dial", () => {
    withNoTasks();
    createTask({ name: "Call someone", dueDate: "2026-08-11", type: "call", source: "none" });
    const [item] = buildDayPlan("2026-08-12").items;
    expect(item.isCall).toBe(false);
    expect(item.contactId).toBeNull();
  });

  it("caps the queue at the limit but reports the true total", () => {
    withNoTasks();
    for (let i = 1; i <= 12; i++) {
      createTask({ name: `Task ${i}`, dueDate: "2026-08-05", source: "none" });
    }
    const { items, totalDue } = buildDayPlan("2026-08-12", 8);
    expect(items).toHaveLength(8);
    expect(totalDue).toBe(12);
  });

  it("returns an empty queue when nothing is due", () => {
    withNoTasks();
    createTask({ name: "Later", dueDate: "2026-12-01", source: "none" });
    expect(buildDayPlan("2026-08-12").items).toEqual([]);
  });

  it("finds the deals' planner tasks against the real seed", () => {
    // Standalone tasks seed empty, so a queue that only read `tasks` would
    // always be empty — this is the regression the old stub had.
    expect(buildDayPlan("2026-08-12").totalDue).toBeGreaterThan(0);
  });

  it("pins the overnight signal as the first move, so the greeting agrees", () => {
    const [first] = buildDayPlan("2026-08-12").items;
    expect(first.kind).toBe("signal");
    expect(first.headline).toContain("Rosa");
    // "Start with" is the card's prefix for the top item, not the ranker's job.
    expect(first.headline).not.toContain("Start with");
    expect(first.headline).toContain("overnight signal");
    expect(first.isCall).toBe(true);
    expect(first.contactId).toBeTruthy();
  });

  it("leaves closed-deal voucher paperwork out of the queue", () => {
    const { listings } = useDataStore.getState();
    // The only case here that reads the seeded book rather than building its own
    // tasks, so it is the only one that cannot pin a date. Seeded task dates are
    // anchored to the real clock — `stageStartedAt` is a `faker.date.recent`,
    // and `generateTasks` shifts off that — so a hardcoded "today" drifts out of
    // the fixture window as real time passes. It had: by Aug 2026 the seeded
    // window ran Jul 10 – Sep 26, and of the 8 deal tasks still due on or before
    // the pinned Aug 12, *none* were on live deals, so the queue held no deal
    // items at all and this failed on `stages.length`. `faker.seed()` keeps the
    // draws deterministic; it is only the anchor that moves. Asking about today
    // keeps the test's date and the fixtures' dates in the same relationship
    // forever.
    const today = new Date().toISOString().slice(0, 10);
    const { items } = buildDayPlan(today, 50);
    const stages = items
      .filter((i) => i.dealId)
      .map((i) => listings.get(i.dealId!)?.status);
    expect(stages.length).toBeGreaterThan(0);
    expect(stages).not.toContain("closed");
    expect(stages).not.toContain("inactive");
    // Closed deals were the only source of the 40+ day outliers.
    expect(Math.max(...items.map((i) => i.daysOverdue))).toBeLessThan(30);
  });
});
