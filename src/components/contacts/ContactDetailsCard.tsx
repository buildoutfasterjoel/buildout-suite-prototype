import { useState } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faPhone,
  faEnvelope,
  faBuilding,
  faLocationDot,
  faBan,
  faArrowRightFromBracket,
  faPlus,
  faXmark,
  faRightLeft,
  faShareNodes,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary } from "#/data/types";
import { contactAddressLines } from "#/components/contacts/contactDisplay";
import { initials as nameInitials } from "#/components/deals/dealDisplay";
import { Pill } from "#/components/contacts/pills";

/** A labelled icon row in the contact info block. */
function InfoRow({
  icon,
  children,
}: {
  icon: typeof faPhone;
  children: React.ReactNode;
}) {
  return (
    <div className="d-flex gap-2">
      <FontAwesomeIcon icon={icon} className="text-muted mt-1" />
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

export function ContactDetailsCard({
  contact,
  deals,
}: {
  contact: Contact;
  deals: DealSummary[];
}) {
  const [tags, setTags] = useState(contact.tags);
  const [addressLine1, addressLine2] = contactAddressLines(contact);
  const phoneInvalid = contact.phoneStatus === "invalid";

  return (
    <div className="d-flex flex-column gap-4">
      {/* Contact details */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between">
            <Card.Title className="fs-6">Contact Details</Card.Title>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Edit contact details"
            >
              <FontAwesomeIcon icon={faPencil} />
            </Button>
          </div>
          <div className="d-flex flex-column gap-2">
            <InfoRow icon={faPhone}>
              <span
                className={
                  phoneInvalid
                    ? "text-decoration-line-through text-destructive"
                    : undefined
                }
              >
                {contact.phone}
              </span>{" "}
              <span className="text-muted fs-small">(mobile)</span>
            </InfoRow>
            <InfoRow icon={faEnvelope}>
              <span className="text-truncate d-inline-block w-100">
                {contact.email}
              </span>
              <span className="text-muted fs-small">(work)</span>
            </InfoRow>
            <InfoRow icon={faBuilding}>
              <div className="text-primary">{contact.company}</div>
              <div className="text-muted fs-small">{contact.title}</div>
            </InfoRow>
            <InfoRow icon={faLocationDot}>
              <div>{addressLine1}</div>
              <div>
                {addressLine2}{" "}
                <span className="text-muted fs-small">(office)</span>
              </div>
            </InfoRow>
          </div>

          <div className="d-flex flex-column gap-2">
            {contact.doNotCall ? (
              <span className="d-inline-flex align-items-center gap-2 text-destructive fw-semibold">
                <FontAwesomeIcon icon={faBan} />
                Do Not Call
              </span>
            ) : (
              <Button variant="ghost" size="sm" className="align-self-start px-0">
                <FontAwesomeIcon icon={faBan} className="text-muted" />
                Mark as Do Not Call
              </Button>
            )}
            <div className="d-flex align-items-center gap-2">
              <FontAwesomeIcon
                icon={faArrowRightFromBracket}
                className="text-muted"
              />
              <span className="text-muted">Source</span>
              <Pill className="bg-storm-grey-100 text-storm-grey-700">
                {contact.source}
              </Pill>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* Properties owned */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-2">
          <Card.Title className="fs-6">Properties Owned</Card.Title>
          {deals.length === 0 ? (
            <span className="text-muted fs-small">None on file.</span>
          ) : (
            deals.map((d) => (
              <div
                key={d.id}
                className="d-flex align-items-center justify-content-between gap-2"
              >
                <span className="d-inline-flex align-items-center gap-2 text-truncate">
                  <FontAwesomeIcon icon={faBuilding} className="text-muted" />
                  <span className="text-truncate">{d.name}</span>
                </span>
                <Badge variant="secondary" appearance="muted" className="fs-xs">
                  DEAL
                </Badge>
              </div>
            ))
          )}
        </Card.Body>
      </Card>

      {/* Tags */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-2">
          <Card.Title className="fs-6">Tags</Card.Title>
          <div className="d-flex flex-wrap gap-2">
            {tags.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                appearance="muted"
                className="d-inline-flex align-items-center gap-1"
              >
                {t}
                <button
                  type="button"
                  className="btn btn-link p-0 text-reset d-inline-flex"
                  aria-label={`Remove tag ${t}`}
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                >
                  <FontAwesomeIcon icon={faXmark} className="fs-xs" />
                </button>
              </Badge>
            ))}
            <Button variant="outline" size="sm">
              <FontAwesomeIcon icon={faPlus} />
              Add tag
            </Button>
          </div>
          <span className="text-muted fs-small">
            Used to filter People. Tags are shared across the firm — type to reuse
            one.
          </span>
        </Card.Body>
      </Card>

      {/* Ownership & access */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center justify-content-between">
            <Card.Title className="fs-6">Ownership &amp; Access</Card.Title>
            <Badge variant="secondary" appearance="muted" className="fs-xs">
              PRIVATE · YOURS
            </Badge>
          </div>
          <div className="d-flex align-items-center gap-2">
            <Avatar size="sm">
              <Avatar.Fallback className="fw-semibold">
                {nameInitials(contact.assignedTo)}
              </Avatar.Fallback>
            </Avatar>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              <div className="fw-semibold">{contact.assignedTo} (you)</div>
              <div className="text-muted fs-small">
                Owner · full relationship · acquired via {contact.source}
              </div>
            </div>
            <Button variant="outline" size="sm">
              <FontAwesomeIcon icon={faRightLeft} />
              Transfer
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Shared with */}
      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-column gap-2">
          <Card.Title className="fs-6">Shared With</Card.Title>
          <span className="text-muted fs-small">
            Only you. Share with your assistant or a teammate so they can work this
            contact on your behalf.
          </span>
          <Button
            variant="outline"
            className="border-2 w-100"
            style={{ borderStyle: "dashed" }}
          >
            <FontAwesomeIcon icon={faShareNodes} />
            Share this relationship
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted align-self-center"
          >
            Make this contact private (only you can see it)
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
}
