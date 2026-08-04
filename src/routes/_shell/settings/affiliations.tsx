import { createFileRoute } from "@tanstack/react-router";
import { faSitemap } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/affiliations")({
  component: AffiliationsSettings,
});

function AffiliationsSettings() {
  return (
    <SettingsPlaceholder
      title="Affiliations"
      icon={faSitemap}
      description="Networks, franchises, and partner organizations this company belongs to."
    />
  );
}
