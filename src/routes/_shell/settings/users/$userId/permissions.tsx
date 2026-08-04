import { createFileRoute } from "@tanstack/react-router";
import { useRoster } from "#/components/settings/users/useRoster";
import { UserPermissions } from "#/components/settings/users/UserPermissions";

export const Route = createFileRoute(
  "/_shell/settings/users/$userId/permissions",
)({
  component: PermissionsTab,
});

function PermissionsTab() {
  const { userId } = Route.useParams();
  const user = useRoster((s) => s.users.find((u) => u.id === userId));
  if (!user) return null;
  return <UserPermissions user={user} />;
}
