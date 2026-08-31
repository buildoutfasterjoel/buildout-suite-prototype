import { createFileRoute } from "@tanstack/react-router";
import { ClassicDealsPage } from "#/components/classic/ClassicDealsPage";

export const Route = createFileRoute("/_shell/listings/$listingId/deals")({
  component: ClassicDealsPage,
});
