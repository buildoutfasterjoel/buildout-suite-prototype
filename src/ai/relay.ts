import { createServerFn } from "@tanstack/react-start";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { TOOL_DEFS } from "./toolDefs";
import { buildSystemPrompt } from "./systemPrompt";

/**
 * Interactive-loop model. Sonnet is fast + cheap + strong at tool use; swap to
 * "claude-opus-4-8" for maximum capability (the adapter just forwards the string).
 */
const MODEL = "claude-sonnet-5";

/**
 * Lets the client check, before starting a chat run, whether the server has
 * an Anthropic key configured — without ever exposing the key itself. The
 * client uses this to short-circuit gracefully (see `AssistantSidebar`)
 * instead of handing `useChat` a malformed/empty stream.
 */
export const aiConfigured = createServerFn({ method: "GET" }).handler(async () => ({
  configured: Boolean(process.env.ANTHROPIC_API_KEY),
}));

/**
 * Stateless stream-relay: holds the Anthropic key server-side and relays a
 * streamed chat response. Tools are passed as definitions only (no server
 * execute), so Claude's tool calls stream back to the browser, which runs them
 * against the local store (see src/ai/tools.ts) — no data ever leaves the client.
 *
 * `context` is a compact JSON snapshot of the broker's live data (see
 * `src/ai/context.ts`) that gets folded into the system prompt so the agent
 * answers from real numbers instead of guessing.
 *
 * Returned as a raw `Response` (SSE), which TanStack Start passes through
 * untouched. The client wires this to `useChat`'s `fetcher`.
 */
export const aiChat = createServerFn({ method: "POST" })
  .validator((data: { messages: unknown[]; context?: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Backstop only — the client checks `aiConfigured` before ever calling
      // this fn, so this branch shouldn't normally be reached. Returned as a
      // benign non-streaming Response (not a 500, and not a fake SSE frame)
      // since this library's terminal-of-stream protocol isn't a bare
      // `data: [DONE]` sentinel — `useChat` wouldn't recognize one anyway.
      return new Response("ANTHROPIC_API_KEY is not set on the server.", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const stream = chat({
      adapter: createAnthropicChat(MODEL, apiKey),
      systemPrompts: [buildSystemPrompt(data.context)],
      messages: data.messages as never,
      tools: TOOL_DEFS,
    });

    return toServerSentEventsResponse(stream);
  });
