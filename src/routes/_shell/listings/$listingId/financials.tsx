import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileInvoiceDollar } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { dealShape } from "#/data/dealShape";
import { DealFinancials } from "#/components/deals/DealFinancials";

export const Route = createFileRoute("/_shell/listings/$listingId/financials")({
  component: FinancialsRoute,
});

function FinancialsRoute() {
  const { listingId } = Route.useParams();
  // Reactive selector so an Edit Transaction save re-renders the summary immediately.
  const listing = useDataStore((s) => s.listings.get(listingId));
  if (!listing) return null;

  // The sidebar hides this item for a shell, but the route stays reachable by a
  // direct URL or the back button. A voucher here would show a commission that
  // belongs to the building's spaces, so guard at the route as well.
  if (dealShape(listing) === "shell") {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon
              icon={faFileInvoiceDollar}
              aria-label="Not eligible"
            />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>A building listing has no voucher</Empty.Title>
            Each space carries its own terms and commission — open the space to
            see its voucher.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return <DealFinancials listing={listing} />;
}
