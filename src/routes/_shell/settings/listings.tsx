import { createFileRoute } from "@tanstack/react-router";
import { faSignHanging } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/listings")({
  component: ListingsSettings,
});

function ListingsSettings() {
  return (
    <SettingsPlaceholder
      title="Listings"
      icon={faSignHanging}
      description="Defaults applied to every new listing, and required-field rules."
    />
  );
}
