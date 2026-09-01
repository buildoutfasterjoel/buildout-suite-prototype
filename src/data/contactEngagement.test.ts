import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore, seedSlice } from "#/data/dataStore";
import { promoteOnEngagement } from "#/data/contactEngagement";
import { recordEngagement } from "#/components/contacts/useContactSession";
import { useContactSession } from "#/components/contacts/useContactSession";
import { createTask } from "#/data/actions";
import type { Contact, RelationshipStage } from "#/data/types";

beforeEach(() => {
  useDataStore.setState(seedSlice());
  useContactSession.setState({ logged: {}, simEvents: {}, resolved: {}, flags: {} });
});

/** Force a seeded contact to a known stage and hand back its id. */
function contactAt(relationship: RelationshipStage): string {
  const id = [...useDataStore.getState().contacts.keys()][0];
  useDataStore.setState((s) => {
    const contacts = new Map(s.contacts);
    const c = contacts.get(id)!;
    contacts.set(id, { ...c, relationship, dealStage: null } as Contact);
    return { contacts };
  });
  return id;
}

const stageOf = (id: string) => useDataStore.getState().contacts.get(id)!.relationship;

describe("promoteOnEngagement", () => {
  it("promotes a cold contact on a task, an email and a call", () => {
    for (const trigger of ["task", "email", "call"] as const) {
      const id = contactAt("cold");
      expect(promoteOnEngagement(id, trigger)?.from).toBe("cold");
      expect(stageOf(id)).toBe("nurturing");
    }
  });

  it("promotes an inquired contact on an email or a call, but not a task", () => {
    const viaTask = contactAt("inquired");
    expect(promoteOnEngagement(viaTask, "task")).toBeNull();
    expect(stageOf(viaTask)).toBe("inquired");

    for (const trigger of ["email", "call"] as const) {
      const id = contactAt("inquired");
      expect(promoteOnEngagement(id, trigger)?.from).toBe("inquired");
      expect(stageOf(id)).toBe("nurturing");
    }
  });

  it("leaves a deal-derived stage alone", () => {
    for (const stage of ["pitching", "client", "past_client"] as const) {
      const id = contactAt(stage);
      expect(promoteOnEngagement(id, "email")).toBeNull();
      expect(stageOf(id)).toBe(stage);
    }
  });

  it("never fires twice — nurturing is already there", () => {
    const id = contactAt("cold");
    expect(promoteOnEngagement(id, "email")).not.toBeNull();
    expect(promoteOnEngagement(id, "email")).toBeNull();
  });

  it("does not touch lastContactedAt (it anchors the timeline arc)", () => {
    const id = contactAt("cold");
    const before = useDataStore.getState().contacts.get(id)!.lastContactedAt;
    promoteOnEngagement(id, "call");
    expect(useDataStore.getState().contacts.get(id)!.lastContactedAt).toBe(before);
  });

  it("ignores an unknown contact", () => {
    expect(promoteOnEngagement("nope", "email")).toBeNull();
  });
});

describe("recordEngagement", () => {
  it("drops a stage-change row on the contact's timeline explaining the move", () => {
    const id = contactAt("inquired");
    recordEngagement(id, "email");
    const rows = useContactSession.getState().simEvents[id] ?? [];
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("stage-change");
    expect(rows[0].stageChange).toEqual({ from: "inquired", to: "nurturing" });
    expect(rows[0].body).toContain("Nurturing");
  });

  it("adds no row when the stage doesn't move", () => {
    const id = contactAt("inquired");
    recordEngagement(id, "task");
    expect(useContactSession.getState().simEvents[id] ?? []).toHaveLength(0);
  });

  it("tolerates a missing contact id", () => {
    expect(() => recordEngagement(null, "email")).not.toThrow();
  });
});

describe("logging an activity", () => {
  it("promotes on a sent email and a logged call, not on a note", () => {
    const emailed = contactAt("cold");
    useContactSession.getState().addLog(emailed, { kind: "email", body: "hi", date: "2026-09-01" });
    expect(stageOf(emailed)).toBe("nurturing");

    const called = contactAt("inquired");
    useContactSession.getState().addLog(called, { kind: "call", body: "spoke", date: "2026-09-01" });
    expect(stageOf(called)).toBe("nurturing");

    const noted = contactAt("inquired");
    useContactSession.getState().addLog(noted, { kind: "note", body: "fyi", date: "2026-09-01" });
    expect(stageOf(noted)).toBe("inquired");
  });
});

describe("createTask", () => {
  it("starts the relationship with a cold contact", () => {
    const id = contactAt("cold");
    createTask({ name: "Call back", contactId: id });
    expect(stageOf(id)).toBe("nurturing");
  });

  it("leaves an inquiry-sourced lead where it is", () => {
    const id = contactAt("inquired");
    createTask({ name: "Call back", contactId: id });
    expect(stageOf(id)).toBe("inquired");
  });

  it("is a no-op for a task with no contact", () => {
    expect(() => createTask({ name: "Standalone" })).not.toThrow();
  });
});
