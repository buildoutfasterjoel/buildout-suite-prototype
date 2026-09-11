import { useState } from "react";
import { useDealAccess } from "./useDealAccess";
import { dealShape } from "#/data/dealShape";
import { Link } from "@tanstack/react-router";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { useContactView } from "#/components/contacts/useVisibleContacts";
import { PrivateContactPlaceholder } from "#/components/contacts/PrivateContactPlaceholder";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCirclePlus,
  faCaretDown,
  faCloudArrowUp,
  faFileLines,
  faFilePdf,
  faFileExcel,
  faSitemap,
  faVectorSquare,
  faArrowUpRight,
} from "@fortawesome/pro-regular-svg-icons";
import { spaceAssetLink } from "./dealCardLink";
import { PROPERTY_CONTACT_ROLE_LABELS, propertyContactRows } from "#/data/propertyContacts";
import { ContactIdentityChip } from "#/components/contacts/ContactIdentityChip";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Contact, Listing, DealDocument, DealBroker } from "#/data/types";
import { getListing, getProperty, getStore } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
  getRefId,
} from "#/components/properties/propertyDisplay";
import { initials } from "./dealDisplay";
import { contactRoleLabel } from "./createDealHelpers";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";

function iconForFile(name: string): IconDefinition {
  if (name.toLowerCase().endsWith(".pdf")) return faFilePdf;
  if (/\.(xlsx?|csv)$/i.test(name)) return faFileExcel;
  return faFileLines;
}

function FileRow({ doc }: { doc: DealDocument }) {
  return (
    <div className="d-flex align-items-center gap-2">
      <span
        className="d-inline-flex align-items-center justify-content-center rounded flex-shrink-0 bg-body-secondary text-muted"
        style={{ width: 32, height: 32 }}
      >
        <FontAwesomeIcon icon={iconForFile(doc.name)} />
      </span>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold text-truncate fs-small">{doc.name}</div>
        {doc.size && <div className="text-muted fs-small">{doc.size}</div>}
      </div>
    </div>
  );
}

function FilesSection({ documents }: { documents: DealDocument[] }) {
  return (
    <Card.Body>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="mb-0 fw-semibold">Files</h6>
        <Button variant="outline" size="sm" aria-label="Add file">
          <FontAwesomeIcon icon={faCirclePlus} />
          Add
        </Button>
      </div>

      <Empty className="py-3">
        <Empty.Media>
          <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden />
        </Empty.Media>
        <Empty.Content>Drop files here or click to upload.</Empty.Content>
      </Empty>

      <div className="d-flex flex-column gap-2 mt-3">
        {documents.map((d) => (
          <FileRow key={d.id} doc={d} />
        ))}
      </div>
    </Card.Body>
  );
}

function LinkedProperty({ listing }: { listing: Listing }) {
  const property = getProperty(listing.propertyId);
  if (!property) return null;

  const address = `${property.street}, ${property.city}, ${property.state} ${property.zip}`;
  // A space deal points at one unit; the property record has a page for it —
  // the unit's own facts, whether or not this deal exists. `spaceAssetLink` is
  // the one rule for that crossing, as `dealCardLinkProps` is for the way back.
  const unit = listing.parentDealId && listing.unitId
    ? property.units.find((u) => u.id === listing.unitId)
    : undefined;

  return (
    <div className="d-flex flex-column gap-2">
      <Link
        to="/properties/$propertyId"
        params={{ propertyId: property.id }}
        className="bg-card border rounded overflow-hidden d-flex text-decoration-none text-reset"
      >
        <img
          src={getPhotoUrl(listing.id, 200, 200)}
          alt={property.name}
          className="flex-shrink-0"
          style={{ width: 88, objectFit: "cover" }}
        />
        <div className="p-3 d-flex flex-column gap-1" style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 text-muted fs-small">
            <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
            <span>{TYPE_LABELS[property.propertyType]}</span>
            <span>·</span>
            <span>#{getRefId(listing.id)}</span>
          </div>
          <div className="fw-semibold text-truncate" title={property.name}>
            {property.name}
          </div>
          <div className="text-muted fs-small text-truncate" title={address}>
            {address}
          </div>
        </div>
      </Link>
      {unit && (
        <Link
          {...spaceAssetLink(property.id, unit.id)}
          className="d-flex align-items-center gap-2 fs-small text-decoration-none"
        >
          <FontAwesomeIcon icon={faVectorSquare} />
          <span className="flex-grow-1 text-truncate">{unit.label} on the property record</span>
          <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 11 }} />
        </Link>
      )}
    </div>
  );
}

