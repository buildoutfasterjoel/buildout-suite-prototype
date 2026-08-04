import { createFileRoute } from "@tanstack/react-router";
import { faPuzzlePiece } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/plugins")({
  component: PluginsSettings,
});

function PluginsSettings() {
  return (
    <SettingsPlaceholder
      title="Plugins"
      icon={faPuzzlePiece}
      description="Website embeds and integrations that surface your listings elsewhere."
    />
  );
}
