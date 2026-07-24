import { useEffect, useRef, useState } from "react";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlaneTop, faComments } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { addDealMessage } from "#/data/store";
import { CURRENT_USER } from "#/data/teammates";
import { initials, formatDateTime } from "./dealDisplay";
import type { DealMessage } from "#/data/types";

/** One chat row — current user's own messages align right in a tinted bubble. */
function MessageRow({ message }: { message: DealMessage }) {
  const mine = message.author === CURRENT_USER.name;
  if (mine) {
    return (
      <div className="d-flex flex-column align-items-end">
        <div
          className="px-3 py-2 bg-primary-subtle text-body"
          style={{ maxWidth: "85%", borderRadius: 12 }}
        >
          {message.text}
        </div>
        <div className="text-muted fs-small mt-1">
          {formatDateTime(message.timestamp)}
        </div>
      </div>
    );
  }
  return (
    <div className="d-flex align-items-start gap-2">
      <Avatar size="sm" className="flex-shrink-0 mt-1">
        <Avatar.Fallback>{initials(message.author)}</Avatar.Fallback>
      </Avatar>
      <div style={{ minWidth: 0, maxWidth: "85%" }}>
        <div className="d-flex align-items-baseline gap-2">
          <span className="fw-semibold text-truncate">{message.author}</span>
          <span className="text-muted fs-small flex-shrink-0">
            {formatDateTime(message.timestamp)}
          </span>
        </div>
        <div
          className="px-3 py-2 bg-body-secondary text-body mt-1"
          style={{ borderRadius: 12 }}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}

/**
 * Right-hand "Messages" rail on the Activities tab — a per-deal chat thread with
 * a composer pinned to the bottom. Reads messages reactively so sends appear at
 * once and survive reloads (persisted through addDealMessage).
 */
export function DealMessagesRail({ listingId }: { listingId: string }) {
  const messages =
    useDataStore((s) => s.listings.get(listingId)?.messages) ?? [];
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    addDealMessage(listingId, { author: CURRENT_USER.name, text });
    setDraft("");
  };

  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="px-3 py-3 border-bottom">
        <h6 className="mb-0 fw-semibold">Messages</h6>
      </div>

      <div
        ref={listRef}
        className="flex-grow-1 overflow-y-auto d-flex flex-column gap-3 p-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <Empty className="py-6">
            <Empty.Media>
              <FontAwesomeIcon icon={faComments} aria-hidden />
            </Empty.Media>
            <Empty.Content>
              <Empty.Title>No messages yet</Empty.Title>
              Start the conversation for this deal.
            </Empty.Content>
          </Empty>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>

      <div className="p-3 border-top">
        <InputGroup>
          <Input
            placeholder="Type a message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            variant="primary"
            onClick={send}
            disabled={!draft.trim()}
            aria-label="Send message"
          >
            <FontAwesomeIcon icon={faPaperPlaneTop} />
          </Button>
        </InputGroup>
      </div>
    </div>
  );
}
