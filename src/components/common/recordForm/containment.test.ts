/**
 * Guards the record-form shell against spreading.
 *
 * This whole module exists because the shared widgets once lived inside
 * `listings/edit/` while `deals/edit/` imported them across a folder boundary,
 * and nobody noticed until an audit went looking. The guard against a repeat was
 * a comment in a module header and a paragraph in CLAUDE.md — which is exactly
 * the kind of guard that failed the first time. This test is the one that fails
 * loudly instead.
 *
 * Deliberately pure logic: it reads the source tree off disk and asserts on
 * strings. No component-test harness, per the repo's split — logic in Vitest,
 * UI in the browser.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * The only places the record-form shell may be used.
 *
 * Adding a directory here is a DELIBERATE DECISION, not a formality: it asserts
 * that the surface in question is one of the app's long record forms. See
 * CLAUDE.md, "Record forms" rule 1 — the shell is for long forms only, because
 * the 164px label gutter and the tile stack earn their cost across twenty-plus
 * fields and lose money on four. A modal, a filter flyout, or a six-field panel
 * that wants this look wants plain stacked Blueprint `Field`s instead.
 *
 * If you are here because a new *long* form was added, extend the list and say
 * so in the commit body. If you are here to make a short form compile, move the
 * code back out instead.
 */
const ALLOWED_DIRS = [
  // The shell itself.
  "src/components/common/recordForm",
  // The Listing form — /listings/:id/listing
  "src/components/listings/edit",
  // The Deal form — /listings/:id/edit
  "src/components/deals/edit",
];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".scss"];

/** Every source file under `src/`, as repo-relative posix paths. */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!SOURCE_EXTENSIONS.includes(path.extname(entry.name))) return [];
    return [path.relative(path.resolve(SRC, ".."), full).split(path.sep).join("/")];
  });
}

const isAllowed = (file: string) =>
  ALLOWED_DIRS.some((dir) => file.startsWith(`${dir}/`));

/** Files outside the allowlist whose contents mention `needle`. */
function offenders(needle: string): string[] {
  return sourceFiles()
    .filter((file) => !isAllowed(file))
    .filter((file) => readFileSync(path.resolve(SRC, "..", file), "utf8").includes(needle));
}

const remedy = (needle: string, found: string[]) =>
  [
    `Found "${needle}" outside the record-form allowlist:`,
    ...found.map((f) => `  - ${f}`),
    "",
    "The record-form shell is for the app's LONG record forms only (the Listing",
    "form and the Deal form). Pick one of two fixes:",
    "  1. Move the code into src/components/listings/edit/ or",
    "     src/components/deals/edit/ if it belongs to one of those forms; or",
    "  2. If a genuinely new long form now needs the shell, add its directory to",
    "     ALLOWED_DIRS in this file and justify it in the commit body.",
    "",
    "Do NOT extend the allowlist to make a modal, a filter flyout, or a short",
    "panel compile — those use plain stacked Blueprint `Field`s. See CLAUDE.md,",
    '"Record forms" rule 1.',
  ].join("\n");

describe("record-form shell containment", () => {
  it("finds the source tree it is asserting on", () => {
    // A silently-empty walk would make every assertion below pass for free.
    const files = sourceFiles();
    expect(files).toContain("src/components/common/recordForm/FieldGroup.tsx");
    expect(files.length).toBeGreaterThan(100);
  });

  it("is imported only from the allowlisted directories", () => {
    // Catches `#/components/common/recordForm/...` and any relative
    // `../../common/recordForm/...` alike.
    const found = offenders("common/recordForm");
    expect(found, remedy("common/recordForm", found)).toEqual([]);
  });

  it("keeps its class prefix inside those same directories", () => {
    // The styles travel with the components — a `record-form__` class on a page
    // that does not import the shell is the same leak wearing a different hat.
    const found = offenders("record-form__");
    expect(found, remedy("record-form__", found)).toEqual([]);
  });
});
