import { createFileRoute } from "@tanstack/react-router";
import { getStore } from "#/data/store";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";

export const Route = createFileRoute("/listings/$listingId/leads")({
  component: LeadsRoute,
});

function LeadsRoute() {
  const { listingId } = Route.useParams();
  const property = getStore().properties.get(listingId);

  if (!property) return null;

  return <PropertyDetailLeads property={property} />;
}
