import { createFileRoute } from "@tanstack/react-router";
import { faImages } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/logos")({
  component: LogosSettings,
});

function LogosSettings() {
  return (
    <SettingsPlaceholder
      title="Logos"
      icon={faImages}
      description="Company and office logos used on documents and listing websites."
    />
  );
}
