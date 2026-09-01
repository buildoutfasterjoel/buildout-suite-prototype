import { describe, it, expect } from "vitest";
import { composeGreeting, buildGreetingWithOffer } from "./greeting";
import type { AssistantContext } from "#/ai/context";
import { useDataStore } from "#/data/dataStore";
import type { Contact } from "#/data/types";

const ctx = (over = 0, today = 0): AssistantContext => ({
  broker: { name: "Ethan Thompson", role: "Broker" },
  tasks: { overdue: over, dueToday: today },
  pipeline: { openDeals: 0, totalValue: 0 },
  contacts: [],
  field: null,
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
    const withSig = composeGreeting(ctx(0, 2), { now: new Date("2026-07-23T08:00:00"), overnightSignal: "a maturing loan on Rosa Delgado" });
    expect(withSig).toContain("overnight");
    const without = composeGreeting(ctx(0, 2), { now: new Date("2026-07-23T08:00:00") });
    expect(without).not.toContain("overnight");
  });

  it("always ends in the offer", () => {
    expect(composeGreeting(ctx(0, 0), { now: new Date("2026-07-23T08:00:00") }))
      .toContain("Want me to call your most important move first?");
  });
});

describe("buildGreetingWithOffer", () => {
  it("names the overnight signal and arms a call offer when the hero is present", () => {
    const rosa = {
      id: "r", firstName: "Rosa", lastName: "Delgado", role: "owner", propertyIds: [], heroKey: "rosa",
      signal: { kind: "loan-maturity", headline: "a maturing CMBS loan", detail: "d", observedAt: "2026-07-24" },
    } as unknown as Contact;
    useDataStore.setState({ contacts: new Map([["r", rosa]]) });
    const { text, offer } = buildGreetingWithOffer();
    expect(text).toContain("maturing CMBS loan");
    expect(offer).toEqual({ kind: "call", contactId: "r" });
  });

  it("has no offer when there is no hero signal", () => {
    useDataStore.setState({ contacts: new Map() });
    const { offer } = buildGreetingWithOffer();
    expect(offer).toBeNull();
  });
});
