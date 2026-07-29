import { Link, useNavigate } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faFileContract } from "@fortawesome/pro-regular-svg-icons";
import type { Contact } from "#/data/types";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  getPhotoUrl,
} from "#/components/properties/propertyDisplay";
import { contactFullName } from "#/components/contacts/contactDisplay";
import { inquiryFacts } from "#/components/contacts/inquiryFacts";
import { CardBadge } from "#/components/deals/DealCardBadges";
import { propertyAddress } from "#/components/deals/newCardTokens";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

function medDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A listing inquiry in the redesigned card language — the deal-tile shell, so it
 * stacks with the deal and property cards, but deliberately none of the deal
 * signals (stage chip, side, transaction value, gross) that would read as an
 * active business agreement. An inquiry is a cold contact raising a hand.
 *
 * The badge row carries the inquiry's own facts only — what they did, and
 * whether the CA is signed. No relationship badge, because every card in this
 * section is an inquiry by definition.
 *
 * One click path: the whole card goes to the listing's Leads tab pre-searched to
 * this contact, since seeing their inquiry in context is the only reason to click
 * from here. The listing name is the one exception, linking to the deal page.
 */
export function NewContactInquiryCard({
  listingId,
  contact,
}: {
  listingId: string;
  contact: Contact;
}) {
  const navigate = useNavigate();
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;

  const property = getProperty(listing.propertyId);
  const { kind, label, tooltip, caSigned, channel, date, message } = inquiryFacts(
    contact,
    listingId,
  );
  const inquiredOn = medDate(date);

  const openLeadsRow = () =>
    void navigate({
      to: "/listings/$listingId/leads",
      params: { listingId },
      search: { q: contactFullName(contact) },
    });

  return (
    <div
      className="deal-tile"
      onClick={(e) => {
        if (shouldIgnoreRowClick(e)) return;
        openLeadsRow();
      }}
    >
      <div className="deal-tile__main">
        <div className="deal-tile__top">
          <img
            src={getPhotoUrl(listing.id)}
            alt=""
            className="deal-tile__photo"
          />
          <div className="deal-tile__headings">
            <div className="deal-tile__title-row">
              {property && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <span className="deal-tile__type-icon">
                        <FontAwesomeIcon
                          icon={TYPE_ICONS[property.propertyType]}
                        />
                      </span>
                    }
                  />
                  <Tooltip.Content>
                    {TYPE_LABELS[property.propertyType]}
                  </Tooltip.Content>
                </Tooltip>
              )}
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Link
                      to="/listings/$listingId"
                      params={{ listingId }}
                      className="deal-tile__title text-reset text-decoration-none"
                    >
                      {listing.name}
                    </Link>
                  }
                />
                <Tooltip.Content>
                  {propertyAddress(property) ?? listing.name}
                </Tooltip.Content>
              </Tooltip>
            </div>
            {/* Two unlabeled facts with tooltips, same as the deal card's meta —
                the word "Inquired" lives on the badge below, not here twice. */}
            <div className="deal-tile__meta">
              <Tooltip>
                <Tooltip.Trigger render={<span>{channel}</span>} />
                <Tooltip.Content>Where the inquiry came from</Tooltip.Content>
              </Tooltip>
              <span className="deal-tile__meta-sep">•</span>
              <Tooltip>
                <Tooltip.Trigger render={<span>{inquiredOn}</span>} />
                <Tooltip.Content>Date inquired</Tooltip.Content>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* No relationship badge here: every card in this section is an inquiry,
            and the type badge plus the date already say so. */}
        <div className="deal-tile__badges-main">
          <CardBadge
            icon={kind === "docs" ? faFileContract : faEnvelope}
            label={label}
            bg="#eceef2"
            color="#22262f"
            tooltip={tooltip}
          />
          {/* Only a document request needs a signature, so the CA badge rides
              with that path alone. */}
          {kind === "docs" && (
            <CardBadge
              label={caSigned ? "CA Signed" : "CA Pending"}
              bg={caSigned ? "#cdfee5" : "#fff3c5"}
              color={caSigned ? "#003024" : "#481800"}
              tooltip={
                caSigned
                  ? "Confidentiality agreement signed"
                  : "Waiting on a signed confidentiality agreement"
              }
            />
          )}
        </div>

        {/* Their own words — often the only qualifying detail on a cold contact. */}
        {message && (
          <p className="deal-tile__quote" title={message}>
            “{message}”
          </p>
        )}
      </div>
    </div>
  );
}
