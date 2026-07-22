import { createFileRoute } from "@tanstack/react-router";
import { faReceipt } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { DealPagePlaceholder } from "#/components/deals/DealPagePlaceholder";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/financial-documents",
)({
  component: FinancialDocumentsRoute,
});

function FinancialDocumentsRoute() {
  const { listingId } = Route.useParams();
  if (!getStore().listings.get(listingId)) return null;
  return (
    <DealPagePlaceholder title="Financial Documents" icon={faReceipt} />
  );
}
