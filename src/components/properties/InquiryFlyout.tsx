import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Dialog } from "@buildoutinc/blueprint-react/ui/Dialog";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleXmark,
  faTrash,
  faUser,
} from "@fortawesome/pro-regular-svg-icons";
import { LEAD_STATUSES } from "#/data/leadFacts";
import { deleteInquiry, updateInquiry } from "#/data/actions";
import {
  ACCESS_LEVELS,
  type AccessLevel,
  type Inquiry,
  REFERRAL_SOURCES,
} from "./inquiryRow";
import { InquiryJourneyBar } from "./InquiryJourneyBar";
import { InquiryCaSection } from "./InquiryCaSection";

const muted = <span className="text-muted">—</span>;

/**
 * One label/value line. An editable row puts its control in the same slot the
 * read-only value occupies, so the eye runs down a single column of answers
 * rather than hopping between a static column and a form column.
 */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3 border-bottom py-2">
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
 * The inquiry detail panel — and the place a broker works an inquiry.
 *
 * An inquiry is not a record of its own — it is a contact's interest in this
 * deal — so it opens over the table rather than navigating away. The broker is
 * scanning a list; losing their place (and their search, filters and selection)
 * to work one row is what makes people stop scanning.
 *
 * Edits autosave, one write per control change. There is no Save button and so
 * no half-committed state, and the table behind the panel moves as you go.
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!inquiry) return null;

  const patch = (p: Parameters<typeof updateInquiry>[2]) =>
    updateInquiry(inquiry.id, inquiry.listingId, p);

  const remove = () => {
    deleteInquiry(inquiry.id, inquiry.listingId);
    setConfirmDelete(false);
    // The record this panel is showing no longer exists, so the panel cannot
    // stay open over the list it just left.
    onOpenChange(false);
  };

  return (
    <>
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
            <InquiryJourneyBar inquiry={inquiry} />

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
              <Row
                label="Inquiry Status"
                value={
                  <Select
                    value={inquiry.status}
                    onValueChange={(v) => v && patch({ status: v })}
                  >
                    <Select.Trigger style={{ minWidth: 160 }}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {LEAD_STATUSES.map((s) => (
                        <Select.Item key={s} value={s}>
                          {s}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                }
              />
              {spaceLabel && <Row label="Space" value={spaceLabel} />}
              <Row
                label="Referral Source"
                value={
                  <Select
                    value={inquiry.referralSource}
                    onValueChange={(v) => v && patch({ referralSource: v })}
                  >
                    <Select.Trigger style={{ minWidth: 160 }}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {REFERRAL_SOURCES.map((src) => (
                        <Select.Item key={src} value={src}>
                          {src}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                }
              />
              <Row label="Link Sent" value={muted} />
              <Row label="Added By" value={inquiry.addedBy} />
              <Row label="Date Added" value={inquiry.dateAdded} />
              <Row label="Last Updated" value={inquiry.lastUpdated} />
            </Section>

            <Section title="Access">
              <Row
                label="Sale Doc Access Level"
                value={
                  <Select
                    value={inquiry.accessLevel}
                    onValueChange={(v) => v && patch({ accessLevel: v as AccessLevel })}
                  >
                    <Select.Trigger style={{ minWidth: 160 }}>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      {ACCESS_LEVELS.map((lvl) => (
                        <Select.Item key={lvl} value={lvl}>
                          {lvl}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                }
              />
              {/* Read-only: the lead verifies their own email on the website.
                  A broker cannot vouch for it from here. */}
              <Row
                label="Account Status"
                value={
                  <span className={inquiry.verified ? "" : "text-muted"}>
                    {inquiry.verified ? "Verified" : "Not Verified"}
                  </span>
                }
              />
            </Section>

            <InquiryCaSection inquiry={inquiry} />

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

            <div className="border-top pt-3">
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <FontAwesomeIcon icon={faTrash} />
                Delete Inquiry
              </Button>
            </div>
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

      {/* A sibling of the Offcanvas, not a child: nesting a second dialog
          inside base-ui's Dialog.Root makes the two fight over focus. */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete this inquiry?</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <p className="mb-0">
              {inquiry.name} will be removed from this deal&rsquo;s inquiries,
              along with their access level and confidentiality agreement.
            </p>
            <p className="text-muted mb-0 mt-2">
              The contact record stays in your book of business — only the
              inquiry is deleted.
            </p>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>Cancel</Dialog.Cancel>
            <Button variant="destructive" onClick={remove}>
              <FontAwesomeIcon icon={faTrash} />
              Delete Inquiry
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
