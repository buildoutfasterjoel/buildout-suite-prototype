import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleXmark, faUser } from "@fortawesome/pro-regular-svg-icons";
import type { Inquiry } from "./inquiryRow";

const muted = <span className="text-muted">—</span>;

/** One label/value line. The label gutter is fixed so the values align down the panel. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d-flex justify-content-between gap-3 border-bottom py-2">
      <span className="text-muted text-nowrap">{label}</span>
      <span className="fw-semibold text-end" style={{ minWidth: 0 }}>
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="fw-semibold fs-large mb-1">{title}</div>
      {children}
    </div>
  );
}

/**
 * The inquiry detail panel.
 *
 * An inquiry is not a record of its own — it is a contact's interest in this
 * deal — so its detail opens over the table rather than navigating away. The
 * broker is scanning a list; losing their place (and their search, filters and
 * selection) to read one row's facts is what makes people stop scanning. The
 * footer holds the one link out, to the contact record behind the inquiry.
 */
export function InquiryFlyout({
  inquiry,
  spaceLabel,
  open,
  onOpenChange,
}: {
  inquiry: Inquiry | null;
  /** The suite this contact inquired about, when the deal is a whole building. */
  spaceLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!inquiry) return null;

  return (
    <Offcanvas open={open} onOpenChange={onOpenChange}>
      <Offcanvas.Content
        side="right"
        style={{ width: "min(32rem, 100vw)" }}
        aria-label={`${inquiry.name} inquiry`}
      >
        <Offcanvas.Header className="d-flex flex-column align-items-stretch gap-3">
          <div className="d-flex align-items-center gap-3">
            <Avatar size="lg">
              <Avatar.Fallback className="fw-semibold">
                {inquiry.initials}
              </Avatar.Fallback>
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Offcanvas.Title className="fs-4 fw-semibold mb-0 text-truncate">
                {inquiry.name}
              </Offcanvas.Title>
              <div className="text-muted text-truncate">
                {[inquiry.role, inquiry.company].filter(Boolean).join(" · ") ||
                  "No company on file"}
              </div>
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Badge
              variant={inquiry.status === "No Status" ? "secondary" : "primary"}
              appearance="muted"
            >
              {inquiry.status}
            </Badge>
            <Badge variant="secondary" appearance="muted">
              {inquiry.verified ? (
                "Verified"
              ) : (
                <>
                  <FontAwesomeIcon icon={faCircleXmark} />
                  Not Verified
                </>
              )}
            </Badge>
            {spaceLabel && (
              <Badge variant="secondary" appearance="muted">
                {spaceLabel}
              </Badge>
            )}
          </div>
        </Offcanvas.Header>

        <Offcanvas.Body className="d-flex flex-column gap-4">
          <Section title="Contact">
            <Row
              label="Email"
              value={
                inquiry.email ? (
                  <a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>
                ) : (
                  muted
                )
              }
            />
            <Row
              label="Phone"
              value={
                inquiry.phone ? (
                  <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
                ) : (
                  muted
                )
              }
            />
            <Row label="Company" value={inquiry.company || muted} />
            <Row label="Role / Job Title" value={inquiry.role || muted} />
          </Section>

          <Section title="Inquiry">
            <Row label="Inquiry Status" value={inquiry.status} />
            {spaceLabel && <Row label="Space" value={spaceLabel} />}
            <Row label="Referral Source" value={inquiry.referralSource} />
            <Row label="Link Sent" value={muted} />
            <Row label="Added By" value={inquiry.addedBy} />
            <Row label="Date Added" value={inquiry.dateAdded} />
            <Row label="Last Updated" value={inquiry.lastUpdated} />
          </Section>

          <Section title="Access">
            <Row label="Sale Doc Access Level" value={inquiry.accessLevel} />
            <Row
              label="Account Status"
              value={inquiry.verified ? "Verified" : "Not Verified"}
            />
          </Section>

          <Section title="1031 Exchange">
            <Row
              label="1031 Exchange"
              value={
                inquiry.exchange1031 === "--" ? muted : inquiry.exchange1031
              }
            />
            <Row
              label="1031 Expiration"
              value={
                inquiry.expiration1031 === "--" ? muted : inquiry.expiration1031
              }
            />
          </Section>
        </Offcanvas.Body>

        <Offcanvas.Footer className="d-flex justify-content-between gap-2">
          <Offcanvas.Close render={<Button variant="outline">Close</Button>} />
          <Button
            variant="primary"
            nativeButton={false}
            render={
              <Link
                to="/backoffice/contacts/$contactId"
                params={{ contactId: inquiry.id }}
              >
                <FontAwesomeIcon icon={faUser} />
                View Contact
              </Link>
            }
          />
        </Offcanvas.Footer>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
