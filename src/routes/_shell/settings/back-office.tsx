import { createFileRoute } from "@tanstack/react-router";
import { faCalculator } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/back-office")({
  component: BackOfficeSettings,
});

function BackOfficeSettings() {
  return (
    <SettingsPlaceholder
      title="Back Office"
      icon={faCalculator}
      description="Commission splits, fee schedules, and how closed deals post to accounting."
    />
  );
}
