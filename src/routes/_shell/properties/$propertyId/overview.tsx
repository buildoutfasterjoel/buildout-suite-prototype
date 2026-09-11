import { createFileRoute } from "@tanstack/react-router";
import { usePropertyDetail } from "#/components/properties/usePropertyDetail";
import { RecordDetails } from "#/components/common/RecordDetails";
import { propertyDetailsSections } from "#/components/properties/propertyDetails";

export const Route = createFileRoute("/_shell/properties/$propertyId/overview")({
  component: PropertyOverviewRoute,
});

/** The property's facts, in Buildout's own groups and row style, with its filter box. */
function PropertyOverviewRoute() {
  const { propertyId } = Route.useParams();
  const detail = usePropertyDetail(propertyId);
  if (!detail) return null;

  return (
    <div className="p-4 d-flex flex-column gap-3">
      {/* Same heading tier as the Spaces tab's strip, so the two tabs open alike. */}
      <h2 className="fs-6 fw-semibold mb-0">Overview</h2>
      <RecordDetails
        sections={propertyDetailsSections(detail.property)}
        filter={{ label: "Filter Property Details" }}
      />
    </div>
  );
}
