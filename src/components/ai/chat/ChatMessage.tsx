import type { ReactNode } from "react";
import type { UIMessage } from "@tanstack/ai-react";
import { MarkdownMessage } from "./MarkdownMessage";
import { ToolChip } from "./ToolChip";

/** A message's tool-call parts, as `useChat` shapes them. */
export type ToolCallPart = Extract<UIMessage["parts"][number], { type: "tool-call" }>;

/** Concatenate a message's text parts. */
export function messageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.content)
    .join("");
}

/** A message's tool-call parts, in order. */
export function messageToolCalls(message: UIMessage): ToolCallPart[] {
  return message.parts.filter((p): p is ToolCallPart => p.type === "tool-call");
}

/**
 * One chat turn, rendered. Presentation only — every decision about *which*
 * tool calls become chips and which become rich cards belongs to the calling
 * surface, which passes `chipCalls` and puts its cards in `children`.
 *
 * Modern-chat convention, shared by the app-wide rail and the editor's Otto
 * panel: the broker's turn is a grey bubble, the assistant's is unadorned text
 * across the full width. See `.assistant-bubble--user` (Figma node 5:29).
 */
export function ChatMessage({
  message,
  chipCalls,
  showText,
  labels,
  children,
}: {
  message: UIMessage;
  chipCalls: ToolCallPart[];
  showText: boolean;
  labels?: Record<string, string>;
  children?: ReactNode;
}) {
  const isUser = message.role === "user";
  const text = messageText(message);

  return (
    // 12px between the pieces of a single reply — the text, its tool chips, and
    // whatever cards came back (Figma node 193:4684). The space that separates
    // one turn from the next belongs to the flow, not to the turn.
    //
    // `data-chat-role` is what lets the flow tell a change of speaker from a
    // continuation: the transcript sits everything 12px apart and adds another
    // 12 across a speaker boundary, in CSS, off the adjacent sibling. Done in
    // CSS rather than by computing each message's margin in the map, because a
    // message that renders nothing (narration the rail suppresses) returns null
    // and is simply not a sibling — so the rule reads the *visible* order for
    // free, where a computed margin would have to re-derive which turns drew.
    <div className="d-flex flex-column" style={{ gap: 12 }} data-chat-role={isUser ? "user" : "assistant"}>
      {(showText || chipCalls.length > 0) && (
        <div className={`d-flex ${isUser ? "justify-content-end" : "justify-content-start"}`}>
          <div className={isUser ? "assistant-bubble--user" : "text-body w-100"}>
            {showText &&
              (isUser ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
              ) : (
                <MarkdownMessage content={text} />
              ))}
            {chipCalls.length > 0 && (
              <div className="d-flex flex-wrap gap-2 mt-2">
                {chipCalls.map((p, i) => (
                  <ToolChip key={i} name={p.name} running={p.output === undefined} labels={labels} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
