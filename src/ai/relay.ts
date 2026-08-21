import { createServerFn } from "@tanstack/react-start";
import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { TOOL_DEFS } from "./toolDefs";
import { buildSystemPrompt } from "./systemPrompt";
import { EDITOR_TOOL_DEFS } from "#/features/editor/ai/editorToolDefs";
import { buildEditorSystemPrompt } from "#/features/editor/ai/editorSystemPrompt";

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
 * `toolset` (see the validator below) picks which of the two agents is asking.
 *
 * Returned as a raw `Response` (SSE), which TanStack Start passes through
 * untouched. The client wires this to `useChat`'s `fetcher`.
 */
export const aiChat = createServerFn({ method: "POST" })
  .validator(
    (data: {
      messages: unknown[];
      context?: string;
      /**
       * Which agent is asking. `"suite"` (the default) is the CRM assistant in
       * the app-wide rail; `"editor"` is the document agent in the editor's Otto
       * panel. One relay serves both because what differs between them is the
       * prompt and the tool set — data, not plumbing — while the key read, the
       * not-configured backstop, and the SSE response shape are worth having in
       * exactly one place.
       */
      toolset?: "suite" | "editor";
      /**
       * AG-UI interrupt resume payload. A client tool arrives as an interrupt:
       * the browser runs the tool, then resumes the run with its result, and
       * THAT is the request the model's follow-up comes back on. Dropping this
       * is why a tool call used to execute and then go silent — the result
       * never reached the model, so it never confirmed and the next ask failed
       * with "cannot send normal input while pending interrupts exist".
       */
      resume?: unknown[];
      /**
       * The client's own AG-UI ids. These MUST be forwarded: a paused run is
       * only resumable when the interrupt's binding carries the same
       * `interruptedRunId` the client is tracking. Let `chat()` auto-generate
       * its own and the ids disagree, so the client marks the interrupt
       * unresolvable ("invalid-response-schema") and the turn parks forever.
       */
      threadId?: string;
      runId?: string;
      /**
       * The run the interrupt paused. Required on a resume: without it the
       * engine raises "Interrupt continuation requires parentRunId to identify
       * the interrupted run" and the tool result is discarded.
       */
      parentRunId?: string;
    }) => data,
  )
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

    const editor = data.toolset === "editor";

    const stream = chat({
      adapter: createAnthropicChat(MODEL, apiKey),
      systemPrompts: [editor ? buildEditorSystemPrompt(data.context) : buildSystemPrompt(data.context)],
      messages: data.messages as never,
      tools: editor ? EDITOR_TOOL_DEFS : TOOL_DEFS,
      ...(data.resume ? { resume: data.resume as never } : {}),
      ...(data.threadId ? { threadId: data.threadId } : {}),
      ...(data.runId ? { runId: data.runId } : {}),
      ...(data.parentRunId ? { parentRunId: data.parentRunId } : {}),
    });

    return toServerSentEventsResponse(stream);
  });
