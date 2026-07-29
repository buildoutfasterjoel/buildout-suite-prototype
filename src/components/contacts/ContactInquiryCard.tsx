import { Link, useNavigate } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faFileContract,
  faUserGroup,
} from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { inquiryFacts } from "#/components/contacts/inquiryFacts";
import { ContactLinkButton } from "#/components/contacts/ContactLinkButton";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A listing inquiry on the contact detail page — deliberately NOT a deal card.
 * An inquiry is a cold contact raising a hand on a marketed listing (a contact
 * form, or a document-access request that carries a CA), which is a far weaker
 * connection than being a party to a deal, so the card shows the inquiry's own
 * facts (type, CA status, channel, their message) and none of the deal-card
 * signals (stage, side, price) that would read as an active business agreement.
 *
 * What it shows, in order of usefulness to the broker:
 * 1. the listing (thumbnail + name — the name links to the deal page),
 * 2. channel + date the inquiry landed,
 * 3. type badge (Document Request vs Contact Form) and, for document
 *    requests, the CA status — the strongest action cue on the card,
 * 4. the contact's own message, when they wrote one.
 *
 * A plain click anywhere navigates to the listing's Leads tab pre-searched to
 * this contact — that row is where the broker acts on an inquiry (grants
 * access, updates CA/lead status), so the card's primary action lands there
 * rather than dead-ending on the listing overview.
 */
export function ContactInquiryCard({
  listingId,
  contact,
}: {
  listingId: string;
  contact: Contact;
}) {
  const navigate = useNavigate();
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;

  // Shared with the new-style card so one contact × listing reads the same in
  // either treatment.
  const { kind, caSigned, channel, message } = inquiryFacts(contact, listingId);

  const openLeadsRow = () =>
    void navigate({
      to: "/listings/$listingId/leads",
      params: { listingId },
      search: { q: contactFullName(contact) },
    });

  return (
    <div
      className="contact-deal-card bg-card border d-flex flex-column gap-3 p-3"
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        openLeadsRow();
      }}
    >
      {/* Listing identity — the name is a real link to the deal page, excluded
          from the row click via the shared guard (it's an <a>). */}
      <div className="d-flex align-items-center gap-3">
        <img
          src={getPhotoUrl(listing.id)}
          alt=""
          className="flex-shrink-0"
          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }}
        />
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div
            className="fw-semibold text-truncate"
            style={{ fontSize: 17, lineHeight: "26px" }}
            title={listing.name}
          >
            <Link
              to="/listings/$listingId"
              params={{ listingId }}
              className="text-reset text-decoration-none"
            >
              {listing.name}
            </Link>
          </div>
          <div
            className="text-muted text-truncate"
            style={{ fontSize: 14, lineHeight: "19px" }}
          >
            {channel} · Inquired {medDate(contact.createdAt)}
          </div>
        </div>
      </div>

      {/* Inquiry type + CA status. The CA badge only accompanies document
          requests — that's the path that requires a signature. */}
      <div className="d-flex flex-wrap align-items-center gap-2">
        <Badge
          variant="secondary"
          appearance="muted"
          className="d-inline-flex align-items-center gap-1 fw-semibold"
          style={{
            height: 20,
            padding: "0 4px",
            fontSize: 14,
            backgroundColor: "#eceef2",
          }}
        >
          <FontAwesomeIcon icon={kind === "docs" ? faFileContract : faEnvelope} />
          {kind === "docs" ? "Document Request" : "Contact Form"}
        </Badge>
        {kind === "docs" && (
          <Badge
            variant="secondary"
            className="d-inline-flex align-items-center fw-semibold border-0"
            style={{
              height: 20,
              padding: "0 4px",
              fontSize: 14,
              // Mountain-meadow / harvest-gold tints, per STAGE_CHIP_COLORS.
              backgroundColor: caSigned ? "#cdfee5" : "#fff3c5",
              color: caSigned ? "#003024" : "#481800",
            }}
          >
            {caSigned ? "CA Signed" : "CA Pending"}
          </Badge>
        )}
      </div>

      {/* Their own words, when the inquiry carried a message — often the only
          qualifying info on a cold contact. */}
      {message && (
        <div
          className="text-muted fst-italic text-truncate"
          style={{ fontSize: 14 }}
          title={message}
        >
          “{message}”
        </div>
      )}

      {/* Same destination as the row click, spelled out for discoverability. */}
      <div className="border-top d-flex flex-column">
        <ContactLinkButton
          icon={faUserGroup}
          label="View in Deal Leads"
          onClick={openLeadsRow}
        />
      </div>
    </div>
  );
}
