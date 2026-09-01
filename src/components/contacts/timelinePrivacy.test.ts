import { describe, expect, it } from "vitest";
import {
  canBePrivate,
  composedToEvent,
  hiddenFromViewer,
  isPrivateEvent,
  type TimelineEvent,
} from "#/components/contacts/timeline";
import { CURRENT_USER } from "#/data/teammates";
import type { Contact } from "#/data/types";
import type { ComposedActivity } from "#/components/contacts/contactDisplay";

const contact = { id: "c1", firstName: "Annette", lastName: "Mayer" } as unknown as Contact;

function ev(over: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "e",
    type: "note",
    actor: { name: CURRENT_USER.name },
    timestamp: "2026-09-01T10:00:00.000Z",
    seq: 1,
    source: "user",
    ...over,
  };
}

function logged(over: Partial<ComposedActivity>): ComposedActivity {
  return {
    id: "logged-1",
    kind: "note",
    body: "candid",
    date: "2026-09-01",
    seq: 1,
    createdAt: "2026-09-01T10:00:00.000Z",
    ...over,
  };
}

describe("artifact privacy", () => {
  it("lets the author mark the five authored kinds private", () => {
    for (const type of ["note", "call", "email", "meeting", "tour"] as const) {
      expect(canBePrivate(ev({ type })), type).toBe(true);
    }
  });

  it("never offers privacy on system rows", () => {
    for (const type of [
      "created",
      "stage-change",
      "change-log",
      "assignment",
      "marketing",
      "task",
    ] as const) {
      expect(canBePrivate(ev({ type, source: "system" })), type).toBe(false);
      // Even mislabelled as user-sourced, the type alone rules it out.
      expect(canBePrivate(ev({ type, source: "user" })), type).toBe(false);
    }
  });

  it("never offers privacy on inbound rows or someone else's rows", () => {
    expect(canBePrivate(ev({ type: "call", direction: "in" }))).toBe(false);
    expect(canBePrivate(ev({ type: "inbound-email" }))).toBe(false);
    expect(canBePrivate(ev({ actor: { name: "Sarah Chen" } }))).toBe(false);
  });

  it("hides a colleague's private note and keeps the viewer's own", () => {
    const mine = ev({ visibility: "private" });
    const theirs = ev({ visibility: "private", actor: { name: "Sarah Chen" } });
    const theirsPublic = ev({ actor: { name: "Sarah Chen" } });
    expect(isPrivateEvent(mine)).toBe(true);
    expect(hiddenFromViewer(mine)).toBe(false);
    expect(hiddenFromViewer(theirs)).toBe(true);
    expect(hiddenFromViewer(theirsPublic)).toBe(false);
  });

  it("carries the composer's Private toggle onto the logged row", () => {
    expect(composedToEvent(logged({ isPrivate: true }), contact).visibility).toBe("private");
    expect(composedToEvent(logged({}), contact).visibility).toBeUndefined();
  });
});
