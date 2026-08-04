import { createFileRoute } from "@tanstack/react-router";
import { faBell } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/notifications")({
  component: NotificationsSettings,
});

function NotificationsSettings() {
  return (
    <SettingsPlaceholder
      title="Notifications"
      icon={faBell}
      description="Which events email which users, and how often digests go out."
    />
  );
}
