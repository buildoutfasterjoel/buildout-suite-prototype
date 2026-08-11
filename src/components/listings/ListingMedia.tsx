import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import type { DealMarketing, Listing, Property } from "#/data/types";
import { updateDealMarketing } from "#/data/actions";
import { ListingPageHeader } from "./ListingPageHeader";
import { MediaAssetGrid } from "./media/MediaAssetGrid";
import { MediaLinksSection } from "./media/MediaLinksSection";
import { VisualMediaGallery } from "./media/VisualMediaGallery";
import { BuildingMediaSpaces } from "./media/BuildingMediaSpaces";
import type { MediaScope } from "./media/mediaScope";

/**
 * A building's Media library: its own photos and embeds, its suites' media, and
 * its three named destinations.
 *
 * This page owns the write path for EVERY asset on the property, including each
 * suite's — a unit's media lives in the building's `marketing` and nowhere else.
 * A space's Media tab is a filtered editor onto this same data (see `SpaceMedia`).
 */
export function ListingMedia({
  listing,
  property,
}: {
  listing: Listing;
  property: Property;
}) {
  const patchMarketing = (patch: Partial<DealMarketing>) => {
    updateDealMarketing(listing.id, patch);
  };
  const buildingScope: MediaScope = {
    marketing: listing.marketing,
    patchMarketing,
    unitId: null,
  };

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Media" />

      <MediaAssetGrid
        scope={buildingScope}
        kind="photo"
        title="Property Photos"
        emptyHint="No property photos yet."
      />

      <Separator />
      <VisualMediaGallery scope={buildingScope} />

      {/* Only when the property is actually divided. A listing with no units has
          no suites to show, and an empty "Spaces" heading reads as a bug. */}
      {property.units.length > 0 && (
        <>
          <Separator />
          <BuildingMediaSpaces
            property={property}
            marketing={listing.marketing}
            patchMarketing={patchMarketing}
          />
        </>
      )}

      <Separator />
      <MediaLinksSection scope={buildingScope} />
    </div>
  );
}
