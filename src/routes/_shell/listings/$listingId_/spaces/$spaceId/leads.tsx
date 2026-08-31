import { createFileRoute } from "@tanstack/react-router";
import { PropertyDetailLeads } from "#/components/properties/PropertyDetailLeads";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

export const Route = createFileRoute(
  "/_shell/listings/$listingId_/spaces/$spaceId/leads",
)({ component: SpaceLeadsRoute });

function SpaceLeadsRoute() {
  const { listingId, spaceId } = Route.useParams();
  // `q` is validated on the `$spaceId` layout route and inherited here, because
  // search params are declared once per route branch rather than per section.
  const { q } = Route.useSearch();
  const record = useSpaceRoute(listingId, spaceId);
  if (!record) return null;

  return (
    <PropertyDetailLeads
      property={record.property}
      dealId={record.space.id}
      initialSearch={q}
      // Leads are scoped by which listing a contact's `inquiredListingIds`
      // names, and this space deal IS one such listing — so the building's leads
      // arrive filtered to the inquiries about this suite.
      spaceDealId={record.space.id}
    />
  );
}
