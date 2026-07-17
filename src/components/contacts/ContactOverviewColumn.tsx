import { useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faLocationDot,
  faPlus,
  faChevronDown,
  faChevronUp,
  faPencil,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary, PropertyStatus } from "#/data/types";
import {
  contactAddressLines,
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";
import { ContactStageBadge } from "#/components/contacts/ContactStageBadge";
import { ContactSection } from "#/components/contacts/ContactSection";
import { ContactChip } from "#/components/contacts/ContactChip";
import { ContactHeroAccessAvatars } from "#/components/contacts/ContactHeroAccessAvatars";
import type { ContactShare } from "#/data/teammates";
import { ContactDealCard } from "#/components/contacts/ContactDealCard";
import { ContactPropertyCard } from "#/components/contacts/ContactPropertyCard";
import { EditContactModal } from "#/components/contacts/EditContactModal";
import { CreateDealModal } from "#/components/deals/CreateDealModal";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { updateContact } from "#/data/actions";

/** Deal statuses considered "past" (shown behind a toggle). */
const PAST_STATUSES = new Set<PropertyStatus>(["closed", "inactive"]);

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
 * Left column of the contact detail page. A non-collapsible contact hero at the
 * top (identity + stage/side + shared access + a Show/Hide Contact Details
 * expander), then collapsible sections for Deals, Properties, Lists, and Custom
 * Fields. Lists and Custom Fields are placeholders for now; Properties reuses
 * the deal-derived data.
 */
export function ContactOverviewColumn({
  contact,
  deals,
  shares,
  onOpenShare,
}: {
  contact: Contact;
  deals: DealSummary[];
  shares: ContactShare[];
  onOpenShare: () => void;
}) {
  // Collapse state persists across contacts (see useContactUiPrefs).
  const open = useContactUiPrefs((s) => s.overviewSections);
  const setOpen = useContactUiPrefs((s) => s.setOverviewSections);
  const showDetails = useContactUiPrefs((s) => s.showDetails);
  const setShowDetails = useContactUiPrefs((s) => s.setShowDetails);
  const showPastDeals = useContactUiPrefs((s) => s.showPastDeals);
  const setShowPastDeals = useContactUiPrefs((s) => s.setShowPastDeals);
  const [tags, setTags] = useState(contact.tags);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addressLine1, addressLine2] = contactAddressLines(contact);
  const phoneInvalid = contact.phoneStatus === "invalid";

  // Primary phone/email first, then any extras (de-duplicated) — the details
  // panel lists them all.
  const allPhones = [
    ...new Set([contact.phone, ...(contact.phones ?? [])].filter(Boolean)),
  ];
  const allEmails = [
    ...new Set([contact.email, ...(contact.emails ?? [])].filter(Boolean)),
  ];

  const activeDeals = deals.filter((d) => !PAST_STATUSES.has(d.status));
  const pastDeals = deals.filter((d) => PAST_STATUSES.has(d.status));

  // One card per property in "Properties Owned" — group the contact's deals by
  // property so a property with several deals shows a single card, not one per
  // deal. Order follows first appearance in `deals`.
  const propertyGroups = Array.from(
    deals.reduce((map, d) => {
      map.set(d.propertyId, [...(map.get(d.propertyId) ?? []), d.id]);
      return map;
    }, new Map<string, string[]>()),
  );

  return (
    <Card className="shadow-sm overflow-hidden">
      <CreateDealModal
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        contact={contact}
      />

      {/* Contact hero */}
      <div className="p-5 d-flex flex-column gap-3 position-relative">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit contact"
          className="position-absolute"
          style={{ top: 8, right: 8 }}
          onClick={() => setEditOpen(true)}
        >
          <FontAwesomeIcon icon={faPencil} />
        </Button>

        <EditContactModal
          open={editOpen}
          onOpenChange={setEditOpen}
          contact={contact}
          onSave={(id, input) => updateContact(id, input)}
        />

        <div className="d-flex align-items-center gap-3">
          {/* TODO(blueprint): drop the inline 56px size + gradient overrides once
              the Blueprint Avatar supports a large gradient-filled variant. */}
          <Avatar
            className="flex-shrink-0"
            style={{
              width: 56,
              height: 56,
              backgroundImage:
                "linear-gradient(225deg, var(--color-storm-grey-100, #eceef2) 0%, var(--color-storm-grey-200, #d5dae2) 72%, var(--color-storm-grey-300, #afb9ca) 100%)",
            }}
          >
            <Avatar.Fallback
              className="fw-semibold bg-transparent"
              style={{ fontSize: 24, letterSpacing: "0.34px", color: "#22262f" }}
            >
              {contactInitials(contact)}
            </Avatar.Fallback>
          </Avatar>
          <div
            className="flex-grow-1 d-flex flex-column"
            style={{ minWidth: 0, gap: 4 }}
          >
            <span className="fw-bold" style={{ fontSize: 24, lineHeight: 1.1 }}>
              {contactFullName(contact)}
            </span>
            <div className="text-muted d-flex flex-column">
              <span style={{ fontSize: 16, fontWeight: 500 }}>
                {contact.title} · {contact.company}
              </span>
              <span style={{ fontSize: 14 }}>
                Created:{" "}
                <span className="fw-bold">{medDate(contact.createdAt)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-between gap-2">
          <div className="d-flex align-items-center flex-wrap gap-2">
            <ContactStageBadge
              relationship={contact.relationship}
              className="d-inline-flex align-items-center"
              style={{ height: 28, fontSize: 14 }}
            />
            <ContactHeroAccessAvatars shares={shares} onOpenShare={onOpenShare} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="contact-details-toggle flex-shrink-0"
            aria-expanded={showDetails}
            onClick={() => setShowDetails(!showDetails)}
          >
            Details
            <FontAwesomeIcon icon={showDetails ? faChevronUp : faChevronDown} />
          </Button>
        </div>

        {showDetails && (
          <div className="contact-details-panel d-flex flex-column gap-3">
            {/* Contact info */}
            <div className="d-flex flex-column gap-2 border-bottom pb-3">
              <InfoRow icon={faPhone}>
                <div className="d-flex flex-column gap-1">
                  {allPhones.map((phone, i) => (
                    <span
                      key={`${phone}-${i}`}
                      className={
                        i === 0 && phoneInvalid
                          ? "text-decoration-line-through text-destructive"
                          : undefined
                      }
                    >
                      {phone}{" "}
                      {i === 0 && (
                        <span className="text-muted fs-small">(mobile)</span>
                      )}
                    </span>
                  ))}
                </div>
              </InfoRow>
              <InfoRow icon={faEnvelope}>
                <div className="d-flex flex-column gap-1" style={{ minWidth: 0 }}>
                  {allEmails.map((email, i) => (
                    <span
                      key={`${email}-${i}`}
                      className="text-truncate d-inline-block w-100"
                    >
                      {email}
                    </span>
                  ))}
                </div>
              </InfoRow>
              <InfoRow icon={faLocationDot}>
                <div>{addressLine1}</div>
                <div>{addressLine2}</div>
              </InfoRow>
            </div>

            {/* Details */}
            <div className="d-flex flex-column gap-2">
              <FieldRow label="Source" value={contact.source} />
              <FieldRow label="Company" value={contact.company} />
              <FieldRow label="Title" value={contact.title} />
              <div className="d-flex flex-wrap align-items-center gap-2 pt-1">
                <span className="fw-semibold">Tags</span>
                {tags.map((t) => (
                  <ContactChip
                    key={t}
                    label={t}
                    removeLabel={`Remove tag ${t}`}
                    onRemove={() =>
                      setTags((prev) => prev.filter((x) => x !== t))
                    }
                  />
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
        <ContactSection
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
                {pastDeals.length > 0 && (
                  <Button
                    variant="ghost"
                    className="w-100"
                    onClick={() => setShowPastDeals(!showPastDeals)}
                  >
                    {showPastDeals
                      ? "Hide Past Deals"
                      : `Show ${pastDeals.length} Past Deal${
                          pastDeals.length > 1 ? "s" : ""
                        }`}
                  </Button>
                )}
                {showPastDeals &&
                  pastDeals.map((d) => (
                    <ContactDealCard key={d.id} listingId={d.id} />
                  ))}
              </>
            )}
          </div>
        </ContactSection>

        <ContactSection
          value="properties"
          label="Properties Owned"
          count={propertyGroups.length}
          open={open.includes("properties")}
        >
          <div className="d-flex flex-column gap-3">
            {propertyGroups.length === 0 ? (
              <span className="text-muted fs-small">None on file.</span>
            ) : (
              propertyGroups.map(([propertyId, listingIds]) => (
                <ContactPropertyCard
                  key={propertyId}
                  propertyId={propertyId}
                  listingIds={listingIds}
                />
              ))
            )}
          </div>
        </ContactSection>

        <ContactSection
          value="lists"
          label="Lists"
          count={0}
          open={open.includes("lists")}
        >
          <div className="text-muted fs-small">
            Lists this contact belongs to will appear here.
          </div>
        </ContactSection>

        <ContactSection
          value="customFields"
          label="Custom Fields"
          open={open.includes("customFields")}
        >
          <div className="text-muted fs-small">
            Org-level custom fields will appear here.
          </div>
        </ContactSection>
      </Accordion>
    </Card>
  );
}
