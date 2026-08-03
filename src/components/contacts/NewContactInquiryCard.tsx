import { useNavigate } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile,
  faMessageQuestion,
  faPenLine,
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
 * The inquiry's own facts — what they did, and whether the CA is signed — ride
 * inline with the meta text as icon-only badges rather than a labelled row of
 * their own: at this size the words repeated what the tooltip already says, and
 * the card is narrow enough that they wrapped. No relationship badge, because
 * every card in this section is an inquiry by definition.
 *
 * One click path, no exceptions: anywhere on the card goes to the listing's Leads
 * tab pre-searched to this contact. Seeing the inquiry in context is the only
 * reason to click from here — the title used to link to the deal's planner, which
 * is a page an inquiry gives you no business being on.
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
  const { kind, tooltip, caSigned, channel, date, message } = inquiryFacts(
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
                    <span className="deal-tile__title">{listing.name}</span>
                  }
                />
                <Tooltip.Content>
                  {propertyAddress(property) ?? listing.name}
                </Tooltip.Content>
              </Tooltip>
            </div>
            {/* Badges then two unlabeled facts, all tooltipped — the words
                "Inquired" and "LoopNet" would otherwise repeat what the glyph
                and the channel already say. */}
            <div className="deal-tile__meta deal-tile__meta--badges">
              <span className="deal-tile__meta-badges">
                <CardBadge
                  icon={kind === "docs" ? faFile : faMessageQuestion}
                  bg="#eceef2"
                  color="#22262f"
                  tooltip={tooltip}
                />
                {/* Only a document request carries a CA, and only a signed one is
                    worth a badge — "pending" is the normal state of a fresh
                    inquiry, so flagging it just adds noise to every new card. */}
                {kind === "docs" && caSigned && (
                  <CardBadge
                    icon={faPenLine}
                    bg="#dcebfd"
                    color="#182753"
                    tooltip="Confidentiality agreement signed"
                  />
                )}
              </span>
              <span className="deal-tile__divider" />
              <span className="deal-tile__meta-facts">
                <Tooltip>
                  <Tooltip.Trigger render={<span>{channel}</span>} />
                  <Tooltip.Content>Where the inquiry came from</Tooltip.Content>
                </Tooltip>
                <span className="deal-tile__meta-sep">•</span>
                <Tooltip>
                  <Tooltip.Trigger render={<span>{inquiredOn}</span>} />
                  <Tooltip.Content>Date inquired</Tooltip.Content>
                </Tooltip>
              </span>
            </div>
          </div>
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
