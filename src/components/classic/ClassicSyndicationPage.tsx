import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSatelliteDish } from "@fortawesome/pro-regular-svg-icons";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";

/**
 * Syndication, on a classic deal — deliberately empty for now.
 *
 * Syndication has no section anywhere in the app today: the modern deal page
 * shows it as a status widget in `PropertyDetailHeader`, and the channel detail
 * lives in a modal. Joel's call is that this page gets built from that modal
 * rather than by lifting the header widget onto a page, so the route exists to
 * hold the sidebar item and nothing more.
 */
export function ClassicSyndicationPage() {
  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Syndication" />
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faSatelliteDish} />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Nothing here yet</Empty.Title>
          Syndication channels are managed from the listing today. This page is
          next.
        </Empty.Content>
      </Empty>
    </div>
  );
}
