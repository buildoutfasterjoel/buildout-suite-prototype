import { describe, expect, it } from "vitest";
import { shortDateTime } from "#/components/contacts/timeline";

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
