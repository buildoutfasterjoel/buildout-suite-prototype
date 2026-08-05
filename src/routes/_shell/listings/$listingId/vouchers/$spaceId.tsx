import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { DealFinancials } from "#/components/deals/DealFinancials";
import { DealInvoices } from "#/components/deals/DealInvoices";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/vouchers/$spaceId",
)({
  component: SpaceVoucherRoute,
});

/**
 * One space's money, rendered inside its building. The `listingId` segment
 * declares which building this is scoped to, and a space whose parent differs
 * must never render under it — that would paint this suite's commission over
 * another landlord's frame, which is the bug ab7b6be caught during the reverted
 * panel work. Hence the `belongsHere` guard rather than a bare lookup.
 */
function SpaceVoucherRoute() {
  const { listingId, spaceId } = Route.useParams();
  // The map, not `.get(spaceId)`: the guard below reads the *parent*, so this
  // must re-render when any listing changes.
  const listings = useDataStore((s) => s.listings);
  const space = listings.get(spaceId);

  const belongsHere = !!space && space.parentDealId === listingId;
  if (!space || !belongsHere) return null;

  const property = getProperty(space.propertyId);
  const label =
    property?.units.find((u) => u.id === space.unitId)?.label ?? space.name;

  return (
    <div>
      <DealFinancials listing={space} heading={`Voucher — ${label}`} />
      <DealInvoices listing={space} heading={`Invoices — ${label}`} />
    </div>
  );
}
