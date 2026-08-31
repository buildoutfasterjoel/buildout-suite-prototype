import { Link } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing } from "#/data/store";
import { classicDeals, type ClassicDealRow } from "#/data/classicDeals";
import { dealCardLinkProps } from "#/components/deals/dealCardLink";
import { TYPE_LABELS } from "#/components/properties/propertyDisplay";
import { DealStageBadge } from "#/components/deals/DealStageBadge";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";

/** Full dollars, not the card's "$31.6M" — this table is read as a ledger. */
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "Aug 25" — the same short form every other deal surface uses for a date. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * The Brokers column: stacked initials, one per internal broker. Blueprint's
 * `Avatar.Group` handles the overlap and the "+n" itself, so nothing here does.
 */
function BrokerAvatars({ initials }: { initials: string[] }) {
  if (initials.length === 0) return <span className="text-muted">—</span>;
  return (
    <Avatar.Group size="sm">
      {initials.map((text, i) => (
        <Avatar key={`${text}-${i}`}>
          <Avatar.Fallback className="fw-semibold">{text}</Avatar.Fallback>
        </Avatar>
      ))}
    </Avatar.Group>
  );
}

/**
 * The deal's title cell. A row that is a real deal links to it; a companion row
 * renders plain, because a link that goes nowhere is worse than no link.
 */
function TitleCell({ row }: { row: ClassicDealRow }) {
  const listing = row.listingId ? getListing(row.listingId) : undefined;
  if (!listing) return <>{row.title}</>;
  return (
    // Through `dealCardLinkProps`, like every other row that opens a deal — a
    // classic deal is never a space today, but this is the one resolver that
    // stays right if one ever is.
    <Link {...dealCardLinkProps(listing)} className="text-decoration-none">
      {row.title}
    </Link>
  );
}

/**
 * Deals, on a classic deal — the deals attached to this listing.
 *
 * The columns are legacy Buildout's, in its order. Two of them are links rather
 * than text because they are the two a broker acts on: the title opens the deal,
 * and the open-task count opens where those tasks live (Tasks, which on a classic
 * deal is the Overview). No Create Deal button — Joel's call.
 *
 * Rows come from `classicDeals`, which pairs this listing's own deal with fixture
 * companions; see that module for why the companions are not store records.
 */
export function ClassicDealsPage({ listingId }: { listingId: string }) {
  // Subscribe to the map: the own row's stage, money and open-task count all
  // change from elsewhere in the app (the stage control, the voucher, a task).
  void useDataStore((s) => s.listings);
  const rows = classicDeals(listingId);

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader title="Deals" />

      {rows.length === 0 ? (
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faHandshake} />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No deals on this listing yet</Empty.Title>
            Deals attached to this listing will be listed here.
          </Empty.Content>
        </Empty>
      ) : (
        // The row is wide — eleven columns — so it scrolls inside its own box
        // rather than pushing the page sideways.
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Deal Title</Table.Head>
                <Table.Head>Deal ID</Table.Head>
                <Table.Head>Deal Type</Table.Head>
                <Table.Head>Deal Stage</Table.Head>
                <Table.Head>Location</Table.Head>
                <Table.Head>Property Type</Table.Head>
                <Table.Head>Brokers</Table.Head>
                <Table.Head>Transaction Value</Table.Head>
                <Table.Head>Brokerage Gross</Table.Head>
                <Table.Head>Open Tasks</Table.Head>
                <Table.Head>Next Critical Date</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell className="fw-medium text-nowrap">
                    <TitleCell row={row} />
                  </Table.Cell>
                  <Table.Cell>{row.dealId}</Table.Cell>
                  <Table.Cell>{row.dealType}</Table.Cell>
                  <Table.Cell>
                    <DealStageBadge stage={row.stage} />
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {row.location}
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {TYPE_LABELS[row.propertyType]}
                  </Table.Cell>
                  <Table.Cell>
                    <BrokerAvatars initials={row.brokerInitials} />
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {money(row.transactionValue)}
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {money(row.brokerageGross)}
                  </Table.Cell>
                  <Table.Cell className="text-nowrap">
                    {row.openTasks === 0 ? (
                      <span className="text-muted">None</span>
                    ) : (
                      // Tasks live on the Overview, which is what the classic
                      // sidebar's Tasks item opens.
                      <Link
                        to="/listings/$listingId/overview"
                        params={{ listingId }}
                        className="text-decoration-none"
                      >
                        {row.openTasks}{" "}
                        {row.openTasks === 1 ? "task" : "tasks"} open
                      </Link>
                    )}
                  </Table.Cell>
                  {/* Blank, not an em-dash: legacy leaves it blank, and a deal
                      with no next milestone has nothing to say here. */}
                  <Table.Cell className="text-nowrap">
                    {shortDate(row.nextCriticalDate)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  );
}
