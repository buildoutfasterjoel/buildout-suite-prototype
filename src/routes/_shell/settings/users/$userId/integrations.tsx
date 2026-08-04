import { createFileRoute } from "@tanstack/react-router";
import { faPlug } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/users/$userId/integrations")({
  component: IntegrationsTab,
});

function IntegrationsTab() {
  return (
    <SettingsPlaceholder
      title="Integrations"
      icon={faPlug}
      description="Connected apps, AI settings, and beta program enrollment."
    />
  );
}
