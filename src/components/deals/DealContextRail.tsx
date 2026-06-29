import { useState } from "react";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faCaretDown } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Listing } from "#/data/types";
import { getProperty, getStore } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
  getRefId,
} from "#/components/properties/propertyDisplay";
import { initials } from "./dealDisplay";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";

function LinkedProperty({ listing }: { listing: Listing }) {
  const property = getProperty(listing.propertyId);
  if (!property) return null;

  const address = `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip}`;

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

function ContactRow({ contact }: { contact: Contact }) {
  const name = `${contact.firstName} ${contact.lastName}`;
  return (
    <div className="d-flex align-items-center gap-2 py-2">
      <Avatar size="sm">
        <Avatar.Fallback>{initials(name)}</Avatar.Fallback>
      </Avatar>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold text-truncate">{name}</div>
        {contact.email && (
          <div className="text-primary text-truncate fs-small">
            {contact.email}
          </div>
        )}
      </div>
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
          contacts.map((c) => <ContactRow key={c.id} contact={c} />)
        )}
      </Accordion.Content>
    </Accordion.Item>
  );
}

/**
 * Persistent right-hand "deal context" rail — keeps the linked property and the
 * deal's contacts in view across every tab of the listing/deal page.
 */
export function DealContextRail({ listing }: { listing: Listing }) {
  const { contacts } = getStore();
  const resolve = (ids: string[]) =>
    ids.map((id) => contacts.get(id)).filter((c): c is Contact => c != null);

  const sellers = resolve(listing.sellerContactIds);
  const buyers = resolve(listing.buyerContactIds);
  const others = resolve(listing.otherContactIds);

  const [open, setOpen] = useState<string[]>(["seller"]);
  const addTo = (section: string) =>
    setOpen((prev) => (prev.includes(section) ? prev : [...prev, section]));

  return (
    <Card>
      <Card.Body>
        <h6 className="pb-2">Property</h6>
        <LinkedProperty listing={listing} />
      </Card.Body>

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
    </Card>
  );
}
