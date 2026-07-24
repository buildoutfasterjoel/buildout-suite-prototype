import { describe, it, expect } from "vitest";
import { prepForSpeech } from "./textPrep";

describe("prepForSpeech", () => {
  it("strips HTML tags", () => {
    expect(prepForSpeech("<strong>Call</strong> Marcus now")).toBe("Call Marcus now");
  });

  it("decodes HTML entities to real characters", () => {
    expect(prepForSpeech("It&#39;s Marcus&rsquo;s deal &amp; more")).toBe("It's Marcus's deal & more");
  });

  it("collapses whitespace left by stripped tags", () => {
    expect(prepForSpeech("<p>Hi</p>\n<p>there</p>")).toBe("Hi there");
  });

  it("caps on a sentence boundary at or before the limit", () => {
    const text = "One sentence here. Two sentence here. Three runs over the cap now.";
    const out = prepForSpeech(text, 40);
    expect(out).toBe("One sentence here. Two sentence here.");
  });

  it("hard-truncates when no sentence boundary exists before the cap", () => {
    const out = prepForSpeech("wordwordwordwordwordwordword", 10);
    expect(out.length).toBeLessThanOrEqual(10);
  });
});
