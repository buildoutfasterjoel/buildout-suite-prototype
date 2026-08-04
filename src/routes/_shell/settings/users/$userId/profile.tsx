import { createFileRoute } from "@tanstack/react-router";
import { useRoster } from "#/components/settings/users/useRoster";
import { UserProfileForm } from "#/components/settings/users/UserProfileForm";

export const Route = createFileRoute("/_shell/settings/users/$userId/profile")({
  component: ProfileTab,
});

function ProfileTab() {
  const { userId } = Route.useParams();
  const user = useRoster((s) => s.users.find((u) => u.id === userId));
  if (!user) return null;
  // Keyed on the user so switching people re-seeds the form rather than
  // carrying one person's unsaved edits onto another.
  return <UserProfileForm key={user.id} user={user} />;
}
