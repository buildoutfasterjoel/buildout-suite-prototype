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
} from "@fortawesome/pro-regular-svg-icons";
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

  // TODO: link to property page once a standalone /properties/$id route exists.
  return (
    <div className="bg-card border rounded overflow-hidden d-flex">
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

function ContactRow({ contact }: { contact: Contact }) {
  // A private party the viewer has no relationship with shows as a placeholder:
  // the deal is the firm's business even when the relationship isn't.
  const view = useContactView(contact);
  if (view.kind === "private") {
    return (
      <PrivateContactPlaceholder contactId={view.contactId} askName={view.askName} />
    );
  }
  const name = `${contact.firstName} ${contact.lastName}`;
  return (
    <Link
      to="/backoffice/contacts/$contactId"
      params={{ contactId: contact.id }}
      className="d-flex align-items-center gap-2 py-2 text-reset text-decoration-none"
    >
      <Avatar size="lg">
        <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold text-truncate">{name}</div>
        {contact.company && (
          <div className="text-muted text-truncate fs-small">
            {contact.company}
          </div>
        )}
      </div>
    </Link>
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
          contacts.map((c) => <ContactRow key={c.id} contact={c} />)
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
  const buyers = resolve(listing.buyerContactIds);
  const others = resolve(listing.otherContactIds);

  // The two sides are `seller`/`buyer` in the data model, but a lease calls them
  // Landlord and Tenant. Same helper the create-deal wizard uses, so a deal reads
  // the same way in the rail as it did when it was created.
  const sellSideLabel = contactRoleLabel("seller", listing.dealType);
  const buySideLabel = contactRoleLabel("buyer", listing.dealType);

  const [open, setOpen] = useState<string[]>(["seller"]);
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
