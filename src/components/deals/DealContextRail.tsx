import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
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
import type { Contact, Listing, DealDocument } from "#/data/types";
import { getListing, getProperty, getStore } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
  getRefId,
} from "#/components/properties/propertyDisplay";
import { initials } from "./dealDisplay";
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
        <h6 className="mb-0">Files</h6>
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
 * Persistent right-hand "deal context" rail — keeps files, the linked property,
 * the deal's contacts, and the deal summary in view across every tab.
 */
export function DealContextRail({ listing }: { listing: Listing }) {
  const { contacts } = getStore();
  const resolve = (ids: string[]) =>
    ids.map((id) => contacts.get(id)).filter((c): c is Contact => c != null);

  const parent = listing.parentDealId
    ? getListing(listing.parentDealId)
    : undefined;

  const documents = listing.documents ?? [];
  const sellers = resolve(listing.sellerContactIds);
  const buyers = resolve(listing.buyerContactIds);
  const others = resolve(listing.otherContactIds);

  const [open, setOpen] = useState<string[]>(["seller"]);
  const addTo = (section: string) =>
    setOpen((prev) => (prev.includes(section) ? prev : [...prev, section]));

  return (
    <div>
      {parent && (
        <>
          <Card.Body>
            <h6 className="pb-2">Parent</h6>
            <LinkedParentDeal parent={parent} />
          </Card.Body>
          <Separator />
        </>
      )}

      <FilesSection documents={documents} />

      <Separator />

      <Card.Body>
        <h6 className="pb-2">Property</h6>
        <LinkedProperty listing={listing} />
      </Card.Body>

      <Separator />

      <div className="d-flex align-items-center justify-content-between px-3 py-2">
        <h6 className="mb-0">Contacts</h6>
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
              Add Seller
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => addTo("buyer")}>
              Add Buyer
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={() => addTo("other")}>
              Add Other
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <Accordion multiple value={open} onValueChange={setOpen}>
        <ContactSection value="seller" label="Seller" contacts={sellers} />
        <ContactSection value="buyer" label="Buyer" contacts={buyers} />
        <ContactSection value="other" label="Other" contacts={others} />
      </Accordion>
    </div>
  );
}
