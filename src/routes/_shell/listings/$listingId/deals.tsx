import { createFileRoute } from "@tanstack/react-router";
import { ClassicDealsPage } from "#/components/classic/ClassicDealsPage";

export const Route = createFileRoute("/_shell/listings/$listingId/deals")({
  component: DealsRoute,
});

function DealsRoute() {
  const { listingId } = Route.useParams();
  return <ClassicDealsPage listingId={listingId} />;
}
