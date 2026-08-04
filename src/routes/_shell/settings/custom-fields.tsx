import { createFileRoute } from "@tanstack/react-router";
import { faSliders } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/custom-fields")({
  component: CustomFieldsSettings,
});

function CustomFieldsSettings() {
  return (
    <SettingsPlaceholder
      title="Custom Fields"
      icon={faSliders}
      description="Company-defined fields on properties, deals, and contacts."
    />
  );
}
