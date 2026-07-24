import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenNib, faArrowUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";

export interface EmailDraftCardData {
  id: string;
  subject: string;
  to: string[];
  body: string;
  signature: string;
}

/**
 * Renders a generated outreach email (subject/to/body/signature) as an
 * editable-looking draft the broker can review before opening it in the Email
 * module. Shared between the assistant chat (`AssistantSidebar.tsx`) and the
 * in-context "Draft with AI" button (`ListingEmail.tsx`).
 */
export function EmailDraftCard({ draft }: { draft: EmailDraftCardData }) {
  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-2">
      <div className="d-flex align-items-center gap-2">
        <FontAwesomeIcon icon={faPenNib} className="text-buildout-blue-700" />
        <span className="fw-semibold small text-uppercase text-muted">Email draft</span>
      </div>

      <div>
        <div className="fw-semibold">{draft.subject}</div>
        {draft.to.length > 0 && (
          <div className="d-flex flex-wrap gap-1 mt-1">
            {draft.to.map((recipient) => (
              <Badge key={recipient} variant="secondary" appearance="muted">
                {recipient}
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
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link to="/email" />}
        >
          <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
          Open in Email
        </Button>
      </div>
    </div>
  );
}
