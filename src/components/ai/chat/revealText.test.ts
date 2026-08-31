import { describe, expect, it } from "vitest";
import { advanceReveal, BASE_CHARS_PER_SEC, sliceToWord } from "./revealText";

describe("advanceReveal", () => {
  it("never overshoots the text that has actually arrived", () => {
    expect(advanceReveal(0, 10, 10_000)).toBe(10);
  });

  it("stays put once everything is revealed", () => {
    expect(advanceReveal(500, 500, 16)).toBe(500);
    expect(advanceReveal(600, 500, 16)).toBe(500);
  });

  it("moves at roughly the measured streaming rate on a small backlog", () => {
    // A 500-char backlog drains at 500/3 ≈ 167 per second, which is under the
    // base rate — so the base rate governs and a 100ms frame should advance
    // about a tenth of it. (Give it a large backlog instead and catch-up takes
    // over, which is the next test.)
    const after = advanceReveal(0, 500, 100);
    expect(after).toBeCloseTo(BASE_CHARS_PER_SEC / 10, 0);
  });

  it("reveals a big buffered dump faster than a trickle", () => {
    const trickle = advanceReveal(0, 100, 100);
    const dump = advanceReveal(0, 5000, 100);
    expect(dump).toBeGreaterThan(trickle);
  });

  it("eases off as it catches up, rather than staying at full speed", () => {
    const early = advanceReveal(0, 3000, 100) - 0;
    const late = advanceReveal(2900, 3000, 100) - 2900;
    expect(early).toBeGreaterThan(late);
  });

  it("always advances, even on a tiny frame", () => {
    expect(advanceReveal(0, 1000, 0)).toBeGreaterThan(0);
  });

  it("finishes a long buffered reply in a few seconds, not a crawl", () => {
    // A 1,500-character reply is a typical buffered Otto answer. At the base
    // rate alone this would take ~8s; the catch-up curve has to beat that.
    let revealed = 0;
    let elapsed = 0;
    while (revealed < 1500 && elapsed < 30_000) {
      revealed = advanceReveal(revealed, 1500, 16);
      elapsed += 16;
    }
    expect(revealed).toBe(1500);
    expect(elapsed).toBeLessThan(6000);
  });

  it("converges rather than inching forever at the tail", () => {
    let revealed = 999;
    let steps = 0;
    while (revealed < 1000 && steps < 1000) {
      revealed = advanceReveal(revealed, 1000, 16);
      steps++;
    }
    expect(revealed).toBe(1000);
  });
});

describe("sliceToWord", () => {
  it("returns the whole text once the reveal reaches the end", () => {
    expect(sliceToWord("hello world", 11)).toBe("hello world");
    expect(sliceToWord("hello world", 99)).toBe("hello world");
  });

  it("cuts back to the last word boundary rather than mid-word", () => {
    expect(sliceToWord("hello world again", 8)).toBe("hello");
  });

  it("holds back a partial first word instead of showing a fragment", () => {
    expect(sliceToWord("commercial real estate", 4)).toBe("");
  });

  it("keeps a completed word as soon as its boundary is passed", () => {
    expect(sliceToWord("one two three", 4)).toBe("one");
  });

  it("never returns more than it was asked for, up to the boundary", () => {
    const out = sliceToWord("alpha beta gamma delta", 12);
    expect(out.length).toBeLessThanOrEqual(12);
    expect("alpha beta gamma delta".startsWith(out)).toBe(true);
  });
});
