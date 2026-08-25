import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilePen, faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import { findContactForRecipient } from "#/data/store";
import { useComposeFocus } from "#/components/contacts/useComposeFocus";
import { ChatSection } from "#/components/ai/chat/ChatSection";

export interface EmailDraftCardData {
  id: string;
  subject: string;
  to: string[];
  body: string;
  signature: string;
}

/** The first name in "Rosa Delgado <rosa@…>", for the "EMAIL TO ROSA" eyebrow. */
function recipientFirstName(to: string[]): string | null {
  const first = to[0];
  if (!first) return null;
  const name = first.split("<")[0].trim();
  if (!name) return null;
  return name.split(/\s+/)[0];
}

/**
 * The draft itself (Figma node 193:5905) — a grey slab carrying a gradient
 * "EMAIL TO ROSA" eyebrow, a version badge, the subject over its recipient chip,
 * and the body.
 *
 * Presentation only, and deliberately actionless: the same object appears inside
 * the chat rail's collapsible section, inside a marketing package, and on the
 * listing page's own draft panel, and each of those owns a different set of
 * things to do with it.
 */
export function EmailDraftObject({
  draft,
  version = 1,
}: {
  draft: EmailDraftCardData;
  /** 1 for the first draft, 2+ after a revision — shown as "Draft v2". */
  version?: number;
}) {
  const first = recipientFirstName(draft.to);
  return (
    <div className="assistant-email">
      <div className="assistant-email__header">
        <span className="assistant-email__eyebrow">
          {first ? `Email to ${first}` : "Email draft"}
        </span>
        <FontAwesomeIcon icon={faFilePen} className="assistant-email__glyph" />
        <span className="assistant-email__badge">
          {version > 1 ? `Draft v${version}` : "Draft"}
        </span>
      </div>

      <div className="d-flex flex-column gap-2">
        <div className="assistant-email__subject">{draft.subject}</div>
        {draft.to.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="assistant-email__to-label">To:</span>
            {draft.to.map((line) => (
              <span key={line} className="assistant-email__chip">
                {line}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="assistant-email__body">
        {draft.body}
        {draft.signature ? `\n\n${draft.signature}` : ""}
      </div>
    </div>
  );
}

/**
 * Where "Open in Email" goes depends on whether this is a note to one person or
 * a send to a list. A recipient we can match to a contact means the former, and
 * the right destination is that contact's own composer — the Email module is the
 * campaign surface, and landing there for a one-off left the broker to rebuild a
 * draft that already existed.
 */
function OpenInEmailButton({
  draft,
  label = "Open in Email",
}: {
  draft: EmailDraftCardData;
  label?: string;
}) {
  const router = useRouter();
  const recipient = draft.to.map(findContactForRecipient).find(Boolean);

  if (!recipient) {
    return (
      <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/email" />}>
        {label}
        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        // Raise the draft before navigating: the composer reads the signal in an
        // effect on mount, so it's already waiting when the page arrives — and
        // the contact guard keeps it from landing anywhere else if navigation is
        // interrupted.
        useComposeFocus.getState().requestEmailDraft({
          contactId: recipient.id,
          subject: draft.subject,
          body: draft.body,
        });
        router.navigate({
          to: "/backoffice/contacts/$contactId",
          params: { contactId: recipient.id },
        });
      }}
    >
      {label}
      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
    </Button>
  );
}

/**
 * A generated draft outside the chat rail — the listing page's "Draft with AI"
 * panel and the marketing package. No section header and no quick replies: those
 * surfaces have no conversation to reply into, so the only move is to take the
 * draft to a composer.
 */
export function EmailDraftCard({ draft }: { draft: EmailDraftCardData }) {
  return (
    <div className="d-flex flex-column gap-3">
      <EmailDraftObject draft={draft} />
      <div>
        <OpenInEmailButton draft={draft} />
      </div>
    </div>
  );
}

/**
 * The draft as it lands in Otto's rail (Figma node 193:5894): a collapsible
 * section header, the draft object, one line saying what was done, and the row
 * of replies.
 *
 * Three things fold this shut or strip it back, and they're separate on purpose:
 *
 * - `superseded` — a newer draft exists below, so this one collapses to its
 *   header and the live version is the one in view.
 * - `showActions` — the broker has already replied past this draft. The reply
 *   *is* the answer to "send it or edit it?", so leaving the buttons up offers a
 *   choice that's already been made.
 * - `version` — labels the header and the badge, so a revision reads as a
 *   revision rather than as a second unrelated email.
 */
export function EmailDraftSection({
  draft,
  version = 1,
  superseded = false,
  showActions = true,
  onSend,
  onDelete,
}: {
  draft: EmailDraftCardData;
  version?: number;
  superseded?: boolean;
  showActions?: boolean;
  onSend: () => void;
  onDelete: () => void;
}) {
  return (
    <ChatSection
      label={version > 1 ? "Edited email draft" : "Drafted an email"}
      collapsed={superseded}
    >
      <EmailDraftObject draft={draft} version={version} />
      <div className="text-body">
        <span className="fw-semibold">{version > 1 ? "Edited." : "Done."}</span>{" "}
        {version > 1
          ? "Good to send?"
          : "Let me know if you'd like any edits or if I should send it."}
      </div>
      {showActions && (
        <div className="d-flex flex-wrap align-items-center gap-2">
          <Button size="sm" variant="primary" onClick={onSend}>
            Send it
          </Button>
          <OpenInEmailButton draft={draft} label="Let me edit" />
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      )}
    </ChatSection>
  );
}
