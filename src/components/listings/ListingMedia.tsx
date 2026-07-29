import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import type { Listing } from "#/data/types";
import { listingGallery } from "#/components/properties/propertyDisplay";
import { ListingPageHeader } from "./ListingPageHeader";

/**
 * Media library for a listing. Uploads aren't modeled yet — the gallery is
 * derived from the listing id (see `listingGallery`) so it matches the photos
 * shown on the deal card and in the publish preview.
 */
export function ListingMedia({ listing }: { listing: Listing }) {
  const photos = listingGallery(listing.id, 8, 480, 280);

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader
        title="Media"
        actions={
          <Button variant="outline">
            <FontAwesomeIcon icon={faUpload} />
            Upload Media
          </Button>
        }
      />

      <div className="row g-3">
        {photos.map((src) => (
          <div key={src} className="col-6 col-md-4 col-xl-3">
            <img
              src={src}
              alt="Listing photo"
              className="w-100 rounded border"
              style={{ aspectRatio: "4 / 3", objectFit: "cover" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
