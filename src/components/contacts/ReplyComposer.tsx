import { useState } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBold,
  faItalic,
  faUnderline,
  faLink,
  faListUl,
  faListOl,
  faPaperclip,
  faPaperPlane,
  faCaretDown,
} from "@fortawesome/pro-regular-svg-icons";

/**
 * The inline reply composer that expands beneath a row (never a modal) — the same
 * fields the full Email tab offers, because a reply from the timeline is still a
 * real email: a To chip, CC/BCC, a formatting toolbar and the message body.
 *
 * Send stays secondary until there's something to send; Cancel collapses with no
 * side-effect, and the caller restores whatever the editor displaced.
 *
 * Two modes, and the difference is whether there's a message to reply *into*:
 *
 * - `subject` — replying to an email or a thread. The row quotes what's being
 *   answered and the new message inherits its subject; there's nothing to edit.
 * - `defaultSubject` — writing about something that isn't an email at all (a
 *   listing inquiry). The editor carries its own editable Subject line seeded
 *   with "Re: …", because the email is a new one rather than a reply, and
 *   `onSend` hands the subject back with the body.
 */
export function ReplyComposer({
  subject,
  defaultSubject,
  recipientName,
  recipientEmail,
  recipientInitials,
  onSend,
  onCancel,
}: {
  subject?: string;
  defaultSubject?: string;
  recipientName: string;
  recipientEmail?: string;
  recipientInitials: string;
  onSend: (text: string, subject?: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [subjectDraft, setSubjectDraft] = useState(defaultSubject ?? "");
  const canSend = text.trim().length > 0;

  return (
    <div className="tl-reply">
      {/* Only one of the two ever shows: an editable subject makes the quote
          redundant, since the "Re: …" it starts from says the same thing. */}
      {subject && defaultSubject === undefined && (
        <div className="tl-reply__quote">
          Replying to <span className="fw-semibold">{subject}</span>
        </div>
      )}

      <div className="tl-reply__box">
        <div className="tl-reply__to">
          <div className="tl-reply__to-left">
            <span className="tl-reply__to-label">To:</span>
            <span className="tl-reply__chip">
              <span className="tl-reply__chip-avatar">{recipientInitials}</span>
              <span className="fw-semibold">{recipientName}</span>
              {recipientEmail && (
                <span className="tl-reply__chip-email">&lt;{recipientEmail}&gt;</span>
              )}
              <FontAwesomeIcon icon={faCaretDown} className="tl-reply__chip-caret" />
            </span>
          </div>
          <div className="tl-reply__to-right">
            {/* Unwired, like the composer's own CC/BCC — the prototype has no
                second recipient to add. */}
            <Button variant="ghost" size="sm">
              CC
            </Button>
            <Button variant="ghost" size="sm">
              BCC
            </Button>
          </div>
        </div>

        {defaultSubject !== undefined && (
          <div className="tl-reply__subject">
            <span className="tl-reply__to-label">Subject:</span>
            <input
              className="compose-subject-input"
              placeholder="Enter subject here..."
              value={subjectDraft}
              onChange={(e) => setSubjectDraft(e.target.value)}
            />
          </div>
        )}

        <div className="compose-toolbar tl-reply__toolbar">
          {[faBold, faItalic, faUnderline, faLink, faListUl, faListOl].map(
            (icon, i) => (
              <button
                key={i}
                type="button"
                className="compose-toolbar__btn"
                onClick={(e) => e.preventDefault()}
              >
                <FontAwesomeIcon icon={icon} />
              </button>
            ),
          )}
        </div>

        <Textarea
          autoFocus
          rows={4}
          className="tl-reply__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write your email message here..."
        />
      </div>

      <div className="tl-reply__actions">
        <Button variant="ghost" appearance="muted" size="sm">
          <FontAwesomeIcon icon={faPaperclip} />
          Attachments
        </Button>
        <div className="d-flex align-items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={canSend ? "primary" : "secondary"}
            size="sm"
            onClick={() =>
              canSend &&
              onSend(
                text.trim(),
                defaultSubject === undefined ? undefined : subjectDraft.trim(),
              )
            }
          >
            Send Email
            <FontAwesomeIcon icon={faPaperPlane} />
          </Button>
        </div>
      </div>
    </div>
  );
}
