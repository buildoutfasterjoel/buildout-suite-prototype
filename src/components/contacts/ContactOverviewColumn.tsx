import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Switch } from "@buildoutinc/blueprint-react/ui/Switch";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faPencil } from "@fortawesome/pro-regular-svg-icons";
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
import { ContactTagPicker } from "#/components/contacts/ContactTagPicker";
import {
  ContactHeroAccessAvatars,
  ContactPrivacyBadge,
} from "#/components/contacts/ContactHeroAccessAvatars";
import { ContactHeroInfo } from "#/components/contacts/ContactHeroInfo";
import { useComposeFocus } from "#/components/contacts/useComposeFocus";
import { callFlow } from "#/components/call/callFlow";
import type { ContactShare } from "#/data/teammates";
import { viewerOwns, type ContactOwnership } from "#/data/contactOwnership";
import { ContactDealCard } from "#/components/contacts/ContactDealCard";
import { ContactInquiryCard } from "#/components/contacts/ContactInquiryCard";
import { NewContactInquiryCard } from "#/components/contacts/NewContactInquiryCard";
import { inquiryFacts } from "#/components/contacts/inquiryFacts";
import { ContactPropertyCard } from "#/components/contacts/ContactPropertyCard";
import { NewContactDealCard } from "#/components/contacts/NewContactDealCard";
import { NewContactPropertyCard } from "#/components/contacts/NewContactPropertyCard";
import { ContactLinkButton } from "#/components/contacts/ContactLinkButton";
import { EditContactModal } from "#/components/contacts/EditContactModal";
import { CreateDealModal } from "#/components/deals/CreateDealModal";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";
import { useDealSpotlight } from "#/components/contacts/useDealSpotlight";
import { useContactListNav } from "#/components/contacts/useContactListNav";
import {
  emptyContactFilters,
  deserializeContactFilters,
} from "#/components/contacts/contactFilterModel";
import { callListToContactList } from "#/data/contactLists";
import { useDataStore } from "#/data/dataStore";
import { removeContactTags, updateContact } from "#/data/actions";

/** Deal statuses considered "past" (shown behind a toggle). */
const PAST_STATUSES = new Set<PropertyStatus>(["closed", "inactive"]);

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The "+" in a section header. Icon-only, so it needs the tooltip to say what it
 * creates — and the tooltip label doubles as the accessible name.
 */
