import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClockRotateLeft,
  faFileInvoiceDollar,
  faFileLines,
  faFilePdf,
  faEllipsisVertical,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { getStore } from "#/data/store";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { formatDate } from "#/components/deals/dealDisplay";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/financial-documents",
)({
  component: InvoicesRoute,
});

interface InvoiceRow {
  id: string;
  name: string;
  invoiceNumber: string;
  activity: string;
  activityDate: string;
  completedBy: string;
}

/** "07/23/2026 at 9:40am PDT" — MM/DD/YYYY plus a lowercase time (local parts, like `formatDate`). */
function formatInvoiceActivity(iso: string): string {
  const d = new Date(iso);
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "pm" : "am";
  const hour = d.getHours() % 12 || 12;
  return `${formatDate(iso)} at ${hour}:${minutes}${ampm} PDT`;
}

/** A single draft invoice derived from the deal — its filename keys off the primary party. */
function draftInvoice(listing: Listing): InvoiceRow {
  const { contacts } = getStore();
  const contactId =
    listing.sellerContactIds[0] ??
    listing.buyerContactIds[0] ??
    listing.tenantContactIds[0];
  const contact = contactId ? contacts.get(contactId) : undefined;
  const base = contact ? `${contact.firstName} ${contact.lastName}` : listing.name;
  const fileName = `${base.replace(/[^A-Za-z0-9]+/g, "_")}_Invoice_Draft.pdf`;
  return {
    id: "draft",
    name: fileName,
    invoiceNumber: "Draft",
    activity: "Created",
    activityDate: listing.updatedAt,
    completedBy: "",
  };
}

function InvoicesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;

  const invoices: InvoiceRow[] = [draftInvoice(listing)];

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title="Invoices"
        actions={
          <Button variant="ghost" size="sm">
            <FontAwesomeIcon icon={faClockRotateLeft} />
            Invoice History
          </Button>
        }
      />

      {invoices.length === 0 ? (
        <Empty className="py-8">
          <Empty.Media>
            <FontAwesomeIcon icon={faFileInvoiceDollar} aria-label="No invoices" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No invoices yet</Empty.Title>
            Invoices for this deal will show up here.
          </Empty.Content>
        </Empty>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head style={{ width: 44 }}>
                <FontAwesomeIcon icon={faFileLines} className="text-muted" />
              </Table.Head>
              <Table.Head>Attachment Name</Table.Head>
              <Table.Head>Invoice Number</Table.Head>
              <Table.Head>Last Activity</Table.Head>
              <Table.Head>Activity Date</Table.Head>
              <Table.Head>Completed By</Table.Head>
              <Table.Head />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {invoices.map((inv) => (
              <Table.Row key={inv.id}>
                <Table.Cell>
                  <FontAwesomeIcon icon={faFilePdf} className="text-danger" />
                </Table.Cell>
                <Table.Cell className="fw-medium">{inv.name}</Table.Cell>
                <Table.Cell>{inv.invoiceNumber}</Table.Cell>
                <Table.Cell>
                  <span className="d-inline-flex align-items-center gap-2">
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-circle text-white flex-shrink-0"
                      style={{ width: 22, height: 22, backgroundColor: "#8833ea", fontSize: 11 }}
                      aria-hidden="true"
                    >
                      <FontAwesomeIcon icon={faFileInvoiceDollar} />
                    </span>
                    {inv.activity}
                  </span>
                </Table.Cell>
                <Table.Cell>{formatInvoiceActivity(inv.activityDate)}</Table.Cell>
                <Table.Cell>{inv.completedBy}</Table.Cell>
                <Table.Cell className="text-end">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Invoice actions">
                          <FontAwesomeIcon icon={faEllipsisVertical} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content>
                      <DropdownMenu.Item>View invoice</DropdownMenu.Item>
                      <DropdownMenu.Item>Download</DropdownMenu.Item>
                      <DropdownMenu.Item>Delete</DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </div>
  );
}
