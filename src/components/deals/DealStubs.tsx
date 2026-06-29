import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudArrowUp,
  faBolt,
  faPlus,
  faFolderPlus,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { STATUS_LABELS } from "../properties/propertyDisplay";
import { ListingPageHeader } from "../listings/ListingPageHeader";
import { formatCurrency, formatDate, formatDateTime, initials } from "./dealDisplay";

export function DealAttachments() {
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader title="Attachments" />
      <div className="bg-card border rounded" style={{ borderRadius: 6 }}>
        <Empty className="py-6">
          <Empty.Media>
            <FontAwesomeIcon icon={faCloudArrowUp} aria-hidden />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>Upload Files</Empty.Title>
            Click or drag files or folders here to upload them.
          </Empty.Content>
        </Empty>
      </div>
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="fs-6 fw-semibold mb-0">All Files</h3>
        <Button variant="ghost" size="sm">
          <FontAwesomeIcon icon={faFolderPlus} />
          Add folder
        </Button>
      </div>
      <p className="text-muted">No attachments have been uploaded.</p>
    </div>
  );
}

type FeedItem = {
  id: string;
  actor: string;
  timestamp: string;
  /** What happened — the action phrase, shown after the actor's name. */
  action: React.ReactNode;
};

/** Fold the deal's logged activities and its stage history into one feed. */
function buildFeed(listing: Listing): FeedItem[] {
  const activities: FeedItem[] = listing.activities.map((a) => ({
    id: a.id,
    actor: a.actor,
    timestamp: a.timestamp,
    action: a.note,
  }));
  const history: FeedItem[] = listing.history.map((h) => ({
    id: h.id,
    actor: h.actor,
    timestamp: h.timestamp,
    action:
      h.fromStage && h.toStage ? (
        <>
          moved the deal from{" "}
          <Badge variant="secondary" appearance="muted">
            {STATUS_LABELS[h.fromStage]}
          </Badge>{" "}
          to{" "}
          <Badge variant="secondary" appearance="muted">
            {STATUS_LABELS[h.toStage]}
          </Badge>
        </>
      ) : (
        <>
          created the deal in{" "}
          <Badge variant="secondary" appearance="muted">
            {STATUS_LABELS[h.toStage ?? "proposal"]}
          </Badge>
        </>
      ),
  }));
  return [...activities, ...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

/** Unified activity feed — logged activities and stage history in one timeline. */
export function DealActivity({ listing }: { listing: Listing }) {
  const feed = buildFeed(listing);

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title="Activity"
        actions={
          <Button variant="primary">
            <FontAwesomeIcon icon={faPlus} />
            Add activity
          </Button>
        }
      />
      {feed.length === 0 ? (
        <Empty className="py-6">
          <Empty.Media>
            <FontAwesomeIcon icon={faBolt} aria-hidden />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No Activities to Display</Empty.Title>
            Get started by adding an activity.
          </Empty.Content>
        </Empty>
      ) : (
        <div className="bg-card border rounded" style={{ borderRadius: 6 }}>
          {feed.map((item) => (
            <div
              key={item.id}
              className="d-flex align-items-start gap-3 px-4 py-3 border-bottom"
            >
              <Avatar size="sm" className="flex-shrink-0 mt-1">
                <Avatar.Fallback>{initials(item.actor)}</Avatar.Fallback>
              </Avatar>
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span className="fw-semibold">{item.actor}</span>
                  <span>{item.action}</span>
                </div>
                <div className="text-muted fs-small">
                  {formatDateTime(item.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DealVoucher({ listing }: { listing: Listing }) {
  const v = listing.voucher;
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader title="Voucher" />
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Voucher Name</Table.Head>
            <Table.Head>Close Date</Table.Head>
            <Table.Head>Identifier</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head>Related Contacts</Table.Head>
            <Table.Head className="text-end">Transaction Value</Table.Head>
            <Table.Head className="text-end">Gross Commission</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>
              <span className="text-primary fw-semibold">{v.name}</span>
            </Table.Cell>
            <Table.Cell>{formatDate(v.closeDate)}</Table.Cell>
            <Table.Cell>{v.identifier}</Table.Cell>
            <Table.Cell>
              <Badge
                variant={v.status === "Approved" ? "primary" : "secondary"}
                appearance={v.status === "Approved" ? "accent" : "muted"}
              >
                {v.status}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              <span className="text-primary">{v.relatedContactsLabel}</span>
            </Table.Cell>
            <Table.Cell className="text-end">
              {formatCurrency(v.transactionValue)}
            </Table.Cell>
            <Table.Cell className="text-end">
              {formatCurrency(v.grossCommission)}
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    </div>
  );
}
