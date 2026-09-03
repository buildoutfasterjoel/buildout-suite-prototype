import { createServerFn } from "@tanstack/react-start";
import { chat } from "@tanstack/ai";
import { createAnthropicChat } from "@tanstack/ai-anthropic";
import { fieldTextFallback, fieldTextPrompt, type FieldTextRequest } from "./fieldText";

/** Same interactive model as the rail — fast, and this is a one-shot rewrite. */
const MODEL = "claude-sonnet-5";

/**
 * Stream one field's text as plain UTF-8, one delta per chunk.
 *
 * Its own relay rather than a mode of `aiChat`: that one speaks AG-UI over SSE
 * to `useChat`, carries the tool set and the transcript, and lands its output
 * in the rail. This has no transcript, no tools and no rail — the whole point
 * of the inline bar is that a field's writing never enters the conversation —
 * so all it needs is a body the client can read with `getReader()`.
 *
 * Without a server key it streams `fieldTextFallback` word by word, flagged in
 * a header, so the interaction can still be walked through in a demo.
 */
export const aiFieldText = createServerFn({ method: "POST" })
  .validator((data: FieldTextRequest) => data)
  .handler(async ({ data }) => {
    const encoder = new TextEncoder();
    const headers = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      const words = fieldTextFallback(data).split(/(?<=\s)/);
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const word of words) {
            if (cancelled) return;
            controller.enqueue(encoder.encode(word));
            await new Promise((r) => setTimeout(r, 45));
          }
          controller.close();
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(body, { headers: { ...headers, "X-Field-Text": "fallback" } });
    }

    const { system, user } = fieldTextPrompt(data);
    const stream = chat({
      adapter: createAnthropicChat(MODEL, apiKey),
      systemPrompts: [system],
      messages: [{ role: "user", content: user }] as never,
    }) as AsyncIterable<{ type: string; delta?: string; message?: string }>;

    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // The reader went away (Stop, or the page left). Stop pulling from
            // the model rather than finishing a reply nobody will read.
            if (cancelled) return;
            if (chunk.type === "TEXT_MESSAGE_CONTENT" && chunk.delta) {
              controller.enqueue(encoder.encode(chunk.delta));
            } else if (chunk.type === "RUN_ERROR") {
              throw new Error(chunk.message ?? "The model returned an error.");
            }
          }
          controller.close();
        } catch (e) {
          if (!cancelled) controller.error(e);
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(body, { headers });
  });
