import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faEllipsisVertical,
  faHandshake,
  faSquareDashedCirclePlus,
  faTrashAlt,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getProperty, getListing } from "#/data/store";
import { canAddSpaces } from "#/data/dealShape";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
import { CLASSIC_BADGE } from "#/components/deals/DealCardBadges";
import { getRefId, getPhotoUrl } from "./propertyDisplay";
import { SyndicationStatus } from "#/components/listings/SyndicationStatus";
import { DealStageSelect } from "#/components/deals/DealStageSelect";
import { DealHeroAccessAvatars } from "#/components/deals/DealHeroAccessAvatars";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";

/**
 * Full-bleed page header for a listing (which is its deal, 1:1) — identity on the
 * left, the unified lifecycle stage selector on the right. Selecting a new stage
 * opens the stage gate; the Select is bound to the live status so a cancelled
 * gate auto-reverts.
 */
export function PropertyDetailHeader({ listing }: { listing: Listing }) {
  const refId = getRefId(listing.id);
  const property = getProperty(listing.propertyId);
  const address = `${property?.street}, ${property?.city}, ${property?.state} ${property?.zip}`;
  const { pathname } = useLocation();
  const { sectionLabel, detailId } = dealBreadcrumbTrail(
    pathname,
    listing.id,
    listing.isClassic,
  );
  // The detail id is a space deal's id; its human name is the suite's label,
  // which lives on this same property's units. Resolved here because
  // dealBreadcrumbTrail is deliberately store-free.
  const detailLabel = detailId
    ? (() => {
        const space = getListing(detailId);
        return (
          property?.units.find((u) => u.id === space?.unitId)?.label ??
          space?.name ??
          null
        );
      })()
    : null;
  const [addSpaceOpen, setAddSpaceOpen] = useState(false);

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <div className="d-flex align-items-center gap-3">
          {/* Thumbnail. The access avatars used to sit overlaid in its corner;
              they are real people now, and live with the deal's identity. */}
          <div
            className="flex-shrink-0 d-none d-sm-block align-self-stretch"
            style={{ width: 164 }}
          >
            <img
              src={getPhotoUrl(listing.id, 328, 200)}
              alt={listing.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 4,
                display: "block",
              }}
            />
          </div>

          {/* Identity */}
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <Breadcrumb className="mb-1">
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<Link to="/listings" />}>
                    <FontAwesomeIcon icon={faHandshake} />
                    All Deals
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  {sectionLabel ? (
                    <Breadcrumb.Link
                      render={
                        <Link
                          to="/listings/$listingId"
                          params={{ listingId: listing.id }}
                        />
                      }
                    >
                      {listing.name}
                    </Breadcrumb.Link>
                  ) : (
                    <Breadcrumb.Page>{listing.name}</Breadcrumb.Page>
                  )}
                </Breadcrumb.Item>
                {sectionLabel && (
                  <>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      {/* The section is a link only when a record sits below it —
                          that link is how the detail view gets back to its index,
                          which is why the detail has no back button of its own.
                          Keyed on `detailId`, the structural fact, not on
                          `detailLabel`, which is only whether we found a name: a
                          stale space id renders an empty body (the route's own
                          guard) and must still leave a way back. */}
                      {detailId ? (
                        <Breadcrumb.Link
                          render={
                            <Link
                              to="/listings/$listingId/vouchers"
                              params={{ listingId: listing.id }}
                            />
                          }
                        >
                          {sectionLabel}
                        </Breadcrumb.Link>
                      ) : (
                        <Breadcrumb.Page>{sectionLabel}</Breadcrumb.Page>
                      )}
                    </Breadcrumb.Item>
                  </>
                )}
                {/* Display, so keyed on the label: with an id we cannot name,
                    show no crumb rather than a raw uuid. The section above stays
                    a link either way. */}
                {detailLabel && (
                  <>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      <Breadcrumb.Page>{detailLabel}</Breadcrumb.Page>
                    </Breadcrumb.Item>
                  </>
                )}
              </Breadcrumb.List>
            </Breadcrumb>
            <h1
              className="fs-5 fw-semibold mb-0 text-truncate"
              title={listing.name}
            >
              {listing.name}
            </h1>
            <div className="text-muted text-truncate">{address}</div>
            <div className="d-flex align-items-center gap-2 mt-2">
              {/* First in the row, so "this is the classic deal" is read before
                  the deal's own facts. A Blueprint `Badge` rather than the card
                  pill from `CLASSIC_BADGE`: that one carries card geometry, and
                  here the badge has to sit flush with the two beside it. The
                  glyph and the wording are the shared spec's, so the marker
                  reads as the same thing it does on the deal's card. */}
              {listing.isClassic && (
                <Tooltip>
                  <Tooltip.Trigger
                    render={
                      <Badge variant="secondary" appearance="muted">
                        <FontAwesomeIcon icon={CLASSIC_BADGE.icon} />
                        {CLASSIC_BADGE.label}
                      </Badge>
                    }
                  />
                  <Tooltip.Content>{CLASSIC_BADGE.tooltip}</Tooltip.Content>
                </Tooltip>
              )}
              <Badge variant="secondary" appearance="muted">
                {listing.dealType}
              </Badge>
              <Badge variant="secondary" appearance="muted">
                #{refId}
              </Badge>
              {/* Publishing is a sell-side listing concept — buy-side deals have
                  no listing to syndicate. */}
              {listing.dealSide === "seller" && (
                <SyndicationStatus listing={listing} />
              )}
              {/* Who has this deal, beside what it is — the same cluster the
                  contact hero puts next to a contact's stage. */}
              <DealHeroAccessAvatars listing={listing} />
            </div>
          </div>

          {/* Stage + access block · actions · options on its own */}
          <div className="d-flex align-items-center gap-3 flex-shrink-0">
            <div className="d-flex align-items-center gap-2">
              <DealStageSelect listing={listing} />
            </div>
            <div className="d-flex align-items-center gap-2">
              {canAddSpaces(listing) && (
                <Button
                  variant="secondary"
                  aria-label="Add space"
                  className="flex-shrink-0"
                  onClick={() => setAddSpaceOpen(true)}
                >
                  <FontAwesomeIcon icon={faSquareDashedCirclePlus} />
                  Add Space
                </Button>
              )}
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      // Named on the button, not left to the tooltip: Blueprint's
                      // Tooltip describes a trigger, it does not name it, so an
                      // icon-only pencil reads as an unlabelled button to a
                      // screen reader until hover — which never happens there.
                      aria-label={
                        listing.isClassic ? "Edit listing" : "Edit deal"
                      }
                      nativeButton={false}
                      render={
                        // A classic deal has no Listing section in its sidebar —
                        // the listing form is what this button opens instead of
                        // the deal form. Two `Link`s rather than one with an
                        // interpolated `to`: `Link` takes a typed route literal.
                        listing.isClassic ? (
                          <Link
                            to="/listings/$listingId/listing"
                            params={{ listingId: listing.id }}
                          />
                        ) : (
                          <Link
                            to="/listings/$listingId/edit"
                            params={{ listingId: listing.id }}
                          />
                        )
                      }
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                  }
                />
                <Tooltip.Content>
                  {listing.isClassic ? "Edit Listing" : "Edit Deal"}
                </Tooltip.Content>
              </Tooltip>
            </div>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button variant="ghost" size="icon" aria-label="More options">
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item>
                  <FontAwesomeIcon icon={faTrashAlt} />
                  Delete Deal
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AddSpaceModal
        parentDealId={listing.id}
        open={addSpaceOpen}
        onOpenChange={setAddSpaceOpen}
      />
    </div>
  );
}
