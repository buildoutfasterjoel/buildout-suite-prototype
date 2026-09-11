import { createFileRoute } from "@tanstack/react-router";
import { faFileInvoice } from "@fortawesome/pro-regular-svg-icons";
import { SettingsPlaceholder } from "#/components/settings/SettingsPlaceholder";

export const Route = createFileRoute("/_shell/settings/invoice-defaults")({
  component: InvoiceDefaultsSettings,
});

function InvoiceDefaultsSettings() {
  return (
    <SettingsPlaceholder
      title="Invoice Defaults"
      icon={faFileInvoice}
      description="Payment terms, remit-to details, and numbering applied to every new invoice."
    />
  );
}
