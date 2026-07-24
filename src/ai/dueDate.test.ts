import { describe, it, expect } from "vitest";
import { parseDueDate } from "./dueDate";

const FROM = new Date(2026, 6, 23); // Thu 2026-07-23

describe("parseDueDate", () => {
  it("today / tomorrow", () => {
    expect(parseDueDate("today", FROM)).toBe("2026-07-23");
    expect(parseDueDate("tomorrow", FROM)).toBe("2026-07-24");
  });
  it("in N days", () => {
    expect(parseDueDate("in 3 days", FROM)).toBe("2026-07-26");
  });
  it("next weekday (friday from thursday)", () => {
    expect(parseDueDate("friday", FROM)).toBe("2026-07-24");
  });
  it("passes through an ISO date", () => {
    expect(parseDueDate("2026-08-01", FROM)).toBe("2026-08-01");
  });
  it("returns null for gibberish", () => {
    expect(parseDueDate("someday maybe", FROM)).toBeNull();
  });
});
