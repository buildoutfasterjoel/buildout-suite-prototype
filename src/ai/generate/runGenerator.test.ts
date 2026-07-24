import { describe, it, expect, afterEach } from "vitest";
// NOTE: default import is intentional — see src/ai/generate/schemas.ts for why
// the named `import { z } from "zod"` resolves to undefined under this repo's
// Vitest module runner.
import z from "zod";
import { runGenerator } from "./runGenerator";

const prev = process.env.ANTHROPIC_API_KEY;
afterEach(() => { process.env.ANTHROPIC_API_KEY = prev; });

describe("runGenerator", () => {
  it("returns fallback when no key is set", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const schema = z.object({ answer: z.string() });
    const out = await runGenerator({
      system: "s", user: "u", schema,
      fallback: () => ({ answer: "FALLBACK" }),
    });
    expect(out.answer).toBe("FALLBACK");
  });
});
