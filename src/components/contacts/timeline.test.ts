import { describe, expect, it } from "vitest";
import {
  groupThreadMessages,
  shortDateTime,
  type TimelineThreadMessage,
} from "#/components/contacts/timeline";

function msg(
  id: string,
  direction: "out" | "in",
  sender: string,
  timestamp = "2026-07-06T09:05:00.000Z",
): TimelineThreadMessage {
  return { id, direction, sender, timestamp, body: `body ${id}` };
}

describe("groupThreadMessages", () => {
  it("collapses a run of consecutive messages from one sender", () => {
    const groups = groupThreadMessages([
      msg("m1", "in", "Victor Osei"),
      msg("m2", "in", "Victor Osei"),
      msg("m3", "out", "Ethan Thompson"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].sender).toBe("Victor Osei");
    expect(groups[0].messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(groups[1].messages.map((m) => m.id)).toEqual(["m3"]);
  });

  it("starts a new group when the sender returns later in the thread", () => {
    const groups = groupThreadMessages([
      msg("m1", "in", "Victor Osei"),
      msg("m2", "out", "Ethan Thompson"),
      msg("m3", "in", "Victor Osei"),
    ]);
    // Not merged with m1 — they aren't adjacent, so they're separate exchanges.
    expect(groups.map((g) => g.messages.length)).toEqual([1, 1, 1]);
  });

  it("keeps same-direction messages from different senders apart", () => {
    const groups = groupThreadMessages([
      msg("m1", "in", "Victor Osei"),
      msg("m2", "in", "Dana Whitfield"),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("preserves order and loses no messages", () => {
    const input = [
      msg("m1", "out", "Ethan Thompson"),
      msg("m2", "in", "Victor Osei"),
      msg("m3", "in", "Victor Osei"),
      msg("m4", "in", "Victor Osei"),
      msg("m5", "out", "Ethan Thompson"),
    ];
    const flat = groupThreadMessages(input).flatMap((g) => g.messages);
    expect(flat.map((m) => m.id)).toEqual(input.map((m) => m.id));
  });

  it("handles an empty thread", () => {
    expect(groupThreadMessages([])).toEqual([]);
  });
});

describe("shortDateTime", () => {
  it("keeps two messages minutes apart distinguishable", () => {
    // The failure this guards: `relativeTime` renders both of these as "3w ago".
    const a = shortDateTime("2026-07-06T13:12:00.000Z");
    const b = shortDateTime("2026-07-06T13:31:00.000Z");
    expect(a).not.toBe(b);
  });

  it("carries the date as well as the clock time", () => {
    const out = shortDateTime("2026-07-06T16:05:00.000Z");
    expect(out).toMatch(/Jul 6/);
    expect(out).toMatch(/\d:\d{2}\s?(AM|PM)/);
  });
});
