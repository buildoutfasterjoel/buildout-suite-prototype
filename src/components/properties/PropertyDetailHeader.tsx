import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faUserGear,
  faEllipsisVertical,
  faHandshake,
  faArrowsRotate,
  faSquareDashedCirclePlus,
  faTrashAlt,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing, ListingStage } from "#/data/types";
import { getProperty, getListing } from "#/data/store";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PROPERTY_STATUSES,
  hash,
  getRefId,
  getPhotoUrl,
} from "./propertyDisplay";
import { AvatarGroup } from "./AvatarGroup";
import { SyndicationStatus } from "#/components/listings/SyndicationStatus";
import { requestStageChange } from "#/components/deals/useStageGate";
import { AddSpaceModal } from "#/components/deals/AddSpaceModal";
import { resyncChildFromParent } from "#/data/leaseSpaces";
import { notify } from "#/lib/notify";

/**
 * Full-bleed page header for a listing (which is its deal, 1:1) — identity on the
 * left, the unified lifecycle stage selector on the right. Selecting a new stage
 * opens the stage gate; the Select is bound to the live status so a cancelled
 * gate auto-reverts.
 */
export function PropertyDetailHeader({ listing }: { listing: Listing }) {
  const seed = hash(listing.id);
  const refId = getRefId(listing.id);
  const property = getProperty(listing.propertyId);
  const address = `${property?.street}, ${property?.city}, ${property?.state} ${property?.zip}`;
  const [addSpaceOpen, setAddSpaceOpen] = useState(false);
  const parentDeal = listing.parentDealId
    ? getListing(listing.parentDealId)
    : undefined;
  // For a child space deal, the last breadcrumb crumb is the unit/suite label.
  const spaceLabel =
    property?.units.find((u) => u.id === listing.unitId)?.label ?? listing.name;

  const resync = () => {
    resyncChildFromParent(listing.id);
    notify({ title: "Re-synced from parent", description: listing.name });
  };

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <div className="d-flex align-items-center gap-3">
          {/* Thumbnail with the access avatars overlaid in the corner */}
          <div
            className="flex-shrink-0 d-none d-sm-block align-self-stretch position-relative"
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
            <div
              className="position-absolute"
              style={{ right: 6, bottom: 6 }}
            >
              <AvatarGroup seed={seed} size="default" />
            </div>
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
                {parentDeal ? (
                  <>
                    <Breadcrumb.Item>
                      <Breadcrumb.Link
                        render={
                          <Link
                            to="/listings/$listingId"
                            params={{ listingId: parentDeal.id }}
                          />
                        }
                      >
                        {parentDeal.name}
                      </Breadcrumb.Link>
                    </Breadcrumb.Item>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      <Breadcrumb.Page>{spaceLabel}</Breadcrumb.Page>
                    </Breadcrumb.Item>
                  </>
                ) : (
                  <Breadcrumb.Item>
                    <Breadcrumb.Page>{listing.name}</Breadcrumb.Page>
                  </Breadcrumb.Item>
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
              {parentDeal && (
                <Button variant="ghost" size="sm" onClick={resync}>
                  <FontAwesomeIcon icon={faArrowsRotate} /> Re-sync from parent
                </Button>
              )}
            </div>
          </div>

          {/* Stage + access block · actions · options on its own */}
          <div className="d-flex align-items-center gap-3 flex-shrink-0">
            <div className="d-flex align-items-center gap-2">
              <Select
                value={listing.status}
                onValueChange={(v) => {
                  if (v && v !== listing.status) {
                    requestStageChange(listing.id, v as ListingStage);
                  }
                }}
              >
                <Select.Trigger style={{ minWidth: 168 }}>
                  <span className="d-inline-flex align-items-center gap-2">
                    <span
                      className="rounded-circle"
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: STATUS_COLORS[listing.status],
                      }}
                    />
                    <Select.Value>
                      {(v) => STATUS_LABELS[v as ListingStage]}
                    </Select.Value>
                  </span>
                </Select.Trigger>
                <Select.Content>
                  {PROPERTY_STATUSES.map((s) => (
                    <Select.Item key={s} value={s}>
                      <span className="d-inline-flex align-items-center gap-2">
                        <span
                          className="rounded-circle"
                          style={{
                            width: 8,
                            height: 8,
                            backgroundColor: STATUS_COLORS[s],
                          }}
                        />
                        {STATUS_LABELS[s]}
                      </span>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
            <div className="d-flex align-items-center gap-2">
              {listing.dealType === "Lease" && listing.parentDealId == null && (
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
                      nativeButton={false}
                      render={
                        <Link
                          to="/listings/$listingId/edit"
                          params={{ listingId: listing.id }}
                        />
                      }
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                  }
                />
                <Tooltip.Content>Edit Deal</Tooltip.Content>
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
                  <FontAwesomeIcon icon={faUserGear} />
                  Manage Access
                </DropdownMenu.Item>
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
