import { describe, it, expect } from "vitest";
import { composeGreeting } from "./greeting";
import type { AssistantContext } from "#/ai/context";

const ctx = (over = 0, today = 0): AssistantContext => ({
  broker: { name: "Ethan Thompson", role: "Broker" },
  tasks: { overdue: over, dueToday: today },
  pipeline: { openDeals: 0, totalValue: 0 },
  contacts: [],
});

describe("composeGreeting", () => {
  it("uses the broker first name and time of day", () => {
    const g = composeGreeting(ctx(0, 3), { now: new Date("2026-07-23T08:00:00") });
    expect(g).toMatch(/^Morning, Ethan/);
  });

  it("switches to Afternoon and Evening by hour", () => {
    expect(composeGreeting(ctx(), { now: new Date("2026-07-23T13:00:00") })).toMatch(/^Afternoon, Ethan/);
    expect(composeGreeting(ctx(), { now: new Date("2026-07-23T20:00:00") })).toMatch(/^Evening, Ethan/);
  });

  it("states the real open-task count", () => {
    expect(composeGreeting(ctx(0, 5), { now: new Date("2026-07-23T08:00:00") })).toContain("5 tasks");
    expect(composeGreeting(ctx(0, 1), { now: new Date("2026-07-23T08:00:00") })).toContain("1 task ");
  });

  it("mentions an overnight signal only when provided", () => {
    const withSig = composeGreeting(ctx(0, 2), { now: new Date("2026-07-23T08:00:00"), overnightSignal: "a maturing loan on Marcus Pinckney" });
    expect(withSig).toContain("overnight");
    const without = composeGreeting(ctx(0, 2), { now: new Date("2026-07-23T08:00:00") });
    expect(without).not.toContain("overnight");
  });

  it("always ends in the offer", () => {
    expect(composeGreeting(ctx(0, 0), { now: new Date("2026-07-23T08:00:00") }))
      .toContain("Want me to call your most important move first?");
  });
});
