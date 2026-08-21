import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faSparkles,
  faTable,
  faPenLine,
  faMapLocationDot,
  faArrowRotateLeft,
} from "@fortawesome/pro-regular-svg-icons";
// Solid, deliberately, and for the same reason as the app-wide rail: the mark's
// glyph is a silhouette on a pale tile, and the regular weight reads as a
// hairline outline at 14px.
import { faOtter } from "@fortawesome/pro-solid-svg-icons";
import { useChat, type UIMessage } from "@tanstack/ai-react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { aiChat, aiConfigured } from "#/ai/relay";
import {
  ChatMessage,
  messageText,
  messageToolCalls,
} from "#/components/ai/chat/ChatMessage";
import { ChatComposer } from "#/components/ai/chat/ChatComposer";
import { useVoice } from "#/ai/voice/useVoice";
import { useHandsFree } from "#/ai/voice/useHandsFree";
import { voiceEngine } from "#/ai/voice/voiceEngine";
import { useEditorStore } from "../store";
import { createEditorTools } from "../ai/editorTools";
import { EDITOR_TOOL_LABELS } from "../ai/editorToolDefs";
import { buildEditorContext, serializeEditorContext } from "../ai/documentContext";
import { useOttoThread } from "./ottoThread";

/** Shown instead of sending when the server has no Anthropic key configured. */
const NOT_CONFIGURED_MESSAGE =
  "I'm not configured — the server has no API key — so I can't make changes right now.";

/**
 * Opening asks. Every one maps to a tool that actually runs — no starter
 * advertises a capability the agent doesn't have, which is why the old
 * "match the listing's brand colors" row is gone: styling is out of scope,
 * so that chip could only ever produce an apology.
 */
const STARTERS: { icon: IconDefinition; label: string; prompt: string }[] = [
  {
    icon: faPenLine,
    label: "Tighten the copy on this page",
    prompt: "Tighten the copy on this page.",
  },
  {
    icon: faTable,
    label: "Add a rent roll table",
    prompt: "Add a rent roll table to this page.",
  },
  {
    icon: faMapLocationDot,
    label: "Add a location page with a map",
    prompt: "Add a location page with a map.",
  },
];

/**
 * The Otto rail tab — a chat surface for editing the open document by asking.
 *
 * Same architecture as the app-wide assistant rail: `useChat` against the
 * `aiChat` relay, which holds the Anthropic key server-side, with the tool
 * calls streaming back to run in the browser against `useEditorStore` (see
 * `../ai/editorTools.ts`). The document never leaves the client except as the
 * context snapshot folded into the system prompt.
 *
 * It fills the panel top to bottom with its own scroll region so the composer
 * stays pinned to the bottom edge, which is why `PropertiesPanel` renders it
 * outside the shared `.bo-editor-panel-scroll` wrapper the other panels sit in.
 */
