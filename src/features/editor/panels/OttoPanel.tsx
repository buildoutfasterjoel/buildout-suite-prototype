import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faSparkles,
  faPaperPlaneTop,
  faTable,
  faPenLine,
  faPalette,
  faArrowRotateLeft,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { useEditorStore } from "../store";
import { useOttoChat, type OttoMessage } from "./ottoChat";

/** Opening asks, phrased as the document edits the agent will eventually make. */
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
    icon: faPalette,
    label: "Match the listing's brand colors",
    prompt: "Restyle this page to match the listing's brand colors.",
  },
];

/**
 * The Otto rail tab — a chat surface for editing the open document by asking.
 *
 * This pass is the shell only: the composer and starters are real, but every
 * ask gets the same placeholder reply (see `ottoChat.ts`). It fills the panel
 * top to bottom with its own scroll region so the composer stays pinned to the
 * bottom edge, which is why `PropertiesPanel` renders it outside the shared
 * `.bo-editor-panel-scroll` wrapper the other panels sit in.
 */
export function OttoPanel() {
  const [draft, setDraft] = useState("");
  const messages = useOttoChat((s) => s.messages);
  const pending = useOttoChat((s) => s.pending);
  const send = useOttoChat((s) => s.send);
  const reset = useOttoChat((s) => s.reset);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Names what an ask would act on. Falls back to the first page before the
  // canvas has reported anything in view.
  const pageName = useEditorStore(
    (s) =>
      s.document.pages.find((p) => p.id === s.activePageId)?.name ??
      s.document.pages[0]?.name,
  );

  // Keep the newest turn in view as the thread grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending]);

  const empty = messages.length === 0;

  return (
    <div className="bo-editor-otto">
      <div className="bo-editor-otto-head">
        <span className="bo-editor-otto-mark">
          <FontAwesomeIcon icon={faSparkles} />
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
              block, add a table, restyle a page.
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
            {messages.map((m) => (
              <OttoBubble key={m.id} message={m} />
            ))}
            {pending && (
              <span className="bo-editor-otto-thinking">
                <FontAwesomeIcon icon={faSparkles} beatFade />
                Thinking…
              </span>
            )}
          </div>
        )}
      </div>

      <form
        className="bo-editor-otto-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
          setDraft("");
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Otto to change this doc…"
          aria-label="Message Otto"
          // Without this the browser offers its own form-history dropdown over
          // the canvas the moment the composer takes focus.
          autoComplete="off"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          aria-label="Send"
          disabled={!draft.trim() || pending}
        >
          <FontAwesomeIcon icon={faPaperPlaneTop} />
        </Button>
      </form>
    </div>
  );
}

/**
 * Modern-chat convention, matching the app-wide assistant rail: the broker's
 * turn is a grey bubble, Otto's is unadorned text across the full width.
 */
function OttoBubble({ message }: { message: OttoMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`d-flex ${isUser ? "justify-content-end" : "justify-content-start"}`}>
      <div className={isUser ? "bo-editor-otto-bubble" : "bo-editor-otto-reply"}>
        {message.text}
      </div>
    </div>
  );
}
