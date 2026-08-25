import { createFileRoute } from "@tanstack/react-router";
import { DealEditor } from "#/components/deals/edit/DealEditor";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

/**
 * A space's Edit Deal form. Not a nav section — like the building's `/edit`, the
 * only way in is a pencil (here, the Transaction section of the space's
 * Voucher), which is why `spaceNavRoutes.test.ts` exempts it from the
 * every-route-has-a-nav-item rule.
 *
 * A space needs its own edit page because it, not its shell, carries the
 * transaction: `visibleDealGroups` gives a shell neither Transaction Terms nor
 * Financials, so the shell's form has nowhere to put a suite's commission.
 */
export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/edit",
)({ component: SpaceEditRoute });

function SpaceEditRoute() {
  const { listingId, spaceId } = Route.useParams();
  // Reactive through the guard, so a store write mid-edit (a stage gate commit
  // from the header, say) reaches the editor's re-seed effects.
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;
  return <DealEditor listing={record.space} />;
}
