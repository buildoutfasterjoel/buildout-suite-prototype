import { createFileRoute } from "@tanstack/react-router";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { emptySpaceLeaseTerms } from "#/data/createListing";
import { updateDealMarketing } from "#/data/actions";
import { SpaceTermsSection } from "#/components/listings/edit/sections/SpaceTermsSection";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId/terms",
)({
  component: SpaceTermsRoute,
});

function SpaceTermsRoute() {
  const { spaceId } = Route.useParams();
  const listing = useDataStore((s) => s.listings).get(spaceId);
  const property = listing ? getProperty(listing.propertyId) : undefined;
  const unit = property?.units.find((u) => u.id === listing?.unitId);

  if (!listing || !property || !unit) return null;

  const terms =
    listing.marketing.spaceLeaseTerms?.[0] ?? emptySpaceLeaseTerms(unit.id);

  return (
    <SpaceTermsSection
      unit={unit}
      property={property}
      terms={terms}
      onChange={(patch) =>
        updateDealMarketing(listing.id, {
          spaceLeaseTerms: [{ ...terms, ...patch }],
        })
      }
    />
  );
}
