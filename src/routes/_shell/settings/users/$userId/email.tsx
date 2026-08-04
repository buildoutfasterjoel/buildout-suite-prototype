import { createFileRoute } from "@tanstack/react-router";
import { faEnvelope } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/users/$userId/email")({
  component: EmailTab,
});

function EmailTab() {
  return (
    <SettingsPlaceholder
      title="Email"
      icon={faEnvelope}
      description="Sending address, signature, and the syndication credentials this user sends under."
    />
  );
}
