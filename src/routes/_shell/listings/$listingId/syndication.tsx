import { createFileRoute } from "@tanstack/react-router";
import { ClassicSyndicationPage } from "#/components/classic/ClassicSyndicationPage";

export const Route = createFileRoute("/_shell/listings/$listingId/syndication")({
  component: ClassicSyndicationPage,
});
