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
import type { InvoiceActivity, Listing } from "#/data/types";
import { findTeammate } from "#/data/teammates";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { formatDateAtTime } from "#/components/deals/dealDisplay";
import { StatusPill } from "#/components/deals/DealStageBadge";

/**
 * Invoice-activity colours, on the same pill every other status in the app is
 * built from — `StatusPill`, tinted fill and a leading dot.
 *
 * Two of the three deliberately borrow the voucher's own words: a bill that has
 * only been created is grey, the colour a Draft voucher takes, and one that has
 * been finalized is the closed green an Approved voucher takes. A broker reading
 * a voucher and then its invoices should not have to learn a second palette one
 * page apart. Voided is the destructive red — the only state here that means a
 * document was withdrawn after it went out.
 */
const ACTIVITY_COLORS: Record<InvoiceActivity, string> = {
  Created: "var(--stage-inactive)",
  Finalized: "var(--stage-closed)",
  Voided: "var(--bp-destructive)",
};

/**
 * The deal's invoices — one row per PDF that has been generated against its
 * voucher.
 *
 * The rows are the deal's own records now; this used to derive a single fake
 * "Draft" row from the deal's primary party. The columns are what a broker
 * scanning a list of bills needs: which file, which bill number, what last
 * happened to it, when, and who did it. The amounts live on the invoice and
 * belong on the invoice, not spread across a directory of them.
 *
 * No QuickBooks column. It used to carry a sync badge derived from the
 * receivables each invoice billed, which said something about the A/R rows
 * rather than about the bill — and the voucher's own Receivables table already
 * says it, one row per line, where a broker can act on it.
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
            <FontAwesomeIcon
              icon={faFileInvoiceDollar}
              aria-label="No invoices"
            />
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
                <FontAwesomeIcon icon={faFileLines} />
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
            {invoices.map((invoice) => (
              <Table.Row key={invoice.id}>
                <Table.Cell>
                  <FontAwesomeIcon icon={faFilePdf} className="text-danger" />
                </Table.Cell>
                <Table.Cell className="fw-medium">{invoice.name}</Table.Cell>
                {/* "Draft" in place of a number, which is what an unfinalized
                    bill has: the number is assigned at finalize. */}
                <Table.Cell>{invoice.number ?? "Draft"}</Table.Cell>
                <Table.Cell>
                  <StatusPill color={ACTIVITY_COLORS[invoice.lastActivity]}>
                    {invoice.lastActivity}
                  </StatusPill>
                </Table.Cell>
                <Table.Cell>{formatDateAtTime(invoice.activityAt)}</Table.Cell>
                {/* Resolved through the roster rather than stored as a name, so
                    correcting a teammate corrects every invoice they completed.
                    Empty on a draft — nobody has completed it — and an em-dash
                    for an id no longer on the roster, since the bill itself is
                    still a record of what went out. */}
                <Table.Cell>
                  {invoice.completedById
                    ? (findTeammate(invoice.completedById)?.name ?? "—")
                    : ""}
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
                        <FontAwesomeIcon
                          icon={faPenToSquare}
                          className="me-2"
                        />
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
