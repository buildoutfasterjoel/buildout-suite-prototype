import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { DealVoucher } from "#/components/deals/DealStubs";

export const Route = createFileRoute("/listings/$listingId/voucher")({
  component: VoucherRoute,
});

function VoucherRoute() {
  const { listingId } = Route.useParams();
  const listing = getStore().listings.get(listingId);
  if (!listing) return null;
  return <DealVoucher listing={listing} />;
}
