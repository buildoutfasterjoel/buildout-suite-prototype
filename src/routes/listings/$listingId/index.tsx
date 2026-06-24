import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/listings/$listingId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/listings/$listingId/overview",
      params: { listingId: params.listingId },
      replace: true,
    });
  },
});
