import { createFileRoute } from "@tanstack/react-router";
import { faEnvelope } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/email")({
  component: EmailSettings,
});

function EmailSettings() {
  return (
    <SettingsPlaceholder
      title="Email"
      icon={faEnvelope}
      description="Sending domains, signatures, and campaign defaults."
    />
  );
}
