import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImages, faUpload } from "@fortawesome/pro-regular-svg-icons";
import type { Listing } from "#/data/types";
import { ListingPageHeader } from "./ListingPageHeader";

/** Media library placeholder for a listing — photo/video uploads aren't modeled yet. */
export function ListingMedia({ listing: _listing }: { listing: Listing }) {
  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Media" />

      <Empty className="py-8">
        <Empty.Media>
          <FontAwesomeIcon icon={faImages} aria-label="No media" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>No media uploaded yet</Empty.Title>
          Photos and videos for this listing will show up here.
        </Empty.Content>
        <Empty.Actions>
          <Button variant="primary">
            <FontAwesomeIcon icon={faUpload} />
            Upload Media
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}
