import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Table } from "@buildoutinc/blueprint-react/ui/Table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faAngleRight } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { dealStageLabel } from "#/data/dealShape";
import { spaceVouchers } from "#/data/spaceVouchers";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { shouldIgnoreRowClick } from "#/components/contacts/rowClick";

export const Route = createFileRoute("/_shell/listings/$listingId/vouchers/")({
  component: VouchersIndexRoute,
});

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Every space's money in one place. A shell holds no rate and earns no commission
 * of its own, so the only figure it can honestly show is the sum of what its
 * spaces are earning — which is the question this index exists to answer.
 */
function VouchersIndexRoute() {
  const { listingId } = Route.useParams();
  const navigate = useNavigate();
  // Subscribe to the map: a row's commission and tenant live on the *child*
  // deals, so this must re-render when any of them changes, not just the shell.
  void useDataStore((s) => s.listings);
  const rows = spaceVouchers(listingId);
  const total = rows.reduce((sum, r) => sum + (r.commissionAmount ?? 0), 0);

  return (
    <div className="d-flex flex-column gap-3 p-4">
      <ListingPageHeader
        title="Vouchers"
        actions={
          <span className="text-muted">
            {rows.length} {rows.length === 1 ? "space" : "spaces"} · {money(total)} total
          </span>
        }
      />

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.Head>Space</Table.Head>
            <Table.Head>Tenant</Table.Head>
            <Table.Head>Commission</Table.Head>
            <Table.Head>Stage</Table.Head>
            <Table.Head style={{ width: 44 }} />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rows.map((row) => (
            // The whole row navigates, matching ContactsTable's pattern — the
            // trailing chevron promises a full-row target, so the row must be
            // one. `shouldIgnoreRowClick` already exempts `<a>`, so the label
            // link below still handles its own click (and modified clicks keep
            // opening new tabs), while the Link itself carries the keyboard
            // affordance and href semantics.
            <Table.Row
              key={row.dealId}
              style={{ cursor: "pointer" }}
              onClick={(e) => {
                if (shouldIgnoreRowClick(e)) return;
                void navigate({
                  to: "/listings/$listingId/spaces/$spaceId/financials",
                  params: { listingId, spaceId: row.dealId },
                });
              }}
            >
              <Table.Cell className="fw-medium">
                <Link
                  to="/listings/$listingId/spaces/$spaceId/financials"
                  params={{ listingId, spaceId: row.dealId }}
                  className="text-reset"
                >
                  {row.label}
                </Link>
              </Table.Cell>
              {/* An em-dash, not a zero: a voucher exists before it is filled. */}
              <Table.Cell>{row.tenantName ?? "—"}</Table.Cell>
              <Table.Cell>
                {row.commissionAmount == null ? "—" : money(row.commissionAmount)}
              </Table.Cell>
              <Table.Cell>{dealStageLabel(row.stage, "space")}</Table.Cell>
              <Table.Cell>
                <FontAwesomeIcon icon={faAngleRight} className="text-muted" />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    </div>
  );
}