/** The umbrella deal a child space deal belongs to — a click takes you back up. */
function LinkedParentDeal({ parent }: { parent: Listing }) {
  const property = getProperty(parent.propertyId);
  const address = property
    ? `${property.street}, ${property.city}, ${property.state} ${property.zip}`
    : "";
  return (
    <Link
      to="/listings/$listingId"
      params={{ listingId: parent.id }}
      className="bg-card border rounded overflow-hidden d-flex text-reset text-decoration-none"
    >
      <img
        src={getPhotoUrl(parent.id, 200, 200)}
        alt={parent.name}
        className="flex-shrink-0"
        style={{ width: 88, objectFit: "cover" }}
      />
      <div className="p-3 d-flex flex-column gap-1" style={{ minWidth: 0 }}>
        <div className="d-flex align-items-center gap-2 text-muted fs-small">
          <FontAwesomeIcon icon={faSitemap} />
          <span>Umbrella deal</span>
          <span>·</span>
          <span>#{getRefId(parent.id)}</span>
        </div>
        <div className="fw-semibold text-truncate" title={parent.name}>
          {parent.name}
        </div>
        {address && (
          <div className="text-muted fs-small text-truncate" title={address}>
            {address}
          </div>
        )}
      </div>
    </Link>
  );
}

/**
 * A party on the deal, as the Figma contact chip (the same row the property
 * and space rails use): gradient avatar, name with `role` floated right, company
 * beneath. `role` is the side the section names — Landlord, Tenant, Other — or
 * a property role in the Property contacts section.
 */
function ContactRow({ contact, role }: { contact: Contact; role?: string }) {
  // A private party the viewer has no relationship with shows as a placeholder:
  // the deal is the firm's business even when the relationship isn't.
  const view = useContactView(contact);
  if (view.kind === "private") {
    return (
      <PrivateContactPlaceholder contactId={view.contactId} askName={view.askName} />
    );
  }
  return (
    <div className="py-1">
      <ContactIdentityChip contact={contact} role={role} secondary={contact.company} />
    </div>
  );
}

