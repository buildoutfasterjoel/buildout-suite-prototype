import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Accordion } from "@buildoutinc/blueprint-react/ui/Accordion";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRight, faHandshake } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property, PropertyUnit } from "#/data/types";
import { formatAvailabilityHeadline, type PropertyAvailability } from "#/data/propertySpaces";
import { ContactSection } from "#/components/contacts/ContactSection";
import { PROPERTY_CONTACT_ROLE_LABELS, spaceContactRows } from "#/data/propertyContacts";
import { AddPropertyContactModal } from "./AddPropertyContactModal";
import { RailAction } from "./PropertyRecordRail";
import { ContactIdentityChip } from "#/components/contacts/ContactIdentityChip";
import { RecordDealCard } from "#/components/deals/RecordDealCard";
import { TYPE_ICONS, TYPE_LABELS, getPhotoUrl } from "./propertyDisplay";
import { SpaceStatusDot } from "./SpaceStatusDot";
import { PropertyAvailabilityBar } from "./PropertyAvailabilityBar";

/**
 * The space page's right rail. The parent property card leads — the page's
 * orientation device, the one thing that says which building this space is in —
 * then Deals, Contacts and Comps as the same collapsible sections the property's
 * rail and the contact page carry. Contacts and Comps are presentational shells
 * this phase: no space-level comps or activity exist yet.
 */
export function SpaceContextRail({
  property,
  unit,
  availability,
  deal,
  dealOpenable,
  onCreateDeal,
}: {
  property: Property;
  unit: PropertyUnit;
  availability: PropertyAvailability | null;
  deal: Listing | null;
  dealOpenable: boolean;
  onCreateDeal?: () => void;
}) {
  const address = `${property.street}, ${property.city}, ${property.state} ${property.zip}`;
  // The suite's own contacts, the building's owner-side ones it inherits, and
  // the deal's tenant party when nobody has attached them to the unit yet.
  const contactRows = spaceContactRows(property.id, unit.id, deal);
  const [addContactOpen, setAddContactOpen] = useState(false);

  return (
    <div>
      <Card.Body>
        <h6 className="pb-2 fw-semibold">Property</h6>
        <Link
          to="/properties/$propertyId/spaces"
          params={{ propertyId: property.id }}
          className="bg-card border rounded overflow-hidden d-flex text-decoration-none text-reset"
        >
          <img
            src={getPhotoUrl(property.id, 200, 200)}
            alt={property.name}
            className="flex-shrink-0"
            style={{ width: 88, objectFit: "cover" }}
          />
          <div className="p-3 d-flex flex-column gap-1" style={{ minWidth: 0 }}>
            <div className="d-flex align-items-center gap-2 text-muted fs-small">
              <FontAwesomeIcon icon={TYPE_ICONS[property.propertyType]} />
              <span>{TYPE_LABELS[property.propertyType]}</span>
            </div>
            <div className="fw-semibold text-truncate" title={property.name}>
              {property.name}
            </div>
            <div className="text-muted fs-small text-truncate" title={address}>
              {address}
            </div>
            {availability && (
              <div className="d-flex align-items-center gap-2 mt-1 fs-small">
                <SpaceStatusDot status={availability.headline}>
                  {formatAvailabilityHeadline(availability)}
                </SpaceStatusDot>
                <PropertyAvailabilityBar availability={availability} width={72} />
              </div>
            )}
            <span className="fs-small d-inline-flex align-items-center gap-1 text-primary mt-1">
              View all spaces
              <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 11 }} />
            </span>
          </div>
        </Link>
      </Card.Body>

      <Accordion className="contact-overview-accordion contact-overview-accordion--legacy" multiple defaultValue={["deals", "contacts"]}>
        <ContactSection value="deals" label="Deals" count={deal ? 1 : 0}>
          <div className="d-flex flex-column gap-2">
            {deal ? (
              dealOpenable ? (
                <RecordDealCard listingId={deal.id} />
              ) : (
                <span className="text-muted fs-small">
                  A deal is working this space, on a team you don&apos;t have access to.
                </span>
              )
            ) : (
              <>
                <span className="text-muted fs-small">No deal on this space yet.</span>
                {onCreateDeal && (
                  <Button variant="outline" size="sm" className="align-self-start" onClick={onCreateDeal}>
                    <FontAwesomeIcon icon={faHandshake} />
                    Create deal for this space
                  </Button>
                )}
              </>
            )}
          </div>
        </ContactSection>

        <ContactSection
          value="contacts"
          label="Contacts"
          count={contactRows.length}
          action={<RailAction label="Add Contact" onClick={() => setAddContactOpen(true)} />}
        >
          {contactRows.length === 0 ? (
            <span className="text-muted fs-small">No contacts linked to this space yet.</span>
          ) : (
            <div className="d-flex flex-column gap-2">
              {contactRows.map((r) => (
                <ContactIdentityChip
                  key={r.contact.id}
                  contact={r.contact}
                  role={PROPERTY_CONTACT_ROLE_LABELS[r.role]}
                  secondary={r.contact.company}
                  // Where an inherited or deal-sourced row comes from, under the
                  // role on the second line — the suite's own links carry no tag.
                  secondaryEnd={
                    r.source !== "space" ? (
                      <span className="text-muted fs-xs text-uppercase flex-shrink-0">
                        {r.source === "property" ? "Property" : "Deal"}
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
          <AddPropertyContactModal
            propertyId={property.id}
            unitId={unit.id}
            unitLabel={unit.label}
            open={addContactOpen}
            onOpenChange={setAddContactOpen}
          />
        </ContactSection>

        <ContactSection value="comps" label="Comps" count={0}>
          <span className="text-muted fs-small">Space-level comps aren&apos;t tracked yet.</span>
        </ContactSection>
      </Accordion>
    </div>
  );
}
