import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/settings/users/$userId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/settings/users/$userId/profile",
      params: { userId: params.userId },
      replace: true,
    });
  },
});
