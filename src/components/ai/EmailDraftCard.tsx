import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenNib,
  faArrowUpRightFromSquare,
  faChevronDown,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import { findContactForRecipient } from "#/data/store";
import { useComposeFocus } from "#/components/contacts/useComposeFocus";

export interface EmailDraftCardData {
  id: string;
  subject: string;
  to: string[];
  body: string;
  signature: string;
}

/**
 * Renders a generated outreach email (subject/to/body/signature) as an
 * editable-looking draft the broker can review before sending. Shared between
 * the assistant chat (`AssistantSidebar.tsx`) and the in-context "Draft with AI"
 * button (`ListingEmail.tsx`).
 */
export function EmailDraftCard({
  draft,
  superseded = false,
}: {
  draft: EmailDraftCardData;
  /**
   * A newer version of this draft exists further down the chat. Folds this one
   * shut so the live draft is the one in view, while the version history stays
   * one click away rather than being deleted out from under the broker.
   */
  superseded?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!superseded);
  // Collapse when a revision arrives, rather than only at mount: the card that's
  // on screen is exactly the one being superseded. Deliberately one-way — it
  // won't re-open a card the broker chose to fold, and won't fight a click.
  useEffect(() => {
    if (superseded) setOpen(false);
  }, [superseded]);
  // Where "Open in Email" goes depends on whether this is a note to one person
  // or a send to a list. A recipient we can match to a contact means the former,
  // and the right destination is that contact's own composer — the Email module
  // is the campaign surface, and landing there for a one-off left the broker to
  // rebuild a draft that already existed.
  const recipient = draft.to.map(findContactForRecipient).find(Boolean);

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-2">
      {/* The header is the disclosure control: the whole row is clickable, and
          the subject rides in it when collapsed so a folded card still says
          which draft it is. */}
      <button
        type="button"
        className="btn p-0 border-0 bg-transparent text-start d-flex align-items-center gap-2 w-100"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <FontAwesomeIcon icon={faPenNib} className="text-purple-heart-600" />
        <span className="fw-semibold small text-uppercase text-muted">Email draft</span>
        {!open && (
          <span className="small text-muted text-truncate flex-grow-1" style={{ minWidth: 0 }}>
            {superseded ? "Revised below · " : ""}
            {draft.subject}
          </span>
        )}
        <FontAwesomeIcon
          icon={open ? faChevronDown : faChevronRight}
          className="text-muted ms-auto flex-shrink-0"
        />
      </button>

      {!open ? null : (
        <>
      <div>
        <div className="fw-semibold">{draft.subject}</div>
        {draft.to.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mt-1">
            {draft.to.map((recipientLine) => (
              <Badge key={recipientLine} variant="secondary" appearance="muted">
                {recipientLine}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="small text-body" style={{ whiteSpace: "pre-wrap" }}>
        {draft.body}
      </div>

      {draft.signature && (
        <div className="small text-muted" style={{ whiteSpace: "pre-wrap" }}>
          {draft.signature}
        </div>
      )}

      <div>
        {recipient ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Raise the draft before navigating: the composer reads the signal
              // in an effect on mount, so it's already waiting when the page
              // arrives — and the contact guard keeps it from landing anywhere
              // else if navigation is interrupted.
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
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            Open in Email
          </Button>
        ) : (
          /* No recipient we hold a record for — a list send, so the campaign
             module is still the right place to take it. */
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link to="/email" />}
          >
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
            Open in Email
          </Button>
        )}
      </div>
        </>
      )}
    </div>
  );
}
