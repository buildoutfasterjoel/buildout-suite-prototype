import { createFileRoute } from "@tanstack/react-router";
import { faBell } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/users/$userId/notifications")({
  component: NotificationsTab,
});

function NotificationsTab() {
  return (
    <SettingsPlaceholder
      title="Notifications"
      icon={faBell}
      description="Which events email this user, and how often digests arrive."
    />
  );
}
