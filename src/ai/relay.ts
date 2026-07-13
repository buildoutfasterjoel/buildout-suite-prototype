import { createServerFn } from "@tanstack/react-start";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { TOOL_DEFS } from "./toolDefs";
import { SYSTEM_PROMPT } from "./systemPrompt";

/**
 * Interactive-loop model. Sonnet is fast + cheap + strong at tool use; swap to
 * "claude-opus-4-8" for maximum capability (the adapter just forwards the string).
 */
const MODEL = "claude-sonnet-5";

/**
 * Stateless stream-relay: holds the Anthropic key server-side and relays a
 * streamed chat response. Tools are passed as definitions only (no server
 * execute), so Claude's tool calls stream back to the browser, which runs them
 * against the local store (see src/ai/tools.ts) — no data ever leaves the client.
 *
 * Returned as a raw `Response` (SSE), which TanStack Start passes through
 * untouched. The client wires this to `useChat`'s `fetcher`.
 */
export const aiChat = createServerFn({ method: "POST" })
  .validator((data: { messages: unknown[] }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response("ANTHROPIC_API_KEY is not set on the server.", {
        status: 500,
      });
    }

    const stream = chat({
      adapter: createAnthropicChat(MODEL, apiKey),
      systemPrompts: [SYSTEM_PROMPT],
      messages: data.messages as never,
      tools: TOOL_DEFS,
    });

    return toServerSentEventsResponse(stream);
  });
