import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONFLICT_PAGE, type ConflictPage } from "./ingestionRouting";

/**
 * `CONFLICT_PAGE` (ingestionRouting.ts) states which edit page each ingestion
 * conflict's field renders on. Nothing enforces that the field actually renders
 * there — a `dealCardLink.invariant.test.ts`-style test asserting the map
 * against itself (`expect(CONFLICT_PAGE).toEqual({...})`) would pass even if a
 * field moved to the other page, because it never looks at the fields. Move
 * `fieldKey="occupancyPct"` from the Listing page to the Deal page (or the
 * reverse for `askingPrice`/`noi`) and that older test still passes while the
 * field becomes unreachable — the broker could never resolve it, and the
 * publish gate would block forever.
 *
 * So this test reads the source, the same way `dealCardLink.invariant.test.ts`
 * does: it finds every `fieldKey="X"` prop in the codebase and checks that the
 * file rendering it sits under the page `CONFLICT_PAGE[X]` names.
 */

const SRC_DIR = fileURLToPath(new URL("../../", import.meta.url));

const GUIDANCE = [
  "A `fieldKey=\"X\"` prop rendered on a page other than the one `CONFLICT_PAGE`",
  "in ingestionRouting.ts says it belongs on. Either move the field back to its",
  "page, or update CONFLICT_PAGE to match where it actually renders now — a field",
  "left disagreeing with CONFLICT_PAGE is one the broker can never resolve.",
].join("\n");

/** Every non-test `.tsx`/`.ts` file under `src/`. Tests are skipped so this
 *  file (which quotes `fieldKey="…"` in its own comments/strings) can't match
 *  itself. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = `${dir}${entry.name}`;
    if (entry.isDirectory()) sourceFiles(`${abs}/`, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(abs);
    }
  }
  return acc;
}

/** Which page a file's fields belong to, based on which page's directory it
 *  lives under. `null` for a file under neither — not a page component at all. */
function pageOf(relPath: string): ConflictPage | null {
  if (relPath.startsWith("src/components/deals/edit/")) return "deal";
  if (relPath.startsWith("src/components/listings/edit/")) return "listing";
  return null;
}

const FIELD_KEY_PROP = /fieldKey="(\w+)"/g;

describe("CONFLICT_PAGE matches where its fields actually render", () => {
  it("renders every conflict field on the page CONFLICT_PAGE says it's on", () => {
    const mismatches: string[] = [];
    for (const abs of sourceFiles(SRC_DIR)) {
      const rel = `src/${abs.slice(SRC_DIR.length)}`;
      const source = readFileSync(abs, "utf8");
      for (const [, fieldKey] of source.matchAll(FIELD_KEY_PROP)) {
        if (!(fieldKey in CONFLICT_PAGE)) continue;
        const page = pageOf(rel);
        const wantsPage = CONFLICT_PAGE[fieldKey as keyof typeof CONFLICT_PAGE];
        if (page !== wantsPage) {
          mismatches.push(
            `${rel} renders fieldKey="${fieldKey}" (page: ${page ?? "none"}), but CONFLICT_PAGE says "${fieldKey}" belongs on "${wantsPage}"`,
          );
        }
      }
    }
    expect(mismatches, GUIDANCE).toEqual([]);
  });

  it("finds the fields it is looking for at all", () => {
    // A guard on the guard: if the prop name or the pattern above stopped
    // matching, the assertion above would pass vacuously on an empty set.
    const found = new Set<string>();
    for (const abs of sourceFiles(SRC_DIR)) {
      const source = readFileSync(abs, "utf8");
      for (const [, fieldKey] of source.matchAll(FIELD_KEY_PROP)) found.add(fieldKey);
    }
    expect([...found].sort()).toEqual(Object.keys(CONFLICT_PAGE).sort());
  });
});
