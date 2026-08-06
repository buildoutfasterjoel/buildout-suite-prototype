import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/listings/$listingId_/spaces/$spaceId/")({
  beforeLoad: ({ params }) => {
    // A pure param-to-param redirect, so it reads nothing from the store — the
    // `cf5676c` constraint (no store reads in `beforeLoad`) is respected.
    throw redirect({
      to: "/listings/$listingId/spaces/$spaceId/overview",
      params,
    });
  },
});
