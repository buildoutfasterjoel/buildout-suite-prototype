import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCloudArrowUp,
  faBolt,
  faPlus,
  faFolderPlus,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { STATUS_LABELS } from "../properties/propertyDisplay";
import { formatCurrency, formatDate } from "./dealDisplay";

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="d-flex align-items-center justify-content-between mb-3">
      <h2 className="fs-4 mb-0">{title}</h2>
      {action}
    </div>
  );
}

export function DealAttachments() {
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <SectionHeader title="Attachments" />
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

export function DealActivities() {
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <SectionHeader
        title="Activities"
        action={
          <Button variant="primary">
            <FontAwesomeIcon icon={faPlus} />
            Add activity
          </Button>
        }
      />
      <div className="bg-card border rounded" style={{ borderRadius: 6 }}>
        <Empty className="py-6">
          <Empty.Media>
            <FontAwesomeIcon icon={faBolt} aria-hidden />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No Activities to Display</Empty.Title>
            Get started by adding an activity.
          </Empty.Content>
        </Empty>
      </div>
    </div>
  );
}

export function DealHistory({ listing }: { listing: Listing }) {
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <SectionHeader title="History" />
      <div className="bg-card border rounded" style={{ borderRadius: 6 }}>
        {listing.history.map((h) => (
          <div
            key={h.id}
            className="d-flex align-items-center gap-2 px-4 py-3 border-bottom"
          >
            <span className="flex-grow-1 d-flex align-items-center gap-2 flex-wrap">
              {h.label}
              {h.fromStage && (
                <Badge variant="secondary" appearance="muted">
                  {STATUS_LABELS[h.fromStage]}
                </Badge>
              )}
              {h.fromStage && h.toStage && <span className="text-muted">→</span>}
              {h.toStage && (
                <Badge variant="secondary" appearance="muted">
                  {STATUS_LABELS[h.toStage]}
                </Badge>
              )}
            </span>
            <span className="text-muted text-nowrap" style={{ fontSize: 13 }}>
              {formatDate(h.timestamp)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DealVoucher({ listing }: { listing: Listing }) {
  const v = listing.voucher;
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <SectionHeader title="Voucher" />
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
