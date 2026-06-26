import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faUser } from "@fortawesome/pro-regular-svg-icons";
import type { Contact, Listing } from "#/data/types";
import { getStore } from "#/data/store";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { initials } from "./dealDisplay";

function ContactRow({ contact, role }: { contact: Contact; role: string }) {
  return (
    <div className="d-flex align-items-center gap-3 py-2">
      <Avatar>
        <Avatar.Fallback>
          {initials(`${contact.firstName} ${contact.lastName}`)}
        </Avatar.Fallback>
      </Avatar>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="text-muted" style={{ fontSize: 12 }}>
          Contact | {role}
        </div>
        <div className="fw-semibold text-truncate">
          {contact.firstName} {contact.lastName}
        </div>
        {contact.email && (
          <div className="text-primary text-truncate" style={{ fontSize: 13 }}>
            {contact.email}
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyRow({ company }: { company: string }) {
  return (
    <div className="d-flex align-items-center gap-3 py-2">
      <Avatar>
        <Avatar.Fallback>{initials(company)}</Avatar.Fallback>
      </Avatar>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="text-muted" style={{ fontSize: 12 }}>
          Company
        </div>
        <div className="fw-semibold text-truncate">{company}</div>
      </div>
    </div>
  );
}

function ContactCard({
  title,
  required,
  addLabel,
  children,
  empty,
}: {
  title: string;
  required?: boolean;
  addLabel: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="bg-card border rounded h-100" style={{ borderRadius: 6 }}>
      <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
        <h2 className="fs-6 fw-semibold mb-0">
          {title}
          {required && <span className="text-danger ms-1">*</span>}
        </h2>
        <Button variant="ghost" size="sm">
          <FontAwesomeIcon icon={faPlus} />
          {addLabel}
        </Button>
      </div>
      <div className="px-4 py-2">
        {empty ? (
          <Empty className="py-4">
            <Empty.Media>
              <FontAwesomeIcon icon={faUser} aria-hidden />
            </Empty.Media>
            <Empty.Content>No contacts have been added.</Empty.Content>
          </Empty>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function DealContacts({ listing }: { listing: Listing }) {
  const { contacts } = getStore();
  const sellers = listing.sellerContactIds
    .map((id) => contacts.get(id))
    .filter((c): c is Contact => c != null);
  const buyers = listing.buyerContactIds
    .map((id) => contacts.get(id))
    .filter((c): c is Contact => c != null);
  const others = listing.otherContactIds
    .map((id) => contacts.get(id))
    .filter((c): c is Contact => c != null);

  const sellerCompany = sellers[0]?.company;

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Contacts" />
      <div className="row g-4">
        <div className="col-lg-6">
          <ContactCard title="Seller" required addLabel="Add seller">
            {sellers.map((c) => (
              <ContactRow key={c.id} contact={c} role="Seller" />
            ))}
            {sellerCompany && <CompanyRow company={sellerCompany} />}
          </ContactCard>
        </div>
        <div className="col-lg-6">
          <ContactCard title="Buyer" addLabel="Add buyer" empty={buyers.length === 0}>
            {buyers.map((c) => (
              <ContactRow key={c.id} contact={c} role="Buyer" />
            ))}
          </ContactCard>
        </div>
      </div>

      <ContactCard
        title="Other Contacts"
        addLabel="Add contact"
        empty={others.length === 0}
      >
        {others.map((c) => (
          <ContactRow key={c.id} contact={c} role="Other" />
        ))}
      </ContactCard>
    </div>
  );
}
