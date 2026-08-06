import { createFileRoute } from "@tanstack/react-router";
import { DealInvoices } from "#/components/deals/DealInvoices";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/financial-documents",
)({ component: SpaceFinancialDocumentsRoute });

function SpaceFinancialDocumentsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return (
    <DealInvoices
      listing={record.space}
      heading={`Invoices — ${record.label}`}
    />
  );
}
