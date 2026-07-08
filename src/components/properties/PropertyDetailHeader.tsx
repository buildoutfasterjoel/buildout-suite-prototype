import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPencil,
  faUserGear,
  faEllipsisVertical,
  faHandshake,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing, ListingStage } from "#/data/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PROPERTY_STATUSES,
  hash,
  getRefId,
  getPhotoUrl,
} from "./propertyDisplay";
import { AvatarGroup } from "./AvatarGroup";

/**
 * Full-bleed page header for a listing (which is its deal, 1:1) — identity on the
 * left, the unified lifecycle stage selector on the right. Stage is local-only.
 */
export function PropertyDetailHeader({ listing }: { listing: Listing }) {
  const seed = hash(listing.id);
  const refId = getRefId(listing.id);
  const address = `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip}`;
  const [stage, setStage] = useState<ListingStage>(listing.status);

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <div className="d-flex align-items-center gap-3">
          {/* Thumbnail */}
          <img
            src={getPhotoUrl(listing.id, 328, 200)}
            alt={listing.name}
            className="flex-shrink-0 d-none d-sm-block align-self-stretch"
            style={{
              width: 164,
              height: "auto",
              objectFit: "cover",
              borderRadius: 4,
            }}
          />

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
                  <Breadcrumb.Page>{listing.name}</Breadcrumb.Page>
                </Breadcrumb.Item>
              </Breadcrumb.List>
            </Breadcrumb>
            <h1
              className="fs-4 fw-semibold mb-0 text-truncate"
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
            </div>
          </div>

          {/* Actions + stage */}
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            <Select
              value={stage}
              onValueChange={(v) => v && setStage(v as ListingStage)}
            >
              <Select.Trigger style={{ minWidth: 168 }}>
                <span className="d-inline-flex align-items-center gap-2">
                  <span
                    className="rounded-circle"
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: STATUS_COLORS[stage],
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
            <AvatarGroup seed={seed} size="default" />
            <Button variant="ghost" size="icon" aria-label="Manage access">
              <FontAwesomeIcon icon={faUserGear} />
            </Button>
            <Button variant="primary" className="flex-shrink-0">
              <FontAwesomeIcon icon={faPencil} />
              Edit Deal
            </Button>
            <Button variant="ghost" size="icon" aria-label="More options">
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