function SectionAction({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            appearance="muted"
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
          >
            <FontAwesomeIcon icon={faPlus} />
          </Button>
        }
      />
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
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
  leadDeals,
  shares,
  ownership,
  onOpenShare,
  onTogglePrivate,
}: {
  contact: Contact;
  /** Deals the contact is a named party to. */
  deals: DealSummary[];
  /** Deals they only appear on as a lead — listed alongside, but not "theirs". */
  leadDeals: DealSummary[];
  shares: ContactShare[];
  /** Who owns and works the record, and whether it's hidden — see `useContactOwnership`. */
  ownership: ContactOwnership;
  onOpenShare: () => void;
  onTogglePrivate: (next: boolean) => void;
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
  // Design-comparison switch (see ContactDesignToggles) — flips the deal and
  // property cards between the shipped look and the redesigned deal-tile.
  const newCards = useContactUiPrefs((s) => s.dealCards) === "new";
  // Tags render straight off the record, and removing one writes to the store.
  // They used to live in component state, which had two costs: a removal was
  // forgotten on reload, and the assistant's `add_contact_tags` /
  // `remove_contact_tags` changed the record under a panel that kept showing
  // the stale list. `doNotCall` is still local — nothing writes it yet.
  const tags = contact.tags;
  const [doNotCall, setDoNotCall] = useState(!!contact.doNotCall);
  // A call session walks contact to contact on the *same* route, so this
  // component doesn't remount — re-seed the local switch when the record under
  // it changes, or the previous person's setting stays on screen.
  const [tagsContactId, setTagsContactId] = useState(contact.id);
  if (tagsContactId !== contact.id) {
    setTagsContactId(contact.id);
    setDoNotCall(!!contact.doNotCall);
  }
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
  // One line, same as the design — a mailing address is read, not scanned, so
  // splitting it over two rows only adds height to the block above the deals.
  const addressLine = [addressLine1, cityStateZip].filter(Boolean).join(", ");
  const phoneInvalid = contact.phoneStatus === "invalid";

  // Primary phone/email first, then any extras (de-duplicated) — the details
  // panel lists them all.
  const allPhones = [
    ...new Set([contact.phone, ...(contact.phones ?? [])].filter(Boolean)),
  ];
  const allEmails = [
    ...new Set([contact.email, ...(contact.emails ?? [])].filter(Boolean)),
  ];

  // Deals shows only deals the contact is a named party to — a lead connection
  // is not a business agreement, so lead-only listings render as inquiry cards
  // in Listing Inquiries instead (a lead opened from a deal's Leads tab finds
  // that deal there). They graduate to a deal card only once they're set as a
  // party, e.g. named the buyer when the deal moves to under contract.
  const activeDeals = deals.filter((d) => !PAST_STATUSES.has(d.status));
  const pastDeals = deals.filter((d) => PAST_STATUSES.has(d.status));

  // Listings this contact has raised a hand on: every open inquiry plus any
  // listing whose Leads tab they appear on, deduped. Listings they've since
  // become a party to drop out — the deal card supersedes the inquiry card.
  const partyDealIds = new Set(deals.map((d) => d.id));
  const inquiryListingIds = [
    ...new Set([
      ...(contact.inquiredListingIds ?? []),
      ...leadDeals.map((d) => d.id),
    ]),
  ]
    .filter((id) => !partyDealIds.has(id))
    // Newest inquiry first — the freshest interest is the one worth working, and
    // it's what the broker is looking for when they open the section.
    .sort(
      (a, b) =>
        new Date(inquiryFacts(contact, b).date).getTime() -
        new Date(inquiryFacts(contact, a).date).getTime(),
    );

  // A just-created deal (AI Start-a-Deal flow) gets a brief spotlight; clear
  // the signal once the animation has played so it doesn't replay on
  // re-renders or follow the user to another contact.
  const spotlightDealId = useDealSpotlight((s) => s.dealId);
  useEffect(() => {
    if (!spotlightDealId) return;
    const t = setTimeout(() => useDealSpotlight.getState().clear(), 3000);
    return () => clearTimeout(t);
  }, [spotlightDealId]);

  // One card per property in "Properties" — group the contact's deals by
  // property so a property with several deals shows a single card, not one per
  // deal. Order follows first appearance in `deals`. Owned properties without
  // a deal (e.g. a building the contact holds but hasn't listed) still get a
  // card, with no deal chip. Party deals only — being a lead on a property is
  // not ownership.
  const propertyGroupMap = deals.reduce((map, d) => {
    map.set(d.propertyId, [...(map.get(d.propertyId) ?? []), d.id]);
    return map;
  }, new Map<string, string[]>());
  for (const pid of contact.ownedPropertyIds ?? []) {
    if (!propertyGroupMap.has(pid)) propertyGroupMap.set(pid, []);
  }
  const propertyGroups = Array.from(propertyGroupMap);

  return (
    <Card className="panel-card overflow-hidden">
      <CreateDealModal
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        contact={contact}
      />

      {/* Contact hero */}
      <div className="p-4 d-flex flex-column gap-3 position-relative">
        <Tooltip>
          <Tooltip.Trigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit contact details"
                className="position-absolute"
                style={{ top: 8, right: 8 }}
                onClick={() => setEditOpen(true)}
              >
                <FontAwesomeIcon icon={faPencil} />
              </Button>
            }
          />
          <Tooltip.Content>Edit Contact Details</Tooltip.Content>
        </Tooltip>

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
          <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
            <span
              className="fw-semibold"
              style={{ fontSize: 24, lineHeight: "27px" }}
            >
              {contactFullName(contact)}
            </span>
            {/* Both supporting lines sit at body size — they're context for the
                name, not headings of their own. Only the last-touch value is
                emphasized, because that's the fact the broker scans for. */}
            <div
              className="text-muted d-flex flex-column"
              style={{ fontSize: 14, lineHeight: "19px" }}
            >
              {(contact.title || contact.company) && (
                <span>
                  {[contact.title, contact.company].filter(Boolean).join(" · ")}
                </span>
              )}
              <span>
                Last touch:{" "}
                <span className="fw-semibold">{buildLastTouch(contact)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Stage · Public/Private · who has access. This row keeps growing
            (the privacy badge and the assignee avatar both landed here), so the
            details toggle moved off it to a row of its own — see Figma
            3262:115240. */}
        <div className="d-flex align-items-center flex-wrap gap-2">
          {/* The compact People-table badge, unscaled — the hero used to size
              it up to match the deal cards, but at 28px it read as the loudest
              thing on the card, ahead of the name. */}
          <ContactStageBadge
            relationship={contact.relationship}
            className="d-inline-flex align-items-center"
          />
          {ownership.canMarkPrivate && (
            <ContactPrivacyBadge isPrivate={ownership.isPrivate} />
          )}
          <ContactHeroAccessAvatars
            ownership={ownership}
            shares={shares}
            onOpenShare={onOpenShare}
          />
        </div>

        <Button
          variant="outline"
          className="contact-details-toggle w-100 justify-content-center"
          aria-expanded={showDetails}
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? "Hide Contact Details" : "Show Contact Details"}
        </Button>

        {showDetails && (
          <div className="contact-details-panel d-flex flex-column gap-3">
            {/* Reach-out records. Keyed by contact so the per-type Show/Hide
                state resets when a call session steps to the next person —
                this component doesn't remount on its own. */}
            <ContactHeroInfo
              key={contact.id}
              contactId={contact.id}
              phones={allPhones}
              emails={allEmails}
              addressLine={addressLine}
              phoneInvalid={phoneInvalid}
              onDial={(phone) => callFlow.open(contact, phone)}
              onEmail={() => useComposeFocus.getState().request("email")}
            />

            {/* Details */}
            <div className="d-flex flex-column gap-3 border-bottom pb-3">
              <FieldRow label="Source" value={contact.source} />
              <FieldRow label="Company" value={contact.company} />
              <FieldRow label="Title" value={contact.title} />
              <FieldRow label="Created" value={medDate(contact.createdAt)} />
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="fw-semibold">Tags</span>
                {tags.map((t) => (
                  <ContactChip
                    key={t}
                    label={t}
                    appearance="muted"
                    removeLabel={`Remove tag ${t}`}
                    onRemove={() => removeContactTags(contact.id, [t])}
                  />
                ))}
                <ContactTagPicker contact={contact} />
              </div>
            </div>

            {/* Privacy is the owner's act, so the switch appears only for the
                signed-in owner, and only when the company lets them mark
                contacts private. The state itself shows on the hero badge. */}
            {ownership.canMarkPrivate && viewerOwns(ownership) && (
              <label
                className="d-flex align-items-center gap-2 mb-0 align-self-start"
                style={{ cursor: "pointer" }}
              >
                {/* A state label, like Do Not Call below it — "Make Private"
                    read as a verb once the switch was on. */}
                <Switch
                  checked={ownership.isPrivate}
                  onCheckedChange={onTogglePrivate}
                  aria-label="Private Contact"
                />
                <span>Private Contact</span>
              </label>
            )}

            {/* A switch, not a button: do-not-call is a state the record is in,
                and the control should show which way it's currently set.
                TODO: wire up — flagging a contact has to suppress them across
                call lists and campaigns, not just here. */}
            <label
              className="d-flex align-items-center gap-2 mb-0 align-self-start"
              style={{ cursor: "pointer" }}
            >
              {/* Blueprint's Switch ships only md and lg — md is the small one. */}
              <Switch checked={doNotCall} onCheckedChange={setDoNotCall} />
              <span>Do Not Call</span>
            </label>
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
            <SectionAction
              label="Create New Deal"
              onClick={() => setNewDealOpen(true)}
            />
          }
        >
          <div className="d-flex flex-column gap-2">
            {deals.length === 0 ? (
              <span className="text-muted fs-small">
                Deals you link to this contact will show up here.
              </span>
            ) : (
              <>
                {activeDeals.map((d) =>
                  newCards ? (
                    <NewContactDealCard
                      key={d.id}
                      listingId={d.id}
                      contact={contact}
                      highlight={d.id === spotlightDealId}
                    />
                  ) : (
                    <ContactDealCard
                      key={d.id}
                      listingId={d.id}
                      contactId={contact.id}
                      highlight={d.id === spotlightDealId}
                    />
                  ),
                )}
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
                  pastDeals.map((d) =>
                    newCards ? (
                      <NewContactDealCard
                        key={d.id}
                        listingId={d.id}
                        contact={contact}
                      />
                    ) : (
                      <ContactDealCard key={d.id} listingId={d.id} contactId={contact.id} />
                    ),
                  )}
              </>
            )}
          </div>
        </ContactSection>

        <ContactSection
          value="inquiries"
          label="Listing Inquiries"
          count={inquiryListingIds.length}
        >
          <div className="d-flex flex-column gap-2">
            {inquiryListingIds.length === 0 ? (
              <span className="text-muted fs-small">
                Listings this contact inquires about will show up here.
              </span>
            ) : (
              inquiryListingIds.map((listingId) =>
                newCards ? (
                  <NewContactInquiryCard
                    key={listingId}
                    listingId={listingId}
                    contact={contact}
                  />
                ) : (
                  <ContactInquiryCard
                    key={listingId}
                    listingId={listingId}
                    contact={contact}
                  />
                ),
              )
            )}
          </div>
        </ContactSection>

        <ContactSection
          value="properties"
          label="Properties"
          count={propertyGroups.length}
          action={<SectionAction label="Create New Property" />}
        >
          <div className="d-flex flex-column gap-2">
            {propertyGroups.length === 0 ? (
              <span className="text-muted fs-small">None on file.</span>
            ) : (
              propertyGroups.map(([propertyId, listingIds]) =>
                newCards ? (
                  <NewContactPropertyCard
                    key={propertyId}
                    propertyId={propertyId}
                    listingIds={listingIds}
                    contactName={contactFullName(contact)}
                  />
                ) : (
                  <ContactPropertyCard
                    key={propertyId}
                    propertyId={propertyId}
                    listingIds={listingIds}
                  />
                ),
              )
            )}
          </div>
        </ContactSection>

        <ContactSection
          value="lists"
          label="Lists"
          count={memberLists.length}
          action={<SectionAction label="Add to List" />}
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
