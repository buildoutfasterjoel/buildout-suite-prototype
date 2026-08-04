import { createFileRoute } from "@tanstack/react-router";
import { faBuildings } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/offices")({
  component: OfficesSettings,
});

function OfficesSettings() {
  return (
    <SettingsPlaceholder
      title="Offices"
      icon={faBuildings}
      description="Office locations, addresses, and which users belong to each."
    />
  );
}
