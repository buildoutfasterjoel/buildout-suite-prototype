import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlaneTop, faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import { ChatSection } from "#/components/ai/chat/ChatSection";

export type SentEmailData = {
  subject: string;
  to: string;
  contactId: string;
  contactName: string;
  /** The email as sent, held back behind "Show Content". */
  body?: string;
  /** ISO timestamp stamped by `send_email` at the moment it went out. */
  sentAt?: string;
};

/** "Sent Jul 25, 2:40 PM" — the design's meta line, from an ISO stamp. */
function sentStamp(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `Sent ${date}, ${time}`;
}

/**
 * Receipt for an email Otto sent (Figma node 193:9445).
 *
 * Sending is the one irreversible thing the assistant does, so the moment it
 * lands it gets its own section — but the moment after that it's *past work*,
 * and past work in this rail is de-emphasised. So this is deliberately not a
 * card: a hairline rule down the left edge, the header muted rather than
 * gradient, and the body folded behind "Show Content". What's left in view is
 * what the broker actually needs to confirm — who it went to, when, and the way
 * through to the record where it now sits on the timeline.
 */
export function SentEmailCard({ sent }: { sent: SentEmailData }) {
  const router = useRouter();
  const [showBody, setShowBody] = useState(false);
  const stamp = sentStamp(sent.sentAt);
  const first = sent.contactName.split(" ")[0];

  return (
    <ChatSection label="Sent Email">
      <div className="assistant-sent">
        <div className="assistant-sent__header">
          <span className="assistant-sent__eyebrow">Email to {first}</span>
          <FontAwesomeIcon icon={faPaperPlaneTop} className="assistant-sent__glyph" />
          {stamp && <span className="assistant-sent__meta">{stamp}</span>}
        </div>

        <div className="d-flex flex-column gap-2 align-items-start">
          <div className="assistant-sent__subject">{sent.subject}</div>
          <div className="assistant-sent__to">
            To: {sent.contactName} &lt;{sent.to}&gt;
          </div>

          {sent.body && (
            <>
              <button
                type="button"
                className="assistant-sent__toggle"
                aria-expanded={showBody}
                onClick={() => setShowBody((v) => !v)}
              >
                {showBody ? "Hide Content" : "Show Content"}
              </button>
              {showBody && <div className="assistant-sent__body">{sent.body}</div>}
            </>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              router.navigate({
                to: "/backoffice/contacts/$contactId",
                params: { contactId: sent.contactId },
              })
            }
          >
            View {first}
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          </Button>
        </div>
      </div>
    </ChatSection>
  );
}
