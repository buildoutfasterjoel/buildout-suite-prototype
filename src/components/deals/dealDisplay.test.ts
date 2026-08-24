import { describe, it, expect } from "vitest";
import { formatDate, formatLongDate, formatMonthYear } from "./dealDisplay";

/**
 * These assertions hold in every timezone. That is the point: a stored
 * `YYYY-MM-DD` names a calendar day with no zone attached, so it must render as
 * that day whether the reader sits in Los Angeles or Berlin.
 */
describe("formatDate", () => {
  it("renders a date-only string as the day it names", () => {
    // `new Date('2026-08-14')` is UTC midnight, which is 13 Aug locally
    // anywhere west of Greenwich — the day before the one stored.
    expect(formatDate("2026-08-14")).toBe("08/14/2026");
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("12/31/2026");
  });

  it("still reads a full timestamp in local time", () => {
    // A timestamp carries its own offset, so Date is right to convert it.
    const noon = new Date(2026, 7, 14, 12, 0, 0).toISOString();
    expect(formatDate(noon)).toBe("08/14/2026");
  });

  it("renders a dash for a missing date", () => {
    expect(formatDate(null)).toBe("--");
  });
});

describe("formatLongDate", () => {
  it("renders a date-only string as the day it names", () => {
    expect(formatLongDate("2026-08-14")).toBe("Aug 14, 2026");
    expect(formatLongDate("2026-01-01")).toBe("Jan 1, 2026");
  });

  it("renders a dash for a missing date", () => {
    expect(formatLongDate(null)).toBe("--");
  });
});

describe("formatMonthYear", () => {
  it("keeps the month the string names", () => {
    expect(formatMonthYear("2027-04-01")).toBe("Apr 2027");
  });
});