function ContactSection({
  value,
  label,
  contacts,
}: {
  value: string;
  label: string;
  contacts: Contact[];
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Trigger>
        <span className="d-flex align-items-center gap-2">
          {label}
          <Badge variant="secondary" appearance="muted">
            {contacts.length}
          </Badge>
        </span>
      </Accordion.Trigger>
      <Accordion.Content>
        {contacts.length === 0 ? (
          <div className="text-muted fs-small py-2">No contacts added.</div>
        ) : (
          contacts.map((c) => <ContactRow key={c.id} contact={c} role={label} />)
        )}
      </Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * A broker row in the rail — mirrors ContactRow, with the gross commission % on
 * the right. The split is the only money on the Overview, so it is what a
 * marketing-only share hides: the row still names the broker, because knowing
 * who works the deal is not a financial fact.
 *
 * The column is dropped rather than marked. A lock or a "Hidden" tells someone
 * a figure exists and is being kept from them, which is worth saying on the
 * voucher — that page is about the money, and a broker reading it needs to know
 * the row is not simply blank. Here it is worth nothing: a marketing person has
 * no business with the split and no reason to learn there is one.
 */
function BrokerRow({ broker, showsMoney }: { broker: DealBroker; showsMoney: boolean }) {
  return (
    <div className="d-flex align-items-center gap-2 py-2">
      <Avatar size="lg">
        <Avatar.Fallback>{initials(broker.name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold text-truncate">{broker.name}</div>
        {broker.role && (
          <div className="text-muted text-truncate fs-small">{broker.role}</div>
        )}
      </div>
      {showsMoney && (
        <div className="text-end flex-shrink-0">
          <div className="fw-semibold">{broker.commissionSplitPct}%</div>
          <div className="text-muted fs-small">Gross comm.</div>
        </div>
      )}
    </div>
  );
}

function BrokerSection({
  value,
  label,
  brokers,
  showsMoney,
}: {
  value: string;
  label: string;
  brokers: DealBroker[];
  showsMoney: boolean;
}) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Trigger>
        <span className="d-flex align-items-center gap-2">
          {label}
          <Badge variant="secondary" appearance="muted">
            {brokers.length}
          </Badge>
        </span>
      </Accordion.Trigger>
      <Accordion.Content>
        {brokers.length === 0 ? (
          <div className="text-muted fs-small py-2">No brokers added.</div>
        ) : (
          brokers.map((b) => (
            <BrokerRow key={b.id} broker={b} showsMoney={showsMoney} />
          ))
        )}
      </Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * Persistent right-hand "deal context" rail — keeps files, the linked property,
 * the deal's contacts, and the deal summary in view across every tab.
 */
export function DealContextRail({ listing }: { listing: Listing }) {
  const { contacts } = getStore();
  const resolve = (ids: string[]) =>
    ids.map((id) => contacts.get(id)).filter((c): c is Contact => c != null);

  const parent = listing.parentDealId ? getListing(listing.parentDealId) : undefined;

  // The rail's Files section is for the broker's own uploads only — Buildout's
  // AI-generated documents surface on the Documents page instead.
  const documents = (listing.documents ?? []).filter((d) => !d.aiGenerated);
  const sellers = resolve(listing.sellerContactIds);
  // The buy side of a lease is its tenant, and a space's *accepted* tenant is
  // kept on `tenantContactIds` (the list the stage gate and vouchers read) rather
  // than the buyer list — so the Tenant section reads both, deduped, or a suite
  // under contract would show "Tenant 0" with its tenant right there on the voucher.
  const buyers = resolve([...new Set([...listing.buyerContactIds, ...listing.tenantContactIds])]);
  const others = resolve(listing.otherContactIds);

  // The two sides are `seller`/`buyer` in the data model, but a lease calls them
  // Landlord and Tenant. Same helper the create-deal wizard uses, so a deal reads
  // the same way in the rail as it did when it was created.
  const sellSideLabel = contactRoleLabel("seller", listing.dealType);
  const buySideLabel = contactRoleLabel("buyer", listing.dealType);

  const [open, setOpen] = useState<string[]>(["seller", "property"]);
  // The property's own contacts — production's "Other Contacts" on a deal shows
  // the connected property's people with their property role. Deal parties are
  // already listed above, so they drop out here; adding a Seller to the deal
  // does not attach them to the property (true in production too).
  const partyIds = new Set([
    ...listing.sellerContactIds,
    ...listing.buyerContactIds,
    ...listing.tenantContactIds,
    ...listing.otherContactIds,
  ]);
  // Which suite-scoped contacts belong on this deal's rail:
  // - a **shell** shows none — it manages the building and delegates each suite
  //   to its space deal, where that suite's tenant is already a party;
  // - a **space deal** shows only its own suite's;
  // - a **sale or flat lease** shows every suite's — in-place tenants are what a
  //   buyer or broker wants to see on the building's deal.
  // Building-level contacts (owner-side, lender) show on every deal.
  const shape = dealShape(listing);
  const property = getProperty(listing.propertyId);
  const propertyRows = propertyContactRows(listing.propertyId).filter((r) => {
    if (partyIds.has(r.contact.id)) return false;
    if (!r.unitId) return true;
    if (shape === "shell") return false;
    if (shape === "space") return r.unitId === listing.unitId;
    return true;
  });
  const addTo = (section: string) =>
    setOpen((prev) => (prev.includes(section) ? prev : [...prev, section]));

  const access = useDealAccess(listing);
  // A shell has no commission of its own — its spaces carry the transactions —
  // so there is no money here to show or hide. Asking the shape rather than the
  // access level keeps `backOffice: "view"` meaning only "may open the Vouchers
  // index", which is all it means on a shell.
  const showsMoney = dealShape(listing) !== "shell" && access.backOffice !== "none";

  const [brokersOpen, setBrokersOpen] = useState<string[]>(["internal"]);
  const addBroker = (section: string) =>
    setBrokersOpen((prev) => (prev.includes(section) ? prev : [...prev, section]));

  return (
    <div>
      {parent && (
        <>
          <Card.Body>
            <h6 className="pb-2 fw-semibold">Parent</h6>
            <LinkedParentDeal parent={parent} />
          </Card.Body>
          <Separator />
        </>
      )}

      <FilesSection documents={documents} />

      <Separator />

      <Card.Body>
        <h6 className="pb-2 fw-semibold">Property</h6>
        <LinkedProperty listing={listing} />
      </Card.Body>

      <Separator />

      <div className="d-flex align-items-center justify-content-between px-3 py-2">
        <h6 className="mb-0 fw-semibold">Contacts</h6>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline" size="sm">
                <FontAwesomeIcon icon={faCirclePlus} />
                Add
                <FontAwesomeIcon icon={faCaretDown} />
              </Button>
            }
          />
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => addTo("seller")}>
              Add {sellSideLabel}
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => addTo("buyer")}>
              Add {buySideLabel}
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => addTo("other")}>
              Add Other
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <Accordion multiple value={open} onValueChange={setOpen}>
        <ContactSection
          value="seller"
          label={sellSideLabel}
          contacts={sellers}
        />
        <ContactSection
          value="buyer"
          label={buySideLabel}
          contacts={buyers}
        />
        <ContactSection value="other" label="Other" contacts={others} />
        <Accordion.Item value="property">
          <Accordion.Trigger>
            <span className="d-flex align-items-center gap-2">
              Property contacts
              <Badge variant="secondary" appearance="muted">
                {propertyRows.length}
              </Badge>
            </span>
          </Accordion.Trigger>
          <Accordion.Content>
            {propertyRows.length === 0 ? (
              <div className="text-muted fs-small py-2">No contacts on the property beyond the parties above.</div>
            ) : (
              propertyRows.map((r) => (
                <ContactRow
                  key={r.contact.id}
                  contact={r.contact}
                  // Suite-scoped links name their suite, as on the property page.
                  role={
                    PROPERTY_CONTACT_ROLE_LABELS[r.role] +
                    (r.unitId ? ` • ${property?.units.find((u) => u.id === r.unitId)?.label ?? "space"}` : "")
                  }
                />
              ))
            )}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion>

      <div className="d-flex align-items-center justify-content-between px-3 py-2">
        <h6 className="mb-0 fw-semibold">Brokers</h6>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline" size="sm">
                <FontAwesomeIcon icon={faCirclePlus} />
                Add
                <FontAwesomeIcon icon={faCaretDown} />
              </Button>
            }
          />
          <DropdownMenu.Content>
            <DropdownMenu.Item onClick={() => addBroker("internal")}>
              Add internal broker
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => addBroker("outside")}>
              Add outside broker
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <Accordion multiple value={brokersOpen} onValueChange={setBrokersOpen}>
        <BrokerSection
          value="internal"
          label="Internal"
          brokers={listing.internalBrokers}
          showsMoney={showsMoney}
        />
        <BrokerSection
          value="outside"
          label="Outside"
          brokers={listing.outsideBrokers}
          showsMoney={showsMoney}
        />
      </Accordion>
    </div>
  );
}
