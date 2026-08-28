import { describe, expect, it } from "vitest";
import { CHANGELOG } from "#/components/changelog/changelogEntries";
import { buildPayload, isUserId } from "./changelogSlack";

/**
 * The payload shape was reviewed in Slack's Block Kit Builder before any of this
 * was wired up. These pin it, so a later edit to the page's data or to the
 * grouping cannot quietly change what lands in the channel.
 */
const entry = (pr: number) => {
  const found = CHANGELOG.find((e) => e.pr === pr);
  if (!found) throw new Error(`no entry for #${pr}`);
  return found;
};

type Block = { type: string; text?: { text?: string } };

describe("isUserId", () => {
  it("treats a U or W id as a person", () => {
    expect(isUserId("U024BE7LH")).toBe(true);
    // Enterprise Grid hands out W-prefixed user ids.
    expect(isUserId("W012A3CDE")).toBe(true);
  });

  it("treats every conversation id as already a conversation", () => {
    for (const id of ["C024BE91L", "G024BE91L", "D024BE91L"]) {
      expect(isUserId(id), id).toBe(false);
    }
  });

  it("does not take a channel name for a user", () => {
    expect(isUserId("#prada_team")).toBe(false);
    expect(isUserId("prada_team")).toBe(false);
  });
});

describe("buildPayload", () => {
  it("carries a notification fallback naming the PR", () => {
    // Without `text`, a blocks-only message pushes a blank notification.
    const payload = buildPayload(entry(185));
    expect(payload.text).toContain("#185");
    expect(payload.text).toContain(entry(185).title);
  });

  it("leads with a header, then context, then the summary", () => {
    const blocks = buildPayload(entry(185)).blocks as Block[];
    expect(blocks.slice(0, 3).map((b) => b.type)).toEqual([
      "header",
      "context",
      "section",
    ]);
    expect(blocks[2].text?.text).toBe(entry(185).summary);
  });

  it("links the PR from the context line and from a button", () => {
    const payload = buildPayload(entry(185));
    const json = JSON.stringify(payload);
    expect(json).toContain("/pull/185");
    const blocks = payload.blocks as Block[];
    expect(blocks[blocks.length - 1].type).toBe("actions");
  });

  it("groups highlights under one section per kind, in badge order", () => {
    // #183 is the three-kind case: two features, one refinement, one fix.
    const blocks = buildPayload(entry(183)).blocks as Block[];
    const headed = blocks
      .map((b) => b.text?.text ?? "")
      .filter((t) => t.startsWith("*"));
    expect(headed).toHaveLength(3);
    expect(headed[0]).toContain("New");
    expect(headed[1]).toContain("Refined");
    expect(headed[2]).toContain("Fixed");
  });

  it("omits a kind the entry does not carry", () => {
    // #185 has no fixes, so there must be no Fixed section at all — an empty
    // one would read as "we fixed nothing", which is not the same statement.
    const blocks = buildPayload(entry(185)).blocks as Block[];
    const text = blocks.map((b) => b.text?.text ?? "").join("\n");
    expect(text).toContain("Refined");
    expect(text).not.toContain("Fixed");
  });

  it("bullets every highlight it was given", () => {
    for (const pr of [185, 183, 177]) {
      const e = entry(pr);
      const text = (buildPayload(e).blocks as Block[])
        .map((b) => b.text?.text ?? "")
        .join("\n");
      const bullets = text.split("\n").filter((l) => l.startsWith("• "));
      expect(bullets, `#${pr}`).toHaveLength(e.highlights.length);
    }
  });

  it("builds a valid payload for every entry in the log", () => {
    // The appender will add entries nobody renders by hand first.
    for (const e of CHANGELOG) {
      const payload = buildPayload(e);
      expect(payload.text.length, `#${e.pr}`).toBeGreaterThan(0);
      const blocks = payload.blocks as Block[];
      // header + context + summary + >=1 kind + actions
      expect(blocks.length, `#${e.pr}`).toBeGreaterThanOrEqual(5);
      // Slack rejects a header over 150 characters.
      expect(
        (blocks[0].text?.text ?? "").length,
        `#${e.pr} header`,
      ).toBeLessThanOrEqual(150);
      // And a section's text over 3000.
      for (const b of blocks) {
        expect((b.text?.text ?? "").length, `#${e.pr} section`).toBeLessThan(
          3000,
        );
      }
    }
  });
});
