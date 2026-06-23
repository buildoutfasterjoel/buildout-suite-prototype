import type { ReactNode } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRectangleHistoryCircleUser } from "@fortawesome/pro-regular-svg-icons";
import {
  EMAIL_STATUS_DISPLAY,
  type Email,
  type EmailPerformance,
} from "#/data/emails";

/** A labelled value in the meta grid. */
function MetaField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="d-flex flex-column">
      <span className="fw-semibold">{label}</span>
      <span>{children}</span>
    </div>
  );
}

/**
 * Summary card shown above the tabs: subject/from on the left, and
 * status/properties/sent-on/list on the right.
 */
export function EmailMetaCard({
  email,
  performance,
}: {
  email: Email;
  performance: EmailPerformance;
}) {
  const { label, dotColor } = EMAIL_STATUS_DISPLAY[email.status];

  return (
    <Card>
      <Card.Body>
        <div className="row g-4">
          {/* Left column */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-3">
            <MetaField label="Subject">{email.subject}</MetaField>
            <MetaField label="From">
              {email.primaryBroker} &lt;{performance.fromEmail}&gt;
            </MetaField>
          </div>

          {/* Right column */}
          <div className="col-12 col-lg-6 d-flex flex-column gap-3">
            <div className="row g-3">
              <div className="col-6">
                <MetaField label="Status">
                  <span className="d-inline-flex align-items-center gap-2">
                    <span
                      className="rounded-circle d-inline-block"
                      style={{ width: 8, height: 8, backgroundColor: dotColor }}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                </MetaField>
              </div>
              <div className="col-6">
                <MetaField label="Properties">
                  <Badge variant="secondary" appearance="muted">
                    {performance.propertyCount} Properties
                  </Badge>
                </MetaField>
              </div>
            </div>
            <div className="row g-3">
              <div className="col-6">
                <MetaField label="Sent on">{performance.sentAt}</MetaField>
              </div>
              <div className="col-6">
                <MetaField label="List">
                  <Badge variant="secondary" appearance="accent">
                    <FontAwesomeIcon icon={faRectangleHistoryCircleUser} />
                    {email.list}
                  </Badge>
                </MetaField>
              </div>
            </div>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
}
