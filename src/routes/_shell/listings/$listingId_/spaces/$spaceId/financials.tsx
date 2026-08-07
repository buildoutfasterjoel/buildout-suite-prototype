import { createFileRoute } from "@tanstack/react-router";
import { DealFinancials } from "#/components/deals/DealFinancials";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/financials",
)({ component: SpaceFinancialsRoute });

function SpaceFinancialsRoute() {
  const { listingId, spaceId } = Route.useParams();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return (
    <DealFinancials
      listing={record.space}
      heading={`Voucher — ${record.label}`}
    />
  );
}
