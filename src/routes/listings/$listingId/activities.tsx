import { createFileRoute } from "@tanstack/react-router";
import { DealActivities } from "#/components/deals/DealStubs";

export const Route = createFileRoute("/listings/$listingId/activities")({
  component: DealActivities,
});
