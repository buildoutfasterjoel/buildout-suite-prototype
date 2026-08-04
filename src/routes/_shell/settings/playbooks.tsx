import { createFileRoute } from "@tanstack/react-router";
import { faClipboardCheck } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/playbooks")({
  component: PlaybooksSettings,
});

function PlaybooksSettings() {
  return (
    <SettingsPlaceholder
      title="Playbooks"
      icon={faClipboardCheck}
      description="Reusable task and outreach sequences your team runs on deals."
    />
  );
}
