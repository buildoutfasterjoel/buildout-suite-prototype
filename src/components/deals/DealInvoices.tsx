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
  faPenToSquare,
  faPrint,
  faTrashCan,
} from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { invoiceQuickbooksSynced } from "#/data/quickbooks";
import { QuickbooksSyncBadge } from "#/components/common/QuickbooksSyncBadge";
import { findTeammate } from "#/data/teammates";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { formatDate } from "#/components/deals/dealDisplay";

/**
 * The deal's invoices — one row per PDF that has been generated against its
 * voucher.
 *
 * The rows are the deal's own records now; this used to derive a single fake
 * "Draft" row from the deal's primary party. Three columns, because that is what
 * a broker scanning a list of files needs: which file, when it was made, and by
 * whom. The amounts live on the invoice and belong on the invoice, not spread
 * across a directory of them.
 *
 * The row menu is deliberately inert at this stage. Edit needs the invoice view
 * that has not been built, and Print needs a print layout; wiring Delete alone
 * would leave one live item in a menu of three, which reads as the other two
 * being broken rather than unbuilt.
 */
export function DealInvoices({
  listing,
  heading = "Invoices",
}: {
  listing: Listing;
  /** Overridden on a shell's per-space voucher, so the suite is named. */
  heading?: string;
}) {
  const invoices = listing.invoices ?? [];
  // The voucher's own receivables — what an invoice's QuickBooks state is read
  // from. Resolved once here rather than per row.
  const receivables = listing.transaction.backOffice.receivables;

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title={heading}
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
            Generate one from a receivable on this deal&rsquo;s voucher.
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
              <Table.Head>Created</Table.Head>
              <Table.Head>Created By</Table.Head>
              {/* Unheaded, like the same gutter on the Receivables table: the
                  badge is a row status and its tooltip names it. */}
              <Table.Head
                style={{ width: 40 }}
                aria-label="QuickBooks sync status"
              />
              <Table.Head />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {invoices.map((invoice) => (
              <Table.Row key={invoice.id}>
                <Table.Cell>
                  <FontAwesomeIcon icon={faFilePdf} className="text-danger" />
                </Table.Cell>
                <Table.Cell className="fw-medium">{invoice.name}</Table.Cell>
                <Table.Cell>{formatDate(invoice.createdAt)}</Table.Cell>
                {/* Resolved through the roster rather than stored as a name, so
                    correcting a teammate corrects every invoice they made. Falls
                    back to an em-dash for an id no longer on the roster — the
                    invoice is still a record of a bill that went out. */}
                <Table.Cell>{findTeammate(invoice.createdById)?.name ?? "—"}</Table.Cell>
                {/* Derived from the lines, never stored — an invoice cannot be
                    in QuickBooks unless the receivables it bills are. */}
                <Table.Cell>
                  <QuickbooksSyncBadge
                    synced={invoiceQuickbooksSynced(
                      invoice.lineItems,
                      receivables,
                    )}
                    size={18}
                  />
                </Table.Cell>
                <Table.Cell className="text-end">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${invoice.name}`}
                        >
                          <FontAwesomeIcon icon={faEllipsisVertical} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Item>
                        <FontAwesomeIcon icon={faPenToSquare} className="me-2" />
                        Edit
                      </DropdownMenu.Item>
                      <DropdownMenu.Item>
                        <FontAwesomeIcon icon={faPrint} className="me-2" />
                        Print
                      </DropdownMenu.Item>
                      <DropdownMenu.Item>
                        <FontAwesomeIcon icon={faTrashCan} className="me-2" />
                        Delete
                      </DropdownMenu.Item>
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
