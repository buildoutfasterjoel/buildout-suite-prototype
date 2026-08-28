import { describe, expect, it } from "vitest";
import {
  CHANGELOG,
  KIND_ORDER,
  entryKinds,
  groupByDay,
  kindCounts,
  prUrl,
  type ChangelogEntry,
} from "./changelogEntries";

/**
 * These guard the log itself as much as the helpers. Once an appender is writing
 * entries, the failure modes are all in the data — a duplicate PR, an entry
 * inserted in the wrong place, a day that doesn't parse — and none of those
 * break the build or throw at runtime. They just render a wrong page.
 */
describe("CHANGELOG", () => {
  it("has no duplicate PR numbers", () => {
    const seen = new Set<number>();
    for (const entry of CHANGELOG) {
      expect(seen.has(entry.pr), `PR #${entry.pr} appears twice`).toBe(false);
      seen.add(entry.pr);
    }
  });

  it("is ordered newest first", () => {
    const merged = CHANGELOG.map((e) => Date.parse(e.mergedAt));
    expect(merged.every((t) => Number.isFinite(t))).toBe(true);
    for (let i = 1; i < merged.length; i += 1) {
      expect(merged[i]).toBeLessThan(merged[i - 1]);
    }
  });

  it("files every entry under a YYYY-MM-DD day, non-increasing", () => {
    const days = CHANGELOG.map((e) => e.day);
    for (const day of days) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < days.length; i += 1) {
      expect(days[i] <= days[i - 1]).toBe(true);
    }
  });

  it("gives every entry a summary and at least one highlight", () => {
    for (const entry of CHANGELOG) {
      expect(entry.summary.length, `#${entry.pr}`).toBeGreaterThan(0);
      expect(entry.highlights.length, `#${entry.pr}`).toBeGreaterThan(0);
    }
  });
});

function entry(pr: number, day: string, kinds: string[]): ChangelogEntry {
  return {
    pr,
    day,
    title: `PR ${pr}`,
    mergedAt: `${day}T12:00:00Z`,
    author: "someone-new",
    summary: "s",
    highlights: kinds.map((kind) => ({
      kind: kind as ChangelogEntry["highlights"][number]["kind"],
      text: `${kind} on ${pr}`,
    })),
  };
}

describe("entryKinds", () => {
  it("dedupes and returns kinds in badge order", () => {
    const kinds = entryKinds(entry(1, "2026-08-28", ["fix", "feature", "fix"]));
    expect(kinds).toEqual(["feature", "fix"]);
  });

  it("returns nothing for an entry with no highlights", () => {
    expect(entryKinds(entry(1, "2026-08-28", []))).toEqual([]);
  });
});

describe("kindCounts", () => {
  it("counts highlights, not entries", () => {
    const counts = kindCounts([
      entry(2, "2026-08-28", ["feature", "feature", "fix"]),
      entry(1, "2026-08-27", ["refinement"]),
    ]);
    expect(counts).toEqual({ feature: 2, refinement: 1, fix: 1 });
  });

  it("reports zero for a kind nothing shipped", () => {
    const counts = kindCounts([]);
    for (const kind of KIND_ORDER) expect(counts[kind]).toBe(0);
  });
});

describe("groupByDay", () => {
  it("buckets consecutive entries sharing a day", () => {
    const days = groupByDay([
      entry(3, "2026-08-28", ["fix"]),
      entry(2, "2026-08-27", ["fix"]),
      entry(1, "2026-08-27", ["fix"]),
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-08-28", "2026-08-27"]);
    expect(days[1].entries.map((e) => e.pr)).toEqual([2, 1]);
  });

  it("preserves the order it was given within a day", () => {
    const days = groupByDay([
      entry(9, "2026-08-27", ["fix"]),
      entry(4, "2026-08-27", ["fix"]),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].entries.map((e) => e.pr)).toEqual([9, 4]);
  });

  it("returns nothing for an empty log", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("prUrl", () => {
  it("points at the prototype repo", () => {
    expect(prUrl(182)).toBe(
      "https://github.com/buildoutfasterjoel/buildout-suite-prototype/pull/182",
    );
  });
});
