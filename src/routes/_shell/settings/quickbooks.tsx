import { createFileRoute } from "@tanstack/react-router";
import { faCircleDollar } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/quickbooks")({
  component: QuickBooksSettings,
});

function QuickBooksSettings() {
  return (
    <SettingsPlaceholder
      title="QuickBooks"
      icon={faCircleDollar}
      description="Connect a QuickBooks company and map deals, invoices, and payments to its accounts."
    />
  );
}
