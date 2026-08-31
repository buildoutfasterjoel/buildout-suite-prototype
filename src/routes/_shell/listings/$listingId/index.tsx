import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStore } from "#/data/store";

export const Route = createFileRoute("/_shell/listings/$listingId/")({
  beforeLoad: ({ params }) => {
    // A classic deal's sidebar has no Overview (see CLASSIC_NAV_GROUPS), so it
    // opens on Leads — its first section — rather than on a page it cannot
    // navigate back to.
    const isClassic =
      getStore().listings.get(params.listingId)?.isClassic ?? false;
    if (isClassic) {
      throw redirect({
        to: "/listings/$listingId/leads",
        params: { listingId: params.listingId },
        replace: true,
      });
    }
    throw redirect({
      to: "/listings/$listingId/overview",
      params: { listingId: params.listingId },
      replace: true,
    });
  },
});
