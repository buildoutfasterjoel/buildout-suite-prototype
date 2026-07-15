import { useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faLocationDot,
  faPlus,
  faXmark,
  faChevronDown,
  faChevronRight,
  faPencil,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary, PropertyStatus } from "#/data/types";
import {
  contactAddressLines,
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";
import { RelationshipPill, SidePill } from "#/components/contacts/pills";
import { initials as nameInitials } from "#/components/deals/dealDisplay";
import { ContactDealCard } from "#/components/contacts/ContactDealCard";
import { CreateDealModal } from "#/components/deals/CreateDealModal";

/** Deal statuses considered "past" (shown behind a toggle). */
const PAST_STATUSES = new Set<PropertyStatus>(["closed", "inactive"]);

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

/** A "Label value" row used in the expanded contact details. */
function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="fw-semibold me-2">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/**
 * Stacked avatars of who has access to this contact. The first (owner) carries
 * an offset outline; the rest are stubbed collaborators for this structural pass.
 */
function SharedAccess({ owner }: { owner: string }) {
  return (
    <Avatar.Group size="sm" className="ms-auto">
      <Avatar className="contact-hero__owner-avatar">
        <Avatar.Fallback className="fw-semibold">
          {nameInitials(owner)}
        </Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>MK</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>JL</Avatar.Fallback>
      </Avatar>
      <Avatar.More count={2} />
    </Avatar.Group>
  );
}

/**
 * One collapsible section: chevron on the LEFT of the label + count, with the
 * right side reserved for an optional action (e.g. an "Add" button). The action
 * button is overlaid on the header (a sibling of the trigger) so it toggles its
 * own click, not the section.
 */
function Section({
  value,
  label,
  count,
  open,
  action,
  children,
}: {
  value: string;
  label: string;
  count?: number;
  open: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Accordion.Item value={value} className="position-relative">
      <Accordion.Trigger>
        <span className="d-flex align-items-center gap-2">
          <FontAwesomeIcon
            icon={open ? faChevronDown : faChevronRight}
            className="text-muted"
            style={{ width: 12 }}
          />
          <span className="fw-bold" style={{ fontSize: 17 }}>
            {label}
          </span>
          {count !== undefined && (
            <Badge variant="secondary" appearance="muted">
              {count}
            </Badge>
          )}
        </span>
      </Accordion.Trigger>
      {action && <div className="contact-accordion__action">{action}</div>}
      <Accordion.Content>{children}</Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * Left column of the contact detail page. A non-collapsible contact hero at the
 * top (identity + stage/side + shared access + a Show/Hide Contact Details
 * expander), then collapsible sections for Deals, Properties, Lists, and Custom
 * Fields. Lists and Custom Fields are placeholders for now; Properties reuses
 * the deal-derived data.
 */
export function ContactOverviewColumn({
  contact,
  deals,
}: {
  contact: Contact;
  deals: DealSummary[];
}) {
  const [open, setOpen] = useState<string[]>(["deals", "properties"]);
  const [tags, setTags] = useState(contact.tags);
  const [showDetails, setShowDetails] = useState(false);
  const [showPastDeals, setShowPastDeals] = useState(false);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [addressLine1, addressLine2] = contactAddressLines(contact);
  const phoneInvalid = contact.phoneStatus === "invalid";

  const activeDeals = deals.filter((d) => !PAST_STATUSES.has(d.status));
  const pastDeals = deals.filter((d) => PAST_STATUSES.has(d.status));

  return (
    <Card className="shadow-sm overflow-hidden">
      <CreateDealModal
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        contact={contact}
      />

      {/* Contact hero */}
      <div className="p-3 d-flex flex-column gap-3">
        <div className="d-flex align-items-start gap-2">
          <Avatar size="lg">
            <Avatar.Fallback className="fw-semibold">
              {contactInitials(contact)}
            </Avatar.Fallback>
          </Avatar>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold fs-6">{contactFullName(contact)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit contact"
                className="ms-auto"
              >
                <FontAwesomeIcon icon={faPencil} />
              </Button>
            </div>
            <div className="text-muted fs-small">
              {contact.title} · {contact.company}
            </div>
            <div className="text-muted fs-small">
              Last touch: {contact.lastTouch}
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center flex-wrap gap-2">
          <RelationshipPill value={contact.relationship} />
          {contact.side && <SidePill value={contact.side} />}
          <SharedAccess owner={contact.assignedTo} />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="align-self-start px-0"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "Hide" : "Show"} Contact Details
        </Button>

        {showDetails && (
          <div className="d-flex flex-column gap-3">
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
              </InfoRow>
              <InfoRow icon={faLocationDot}>
                <div>{addressLine1}</div>
                <div>{addressLine2}</div>
              </InfoRow>
            </div>

            <div className="d-flex flex-column gap-1">
              <FieldRow label="Source" value={contact.source} />
              <FieldRow label="Company" value={contact.company} />
              <FieldRow label="Title" value={contact.title} />
            </div>

            <div className="d-flex flex-column gap-2">
              <span className="fw-semibold">Tags</span>
              <div className="d-flex flex-wrap align-items-center gap-2">
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
                      onClick={() =>
                        setTags((prev) => prev.filter((x) => x !== t))
                      }
                    >
                      <FontAwesomeIcon icon={faXmark} className="fs-xs" />
                    </button>
                  </Badge>
                ))}
                <Button variant="ghost" size="icon-sm" aria-label="Add tag">
                  <FontAwesomeIcon icon={faPlus} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible sections */}
      <Accordion
        className="contact-overview-accordion"
        multiple
        value={open}
        onValueChange={setOpen}
      >
        <Section
          value="deals"
          label="Deals"
          count={activeDeals.length}
          open={open.includes("deals")}
          action={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New deal"
              onClick={() => setNewDealOpen(true)}
            >
              <FontAwesomeIcon icon={faPlus} />
            </Button>
          }
        >
          <div className="d-flex flex-column gap-3">
            {deals.length === 0 ? (
              <span className="text-muted fs-small">
                Deals you link to this contact will show up here.
              </span>
            ) : (
              <>
                {activeDeals.map((d) => (
                  <ContactDealCard key={d.id} listingId={d.id} />
                ))}
                {showPastDeals &&
                  pastDeals.map((d) => (
                    <ContactDealCard key={d.id} listingId={d.id} />
                  ))}
                {pastDeals.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="align-self-center"
                    onClick={() => setShowPastDeals((v) => !v)}
                  >
                    {showPastDeals
                      ? "Hide Past Deals"
                      : `Show ${pastDeals.length} Past Deal${
                          pastDeals.length > 1 ? "s" : ""
                        }`}
                  </Button>
                )}
              </>
            )}
          </div>
        </Section>

        <Section
          value="properties"
          label="Properties Owned"
          count={deals.length}
          open={open.includes("properties")}
        >
          <div className="d-flex flex-column gap-2">
            {deals.length === 0 ? (
              <span className="text-muted fs-small">None on file.</span>
            ) : (
              deals.map((d) => (
                <div
                  key={d.id}
                  className="d-flex align-items-center justify-content-between gap-2"
                >
                  <span className="d-inline-flex align-items-center gap-2 text-truncate">
                    <FontAwesomeIcon
                      icon={faLocationDot}
                      className="text-muted"
                    />
                    <span className="text-truncate">{d.name}</span>
                  </span>
                  <Badge variant="secondary" appearance="muted" className="fs-xs">
                    DEAL
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Section>

        <Section
          value="lists"
          label="Lists"
          count={0}
          open={open.includes("lists")}
        >
          <div className="text-muted fs-small">
            Lists this contact belongs to will appear here.
          </div>
        </Section>

        <Section
          value="customFields"
          label="Custom Fields"
          open={open.includes("customFields")}
        >
          <div className="text-muted fs-small">
            Org-level custom fields will appear here.
          </div>
        </Section>
      </Accordion>
    </Card>
  );
}
