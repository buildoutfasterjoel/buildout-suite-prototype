import { createFileRoute } from "@tanstack/react-router";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faReceipt } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { DealInvoices } from "#/components/deals/DealInvoices";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/financial-documents",
)({
  component: InvoicesRoute,
});

function InvoicesRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;

  // The sidebar hides this item for a shell, but the route stays reachable by a
  // direct URL or the back button. Invoicing follows the money, and the money is
  // earned per space, so guard at the route as well.
  if (dealShape(listing) === "shell") {
    return (
      <div className="p-4">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faReceipt} aria-label="Not eligible" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>A building listing has no invoices</Empty.Title>
            Each space carries its own terms and commission — open the space to
            invoice against it.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return <DealInvoices listing={listing} />;
}