export function OttoPanel() {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const setStoredMessages = useOttoThread((s) => s.setMessages);
  const resetThread = useOttoThread((s) => s.reset);

  // Names what an ask would act on. Falls back to the first page before the
  // canvas has reported anything in view.
  const pageName = useEditorStore(
    (s) =>
      s.document.pages.find((p) => p.id === s.activePageId)?.name ??
      s.document.pages[0]?.name,
  );

  const tools = useMemo(() => createEditorTools(), []);

  const fetcher = useCallback(
    (
      {
        messages,
        resume,
        threadId,
        runId,
        parentRunId,
      }: {
        messages: Array<UIMessage>;
        resume?: unknown[];
        threadId: string;
        runId: string;
        parentRunId?: string;
      },
      { signal }: { signal: AbortSignal },
    ) =>
      aiChat({
        data: {
          messages,
          context: serializeEditorContext(buildEditorContext()),
          toolset: "editor",
          // All three forwarded, not dropped. A client tool arrives as an
          // interrupt: `resume` carries the tool's result back, and the ids let
          // the server stamp the interrupt with the run the client is actually
          // tracking — without them the run is unresumable and parks forever.
          resume,
          threadId,
          runId,
          parentRunId,
        },
        signal,
      }),
    [],
  );

  // Seeded once, non-reactively, from the surviving thread — so switching
  // rail tabs or selecting a block doesn't wipe the conversation, and the
  // very first paint of a remount already has it (no one-frame flash of the
  // empty/starter view while an effect catches up).
  const { messages, sendMessage, setMessages, isLoading, stop } = useChat({
    fetcher,
    tools,
    initialMessages: useOttoThread.getState().messages,
  });

  // Write back as the thread grows. Nothing seeds `messages` after mount, so
  // there's no ref-flip or ordering to race: this always writes whatever the
  // live transcript actually is.
  useEffect(() => {
    setStoredMessages(messages);
  }, [messages, setStoredMessages]);

  /**
   * Checked once (and cached) so the panel never hands `useChat` a stream from
   * an unconfigured server. `null` = not checked yet; an erroring check fails
   * open (treated as configured) so a flaky check doesn't block a working agent.
   */
  const configuredRef = useRef<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void aiConfigured()
      .then((res) => {
        if (!cancelled) configuredRef.current = res.configured;
      })
      .catch(() => {
        if (!cancelled) configuredRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || isLoading) return;
      setDraft("");

      if (configuredRef.current === false) {
        const stamp = Date.now();
        setMessages([
          ...messages,
          { id: `local-${stamp}-user`, role: "user", parts: [{ type: "text", content }] },
          {
            id: `local-${stamp}-assistant`,
            role: "assistant",
            parts: [{ type: "text", content: NOT_CONFIGURED_MESSAGE }],
          },
        ]);
        return;
      }

      void sendMessage(content);
    },
    [isLoading, messages, sendMessage, setMessages],
  );

  /**
   * Dictation. The mic transcribes into the composer and submits through the
   * same `send` a typed ask uses, so voice and typing share one path.
   *
   * Unlike the app-wide rail this never speaks Otto's reply back: the broker is
   * watching the canvas change while it answers, so a spoken confirmation would
   * narrate over the thing it is describing.
   */
  const listening = useVoice((s) => s.listening);
  const { start: startHandsFree, stop: stopHandsFree } = useHandsFree({
    onSubmit: (text) => send(text),
  });

  const reset = useCallback(() => {
    resetThread();
    setMessages([]);
  }, [resetThread, setMessages]);

  // Keep the newest turn in view as the thread grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const empty = messages.length === 0;

  return (
    <div className="bo-editor-otto">
      {/* The otter is gradient-filled in the design, which an SVG icon can't
          express in CSS, so its `fill` points at this def (see editor.scss).
          The panel renders its own rather than borrowing the rail's: that one
          lives inside `AssistantSidebar`, which returns null while the rail is
          closed — which it always is here. A distinct id, so the two never
          collide when both surfaces are mounted. Zero-sized and aria-hidden: it
          paints nothing itself. */}
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="position-absolute">
        <linearGradient id="otto-glyph-gradient-editor" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9f55f7" />
          <stop offset="100%" stopColor="#360764" />
        </linearGradient>
      </svg>

      <div className="bo-editor-otto-head">
        <span className="bo-editor-otto-mark">
          <FontAwesomeIcon icon={faOtter} />
        </span>
        <span className="flex-grow-1" style={{ minWidth: 0 }}>
          <span className="bo-editor-subsection-title d-block">Otto</span>
          {pageName && (
            <span className="bo-editor-otto-context d-block text-truncate">
              Editing {pageName}
            </span>
          )}
        </span>
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon"
                onClick={reset}
                disabled={empty}
                aria-label="Clear conversation"
              >
                <FontAwesomeIcon icon={faArrowRotateLeft} />
              </Button>
            }
          />
          <Tooltip.Content>Clear conversation</Tooltip.Content>
        </Tooltip>
      </div>

      <div className="bo-editor-otto-scroll" ref={scrollRef}>
        {empty ? (
          <div className="d-flex flex-column gap-3">
            <p className="bo-editor-otto-intro mb-0">
              Ask for a change to this document and I&apos;ll make it — rewrite a
              block, add a table, build a new page.
            </p>
            <div className="d-flex flex-column gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  className="bo-editor-otto-starter"
                  onClick={() => send(starter.prompt)}
                >
                  <span className="bo-editor-otto-starter-icon">
                    <FontAwesomeIcon icon={starter.icon} />
                  </span>
                  <span className="flex-grow-1 text-start">{starter.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {messages.map((m) => {
              const toolCalls = messageToolCalls(m);
              const text = messageText(m);
              if (!text && toolCalls.length === 0) return null;
              return (
                <ChatMessage
                  key={m.id}
                  message={m}
                  chipCalls={toolCalls}
                  showText={!!text}
                  labels={EDITOR_TOOL_LABELS}
                />
              );
            })}
            {isLoading && (
              <span className="bo-editor-otto-thinking">
                <FontAwesomeIcon icon={faSparkles} beatFade />
                Thinking…
              </span>
            )}
          </div>
        )}
      </div>

      <div className="bo-editor-otto-composer">
        <ChatComposer
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => send(draft)}
          isLoading={isLoading}
          onStop={stop}
          placeholder="Ask Otto to change this doc…"
          listening={listening}
          onMicToggle={() => {
            if (listening) {
              // The recognizer lives in useHandsFree; cancel() only silences
              // speech synthesis, so without stopHandsFree() the mic stays hot.
              stopHandsFree();
              voiceEngine.cancel();
            } else {
              // Dictation only — deliberately no `enableVoiceForMic()` and no
              // conversation mode. In the rail those make Otto read its reply
              // back; here the broker is watching the canvas change, so spoken
              // confirmations would be narration over the thing being narrated.
              startHandsFree();
            }
          }}
          micLabel={{ idle: "Dictate to Otto", live: "Listening — tap to stop" }}
        />
      </div>
    </div>
  );
}
