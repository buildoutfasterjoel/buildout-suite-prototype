import { Link, useNavigate } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faFileContract,
  faUserGroup,
} from "@fortawesome/pro-regular-svg-icons";
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
import { CardBadge, BadgeDivider } from "#/components/deals/DealCardBadges";
import {
  relationshipBadge,
  relationshipTooltip,
} from "#/components/deals/newCardTokens";
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
 * Badge row mirrors the deal card's shape: the inquiry's own facts lead, then the
 * divider carries the relationship badge — which here is always the filled
 * "Inquired" pill, the one badge in the set that means "not yours yet".
 *
 * A plain click goes to the listing's Leads tab pre-searched to this contact,
 * because that row is where the broker acts on an inquiry (grants access,
 * updates CA/lead status); the listing name links to the deal page instead.
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
  const { kind, caSigned, channel, message } = inquiryFacts(contact, listingId);
  const inquired = relationshipBadge("inquired");
  const inquiredOn = medDate(contact.createdAt);

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
              <Link
                to="/listings/$listingId"
                params={{ listingId }}
                className="deal-tile__title text-reset text-decoration-none"
                title={listing.name}
              >
                {listing.name}
              </Link>
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

        <div className="deal-tile__badges-main">
          <CardBadge
            icon={kind === "docs" ? faFileContract : faEnvelope}
            label={kind === "docs" ? "Document Request" : "Contact Form"}
            bg="#eceef2"
            color="#22262f"
            tooltip={
              kind === "docs"
                ? "Requested access to secure documents"
                : "Completed the listing's contact form"
            }
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
          <span className="deal-tile__rel-group">
            <BadgeDivider />
            <CardBadge
              icon={inquired.icon}
              label={inquired.label}
              bg={inquired.bg}
              color={inquired.color}
              tooltip={relationshipTooltip(
                "inquired",
                contactFullName(contact),
                inquiredOn,
              )}
            />
          </span>
        </div>

        {/* Their own words — often the only qualifying detail on a cold contact. */}
        {message && (
          <p className="deal-tile__quote" title={message}>
            “{message}”
          </p>
        )}
      </div>

      <button
        type="button"
        className="deal-tile__cta"
        onClick={(e) => {
          e.stopPropagation();
          openLeadsRow();
        }}
      >
        <FontAwesomeIcon icon={faUserGroup} />
        View in Deal Leads
      </button>
    </div>
  );
}
