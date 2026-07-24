import { chat } from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import type { ZodType } from "zod";

export const AI_MODEL = "claude-sonnet-5";
export const AI_MODEL_REASONING = "claude-opus-4-8";

/**
 * Server-side one-shot structured generation. Holds the Anthropic key, runs a
 * single `chat({ outputSchema })` turn, and NEVER throws: a missing key or any
 * provider/parse error resolves to the caller's deterministic `fallback()`.
 */
export async function runGenerator<T>(opts: {
  model?: string;
  system: string;
  user: string;
  schema: ZodType<T>;
  fallback: () => T;
}): Promise<T> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return opts.fallback();
  try {
    const result = await chat({
      adapter: createAnthropicChat(
        (opts.model ?? AI_MODEL) as typeof AI_MODEL,
        apiKey,
      ),
      systemPrompts: [opts.system],
      messages: [{ role: "user", content: opts.user }] as never,
      outputSchema: opts.schema as never,
    });
    return result as T;
  } catch {
    return opts.fallback();
  }
}
