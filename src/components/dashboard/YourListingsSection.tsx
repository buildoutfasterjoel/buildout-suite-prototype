import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Progress } from "@buildoutinc/blueprint-react/ui/Progress";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faEnvelope } from "@fortawesome/pro-regular-svg-icons";
import { getProperty, getStore } from "#/data/store";
import type { Listing } from "#/data/types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  getPhotoUrl,
  hash,
} from "#/components/properties/propertyDisplay";
import { getListingTraffic } from "#/data/listingTraffic";

function StatColumn({ label, value }: { label: string; value: number }) {
  return (
    <div className="d-flex flex-column align-items-center" style={{ minWidth: 44 }}>
      <span className="fw-semibold">{value}</span>
      <span className="text-muted fs-xs text-uppercase">{label}</span>
    </div>
  );
}

function ListingRow({ listing, isLast }: { listing: Listing; isLast: boolean }) {
  const traffic = getListingTraffic(listing.id);
  const property = getProperty(listing.propertyId);
  // Presentational-only unread-message bubble — real `listing.messages` arrays
  // are too short (0–2) to match the reference design's counts.
  const messageCount = 1 + (hash(listing.id) % 9);

  const doneTasks = listing.tasks.filter((t) => t.status === "complete").length;
  const totalTasks = listing.tasks.length;
  const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div
      className={`d-flex align-items-center gap-3 py-3 ${isLast ? "" : "border-bottom"}`}
    >
      <img
        src={getPhotoUrl(listing.id, 64, 64)}
        alt=""
        className="rounded flex-shrink-0"
        style={{ width: 64, height: 64, objectFit: "cover" }}
      />

      <div className="d-flex flex-column gap-1" style={{ minWidth: 220 }}>
        <span className="fw-semibold">{listing.name}</span>
        <Badge
          variant="outline"
          className="fs-xs align-self-start"
          style={{
            color: STATUS_COLORS[listing.status],
            borderColor: STATUS_COLORS[listing.status],
          }}
        >
          {STATUS_LABELS[listing.status].toUpperCase()}
        </Badge>
        <span className="text-muted fs-xs">
          {property?.street}, {property?.city}, {property?.state}
        </span>
      </div>

      {listing.status === "under-contract" ? (
        <div className="d-flex flex-column gap-1 flex-fill" style={{ maxWidth: 280 }}>
          <div className="d-flex justify-content-between">
            <span className="text-muted fs-xs">
              {doneTasks} of {totalTasks} to close
            </span>
            <span className="fw-semibold fs-xs">{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      ) : (
        <div className="d-flex gap-4 ms-md-auto">
          <StatColumn label="Sent" value={traffic.sent} />
          <StatColumn label="Replies" value={traffic.replies} />
          <StatColumn label="Views" value={traffic.pageViews} />
          <StatColumn label="CAS" value={traffic.cas} />
          <StatColumn label="Leads" value={traffic.leads} />
        </div>
      )}

      <div className="ms-auto flex-shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Listing messages"
          className="position-relative"
        >
          <FontAwesomeIcon icon={faEnvelope} />
          <Badge
            variant="primary"
            className="position-absolute fs-xs"
            style={{ top: -4, right: -4, minWidth: 16, textAlign: "center" }}
          >
            {messageCount}
          </Badge>
        </Button>
      </div>
    </div>
  );
}

export function YourListingsSection() {
  const listings = useMemo(() => {
    const all = [...getStore().listings.values()];
    const byStatus = (status: Listing["status"]) =>
      all.find((l) => l.status === status);
    return [byStatus("active"), byStatus("proposal"), byStatus("under-contract")].filter(
      (l): l is Listing => Boolean(l),
    );
  }, []);

  return (
    <Card className="panel-card">
      <Card.Header className="d-flex align-items-center gap-2">
        <Card.Title className="fs-large">Your listings</Card.Title>
        <Badge variant="secondary" appearance="muted" className="fs-xs">
          {listings.length}
        </Badge>
        <Button
          variant="ghost"
          className="ms-auto"
          nativeButton={false}
          render={
            <Link to="/listings">
              See all listings
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          }
        />
      </Card.Header>

      <CardBody className="d-flex flex-column">
        {listings.map((listing, i) => (
          <ListingRow
            key={listing.id}
            listing={listing}
            isLast={i === listings.length - 1}
          />
        ))}
      </CardBody>
    </Card>
  );
}
