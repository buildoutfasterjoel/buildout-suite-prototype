import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelopesBulk,
  faCaretDown,
  faDownload,
  faTrash,
} from "@fortawesome/pro-regular-svg-icons";
import type { Email } from "#/data/emails";

/**
 * Full-bleed campaign header: an "Emails" breadcrumb back to the list, the
 * campaign subject as the page title, and an Actions menu (stubbed).
 */
export function EmailCampaignHeader({ email }: { email: Email }) {
  return (
    <div className="bg-white border-bottom shadow-sm">
      <div className="container py-3">
        <div className="d-flex align-items-center gap-3">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <Link
              to="/email"
              className="d-inline-flex align-items-center gap-1 small text-muted text-decoration-none"
            >
              <FontAwesomeIcon icon={faEnvelopesBulk} />
              Emails
            </Link>
            <h1
              className="fs-4 fw-semibold mb-0 text-truncate"
              title={email.subject}
            >
              {email.subject}
            </h1>
          </div>

          <DropdownMenu>
            <DropdownMenu.Trigger
              render={
                <Button variant="outline" className="flex-shrink-0">
                  Actions
                  <FontAwesomeIcon icon={faCaretDown} />
                </Button>
              }
            />
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item>
                <FontAwesomeIcon icon={faDownload} />
                Download Report
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item>
                <FontAwesomeIcon icon={faTrash} />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
