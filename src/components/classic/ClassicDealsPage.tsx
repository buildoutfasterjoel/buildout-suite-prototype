import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake } from "@fortawesome/pro-regular-svg-icons";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";

/**
 * Deals, on a classic deal — the index of deals attached to this listing, and
 * the one section in the classic sidebar that is not an existing page under a
 * new name.
 *
 * Structure only for now, by Joel's call: the column set and the empty state,
 * with no rows. Our data model has no listing→many-deals relation to read from
 * (a Listing *is* its deal, 1:1), so inventing rows here would mean inventing
 * the relation too. The columns are the shape a row will take.
 */
export function ClassicDealsPage() {
  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader title="Deals" />

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Deal</Table.Head>
            <Table.Head>Type</Table.Head>
            <Table.Head>Stage</Table.Head>
            <Table.Head>Client</Table.Head>
            <Table.Head>Value</Table.Head>
            <Table.Head>Commission</Table.Head>
          </Table.Row>
        </Table.Header>
      </Table>

      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faHandshake} />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No deals on this listing yet</Empty.Title>
          Deals attached to this listing will be listed here.
        </Empty.Content>
      </Empty>
    </div>
  );
}
