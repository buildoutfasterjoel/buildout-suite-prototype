import { createFileRoute } from "@tanstack/react-router";
import { UsersRoster } from "#/components/settings/users/UsersRoster";

export const Route = createFileRoute("/_shell/settings/users/")({
  component: UsersRoster,
  head: () => ({ meta: [{ title: "Users | Company Settings" }] }),
});
