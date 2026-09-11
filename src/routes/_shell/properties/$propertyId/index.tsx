import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/properties/$propertyId/")({
  beforeLoad: ({ params }) => {
    // A pure param-to-param redirect, so it reads nothing from the store — the
    // `cf5676c` constraint (no store reads in `beforeLoad`) is respected. Every
    // existing `/properties/{id}` link lands here and continues to Overview.
    throw redirect({
      to: "/properties/$propertyId/overview",
      params,
      replace: true,
    });
  },
});
