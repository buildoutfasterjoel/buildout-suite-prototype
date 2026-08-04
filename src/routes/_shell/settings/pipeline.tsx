import { createFileRoute } from "@tanstack/react-router";
import { faFilter } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/pipeline")({
  component: PipelineSettings,
});

function PipelineSettings() {
  return (
    <SettingsPlaceholder
      title="Pipeline"
      icon={faFilter}
      description="Deal stages, their order, and the gates required to advance."
    />
  );
}
