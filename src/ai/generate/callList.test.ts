import { describe, it, expect } from "vitest";
import { callListFallback } from "./fallbacks";

describe("callListFallback", () => {
  it("returns at most 8 ranked contacts with valid ids", () => {
    const contacts = Array.from({ length: 12 }, (_, i) => ({
      id: `c${i}`, lastContactedAt: null, relationship: i % 2 ? "cold" : "pitching",
    }));
    const r = callListFallback(contacts);
    expect(r.calls.length).toBeLessThanOrEqual(8);
    expect(r.calls.every((c) => contacts.some((x) => x.id === c.contactId))).toBe(true);
    expect(r.calls[0].score).toBeGreaterThanOrEqual(r.calls[r.calls.length - 1].score);
  });
});
