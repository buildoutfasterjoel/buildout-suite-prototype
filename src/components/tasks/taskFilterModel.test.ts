import { describe, expect, it } from "vitest";
import { dueSection, endOfWeekISO } from "#/components/tasks/taskFilterModel";

// 2026-08-05 is a Wednesday; its calendar week (Sun–Sat) ends Sat 2026-08-08.
const WED = "2026-08-05";

describe("endOfWeekISO", () => {
  it("returns the Saturday of the week containing the date", () => {
    expect(endOfWeekISO(WED)).toBe("2026-08-08");
    expect(endOfWeekISO("2026-08-02")).toBe("2026-08-08"); // Sunday
    expect(endOfWeekISO("2026-08-08")).toBe("2026-08-08"); // Saturday
  });

  it("rolls over month and year boundaries", () => {
    expect(endOfWeekISO("2026-12-31")).toBe("2027-01-02");
  });
});

describe("dueSection", () => {
  it("keeps the overdue / today / none buckets", () => {
    expect(dueSection("2026-08-04", WED)).toBe("overdue");
    expect(dueSection(WED, WED)).toBe("today");
    expect(dueSection(null, WED)).toBe("none");
  });

  it("splits future into this week and later", () => {
    expect(dueSection("2026-08-06", WED)).toBe("week");
    expect(dueSection("2026-08-08", WED)).toBe("week"); // end of week, inclusive
    expect(dueSection("2026-08-09", WED)).toBe("future"); // next Sunday
    expect(dueSection("2026-09-01", WED)).toBe("future");
  });

  it("has an empty week section when today is the last day of the week", () => {
    expect(dueSection("2026-08-09", "2026-08-08")).toBe("future");
  });
});
