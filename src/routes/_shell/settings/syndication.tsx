import { createFileRoute } from "@tanstack/react-router";
import { faTowerBroadcast } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/syndication")({
  component: SyndicationSettings,
});

function SyndicationSettings() {
  return (
    <SettingsPlaceholder
      title="Syndication"
      icon={faTowerBroadcast}
      description="Which portals receive your listings, and the credentials for each."
    />
  );
}
