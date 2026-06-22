import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/listings/$listingId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/listings/$listingId/leads",
      params: { listingId: params.listingId },
      replace: true,
    });
  },
});
