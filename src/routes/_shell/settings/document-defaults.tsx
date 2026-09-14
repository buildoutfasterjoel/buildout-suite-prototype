import { createFileRoute } from "@tanstack/react-router";
import { faFileLines } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/document-defaults")({
  component: DocumentDefaultsSettings,
});

function DocumentDefaultsSettings() {
  return (
    <SettingsPlaceholder
      title="Document Defaults"
      icon={faFileLines}
      description="Default templates, disclaimers, and cover pages for generated marketing documents."
    />
  );
}
