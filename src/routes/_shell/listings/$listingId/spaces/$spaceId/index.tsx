import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_SPACE_PANEL_LEAF } from "#/components/deals/spacePanelTabs";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/",
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: `/listings/${params.listingId}/spaces/${params.spaceId}/${DEFAULT_SPACE_PANEL_LEAF}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  },
});
