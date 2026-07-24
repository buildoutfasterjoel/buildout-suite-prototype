import { describe, it, expect, beforeEach } from "vitest";
import { useCallStore } from "./useCallStore";

const TARGET = {
  contactId: "c1", name: "Marcus Pinckney", entity: "Pinckney Holdings",
  phone: "843-555-0101", initials: "MP", firstName: "Marcus", role: "owner", note: "Retiring.",
};

describe("useCallStore", () => {
  beforeEach(() => useCallStore.getState().reset());

  it("starts idle with no target", () => {
    const s = useCallStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.target).toBeNull();
  });

  it("startTarget begins a fresh call in calling phase", () => {
    useCallStore.getState().appendLine("you", "stale line");
    useCallStore.getState().startTarget(TARGET);
    const s = useCallStore.getState();
    expect(s.phase).toBe("calling");
    expect(s.countdown).toBe(5);
    expect(s.target?.name).toBe("Marcus Pinckney");
    expect(s.transcript).toHaveLength(0);
    expect(s.recap).toBeNull();
  });

  it("appendLine adds unique transcript lines", () => {
    useCallStore.getState().appendLine("you", "Hi Marcus");
    useCallStore.getState().appendLine("them", "Who's this?");
    const t = useCallStore.getState().transcript;
    expect(t.map((l) => l.speaker)).toEqual(["you", "them"]);
    expect(t[0].id).not.toBe(t[1].id);
  });

  it("toggleMute flips muted", () => {
    expect(useCallStore.getState().muted).toBe(false);
    useCallStore.getState().toggleMute();
    expect(useCallStore.getState().muted).toBe(true);
  });

  it("reset clears everything back to idle", () => {
    useCallStore.getState().startTarget(TARGET);
    useCallStore.getState().appendLine("them", "hello");
    useCallStore.getState().reset();
    const s = useCallStore.getState();
    expect(s.phase).toBe("idle");
    expect(s.target).toBeNull();
    expect(s.transcript).toHaveLength(0);
  });
});
