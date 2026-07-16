import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/listings/$listingId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/listings/$listingId/overview",
      params: { listingId: params.listingId },
      replace: true,
    });
  },
});
