import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("#/lib/notify", () => ({ notify: vi.fn() }));

import "fake-indexeddb/auto";
import {
  useCallSession,
  currentSessionContactId,
  callableContactIds,
  startCallSession,
} from "./useCallSession";
import { useDataStore } from "#/data/dataStore";
import { generateDataset } from "#/data/seed";
import type { Contact } from "#/data/types";

/**
 * Seed the store with a handful of hand-built contacts. They're the signed-in
 * user's unless a case says otherwise — a run only dials contacts the viewer
 * has the right to reach out to, and these tests are about the other filters.
 */
function seedContacts(contacts: Partial<Contact>[]) {
  const full = contacts.map((c, i) => ({
    id: c.id ?? `c${i}`,
    firstName: "A",
    lastName: "B",
    phone: "843-555-0100",
    doNotCall: false,
    assignedTo: "Ethan Thompson",
    ...c,
  })) as Contact[];
  useDataStore.setState({
    contacts: new Map(full.map((c) => [c.id, c])),
  } as never);
  return full;
}

describe("useCallSession", () => {
  beforeEach(() => {
    useCallSession.getState().end();
  });

  it("starts a run and reports the current contact", () => {
    useCallSession.getState().start(["a", "b", "c"], "My List");
    const s = useCallSession.getState();
    expect(s.active).toBe(true);
    expect(s.index).toBe(0);
    expect(s.label).toBe("My List");
    expect(currentSessionContactId(s)).toBe("a");
  });

  it("start with an empty queue stays idle", () => {
    useCallSession.getState().start([], "Empty");
    expect(useCallSession.getState().active).toBe(false);
  });

  it("advance counts a logged call; skip does not", () => {
    useCallSession.getState().start(["a", "b", "c"], "L");
    useCallSession.getState().advance();
    expect(useCallSession.getState().index).toBe(1);
    expect(useCallSession.getState().logged).toBe(1);
    useCallSession.getState().skip();
    expect(useCallSession.getState().index).toBe(2);
    expect(useCallSession.getState().logged).toBe(1); // unchanged by a skip
  });

  it("running past the end leaves no current contact", () => {
    useCallSession.getState().start(["a"], "L");
    useCallSession.getState().advance();
    const s = useCallSession.getState();
    expect(s.index).toBe(1);
    expect(currentSessionContactId(s)).toBeNull();
  });

  it("advance/skip are no-ops once ended", () => {
    useCallSession.getState().start(["a", "b"], "L");
    useCallSession.getState().end();
    useCallSession.getState().advance();
    useCallSession.getState().skip();
    expect(useCallSession.getState().active).toBe(false);
    expect(useCallSession.getState().index).toBe(0);
  });
});

describe("callableContactIds", () => {
  it("drops Do Not Call, missing numbers, unknown ids, and duplicates", () => {
    seedContacts([
      { id: "ok1" },
      { id: "dnc", doNotCall: true },
      { id: "nophone", phone: "  " },
      { id: "ok2" },
    ]);
    expect(callableContactIds(["ok1", "dnc", "nophone", "ghost", "ok2", "ok1"])).toEqual([
      "ok1",
      "ok2",
    ]);
  });

  it("preserves the given order (a list's sort or AI ranking)", () => {
    seedContacts([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(callableContactIds(["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });
});

describe("startCallSession", () => {
  beforeEach(() => {
    useCallSession.getState().end();
  });

  it("starts a session with only the callable contacts", () => {
    seedContacts([{ id: "ok" }, { id: "dnc", doNotCall: true }]);
    startCallSession(["ok", "dnc"], "Mixed list");
    const s = useCallSession.getState();
    expect(s.active).toBe(true);
    expect(s.queue).toEqual(["ok"]);
    expect(s.label).toBe("Mixed list");
  });

  it("does not start a session when nobody is callable", () => {
    seedContacts([{ id: "dnc", doNotCall: true }]);
    startCallSession(["dnc"], "All blocked");
    expect(useCallSession.getState().active).toBe(false);
  });

  it("works off real seeded contacts", () => {
    const ds = generateDataset();
    useDataStore.setState({
      contacts: new Map(ds.contacts.map((c) => [c.id, c])),
    } as never);
    const ids = ds.contacts.slice(0, 5).map((c) => c.id);
    startCallSession(ids, "First five");
    const s = useCallSession.getState();
    expect(s.active).toBe(true);
    expect(s.queue.length).toBeGreaterThan(0);
    expect(s.queue.every((id) => ids.includes(id))).toBe(true);
  });
});

describe("callableContactIds respects reach-out rights", () => {
  it("drops a contact the viewer can only read, keeps their own", () => {
    seedContacts([
      { id: "mine" },
      // Sarah's, not shared with the viewer: visible, but not theirs to call.
      { id: "sarahs", assignedTo: "Sarah Chen" },
    ]);
    expect(callableContactIds(["mine", "sarahs"])).toEqual(["mine"]);
  });
});
