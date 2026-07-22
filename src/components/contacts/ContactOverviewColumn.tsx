import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  faChevronRight,
  faPencil,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact, DealSummary, PropertyStatus } from "#/data/types";
import {
  buildLastTouch,
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
import { ContactLinkButton } from "#/components/contacts/ContactLinkButton";
import { EditContactModal } from "#/components/contacts/EditContactModal";
import { CreateDealModal } from "#/components/deals/CreateDealModal";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useContactListNav } from "#/components/contacts/useContactListNav";
import {
  emptyContactFilters,
  deserializeContactFilters,
} from "#/components/contacts/contactFilterModel";
import { callListToContactList } from "#/data/contactLists";
import { useDataStore } from "#/data/dataStore";
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

/** A "Label value" row used in the expanded contact details. Hidden when the
 *  contact has no value for it. */
function FieldRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
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
  const navigate = useNavigate();
  // Lists this contact belongs to — static (membership snapshot) or dynamic
  // (live filter). Read reactively so joining/leaving a list re-renders here.
  const callListsMap = useDataStore((s) => s.callLists);
  const memberLists = useMemo(
    () =>
      [...callListsMap.values()]
        .map(callListToContactList)
        .filter((l) => l.predicate(contact)),
    [callListsMap, contact],
  );

  // Open the People page filtered to a given list (via the shared restore path).
  // A dynamic list "is" its saved filters (the People page skips the predicate
  // and filters by the working set), so restore those; static lists filter by
  // their membership predicate and start with a clean filter set.
  const openList = (listId: string, label: string) => {
    const cl = callListsMap.get(listId);
    const filters =
      cl?.type === "dynamic" && cl.filters
        ? deserializeContactFilters(cl.filters)
        : emptyContactFilters();
    const nav = useContactListNav.getState();
    nav.setList([], { variant: "list", label, listId, filters, search: "" });
    nav.requestRestore();
    void navigate({ to: "/backoffice/contacts" });
  };

  // Collapse state persists across contacts (see useContactUiPrefs).
  const open = useContactUiPrefs((s) => s.overviewSections);
  const setOpen = useContactUiPrefs((s) => s.setOverviewSections);
  const showDetails = useContactUiPrefs((s) => s.showDetails);
  const setShowDetails = useContactUiPrefs((s) => s.setShowDetails);
  const showPastDeals = useContactUiPrefs((s) => s.showPastDeals);
  const setShowPastDeals = useContactUiPrefs((s) => s.setShowPastDeals);
  const legacyAccordions = useContactUiPrefs((s) => s.legacyAccordions);
  const [tags, setTags] = useState(contact.tags);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addressLine1] = contactAddressLines(contact);
  // City / state / zip, joined cleanly so partial addresses don't show stray
  // commas (e.g. just a state renders "IL", not ", IL ").
  const cityStateZip = [
    [contact.city, contact.state].filter(Boolean).join(", "),
    contact.zip,
  ]
    .filter(Boolean)
    .join(" ");
  const hasAddress = !!(addressLine1 || cityStateZip);
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
    <Card className="contact-panel-card overflow-hidden">
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
            <span
              className="fw-semibold"
              style={{ fontSize: 24, lineHeight: 1.1 }}
            >
              {contactFullName(contact)}
            </span>
            <div className="text-muted d-flex flex-column">
              {(contact.title || contact.company) && (
                <span style={{ fontSize: 16, fontWeight: 500 }}>
                  {[contact.title, contact.company].filter(Boolean).join(" · ")}
                </span>
              )}
              <span style={{ fontSize: 14 }}>
                Last touch:{" "}
                <span className="fw-bold">{buildLastTouch(contact)}</span>
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
            style={{ padding: "8px 12px 8px 8px" }}
            aria-expanded={showDetails}
            onClick={() => setShowDetails(!showDetails)}
          >
            <FontAwesomeIcon
              icon={showDetails ? faChevronDown : faChevronRight}
            />
            Details
          </Button>
        </div>

        {showDetails && (
          <div className="contact-details-panel d-flex flex-column gap-3">
            {/* Contact info — each line hidden when the contact has no value
                for it; the whole block drops out if there's nothing to show. */}
            {(allPhones.length > 0 || allEmails.length > 0 || hasAddress) && (
              <div className="d-flex flex-column gap-2 border-bottom pb-3">
                {allPhones.length > 0 && (
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
                )}
                {allEmails.length > 0 && (
                  <InfoRow icon={faEnvelope}>
                    <div
                      className="d-flex flex-column gap-1"
                      style={{ minWidth: 0 }}
                    >
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
                )}
                {hasAddress && (
                  <InfoRow icon={faLocationDot}>
                    {addressLine1 && <div>{addressLine1}</div>}
                    {cityStateZip && <div>{cityStateZip}</div>}
                  </InfoRow>
                )}
              </div>
            )}

            {/* Details */}
            <div className="d-flex flex-column gap-2">
              <FieldRow label="Source" value={contact.source} />
              <FieldRow label="Company" value={contact.company} />
              <FieldRow label="Title" value={contact.title} />
              <FieldRow label="Created" value={medDate(contact.createdAt)} />
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
        className={`contact-overview-accordion${
          legacyAccordions ? " contact-overview-accordion--legacy" : ""
        }`}
        multiple
        value={open}
        onValueChange={setOpen}
      >
        <ContactSection
          value="deals"
          label="Deals"
          count={activeDeals.length}
          action={
            <Button
              variant="ghost"
              appearance="muted"
              size="icon"
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
          action={
            <Button
              variant="ghost"
              appearance="muted"
              size="icon"
              aria-label="Add property"
            >
              <FontAwesomeIcon icon={faPlus} />
            </Button>
          }
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
          count={memberLists.length}
        >
          {memberLists.length === 0 ? (
            <span className="text-muted fs-small">
              Lists this contact belongs to will appear here.
            </span>
          ) : (
            <div className="d-flex flex-column">
              {memberLists.map((list) => (
                <ContactLinkButton
                  key={list.id}
                  icon={list.icon}
                  iconColor={list.iconColor}
                  iconClassName={list.iconClass}
                  label={list.label}
                  onClick={() => openList(list.id, list.label)}
                />
              ))}
            </div>
          )}
        </ContactSection>

        <ContactSection
          value="customFields"
          label="Custom Fields"
        >
          <div className="text-muted fs-small">
            Org-level custom fields will appear here.
          </div>
        </ContactSection>
      </Accordion>
    </Card>
  );
}
