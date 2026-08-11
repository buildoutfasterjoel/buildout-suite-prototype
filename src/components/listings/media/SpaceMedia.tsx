import { Alert } from "@buildoutinc/blueprint-react/ui/Alert";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpRight } from "@fortawesome/pro-regular-svg-icons";
import { faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";
import type { DealMarketing, Listing } from "#/data/types";
import { updateDealMarketing } from "#/data/actions";
import { ListingPageHeader } from "#/components/listings/ListingPageHeader";
import { MediaAssetGrid } from "./MediaAssetGrid";
import { MediaLinksSection } from "./MediaLinksSection";
import { VisualMediaGallery } from "./VisualMediaGallery";
import type { MediaScope } from "./mediaScope";

/**
 * A suite's Media tab: the four sections it owns, editable, then a separated
 * read-only block for what it inherits from the building.
 *
 * Both scopes read and write the SHELL's marketing — a unit's media has one home,
 * and this page is a filtered editor onto it, not an owner of a copy. That is why
 * `patchMarketing` targets `shell.id` and not the space's own id.
 *
 * The two blocks are separated rather than merged, which is a deliberate
 * departure from `mediaForUnit`'s fallback: the editable/read-only boundary is the
 * entire point of the page, and merging the lists into one grid would hide exactly
 * what this exists to communicate.
 */
export function SpaceMedia({
  shell,
  unitId,
  unitLabel,
}: {
  shell: Listing;
  unitId: string;
  unitLabel: string;
}) {
  const patchMarketing = (patch: Partial<DealMarketing>) => {
    updateDealMarketing(shell.id, patch);
  };
  const own: MediaScope = { marketing: shell.marketing, patchMarketing, unitId };
  const inherited: MediaScope = {
    marketing: shell.marketing,
    patchMarketing,
    unitId: null,
    readOnly: true,
  };

  return (
    <div className="d-flex flex-column gap-4 p-4">
      <ListingPageHeader title="Media" />

      <MediaAssetGrid
        scope={own}
        kind="photo"
        title="Space Photos"
        emptyHint={`No photos of ${unitLabel} yet.`}
      />

      <Separator />
      <MediaAssetGrid
        scope={own}
        kind="floorPlan"
        title="Floor Plan"
        emptyHint="No floor plan uploaded for this suite."
      />

      <Separator />
      <VisualMediaGallery scope={own} />

      <Separator />
      <MediaLinksSection scope={own} />

      <Separator />
      <div className="d-flex flex-column gap-3">
        <div className="d-flex align-items-center justify-content-between gap-2">
          <h2 className="fs-large fw-semibold mb-0">From the building</h2>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to="/listings/$listingId/media" params={{ listingId: shell.id }} />}
          >
            Manage
            <FontAwesomeIcon icon={faArrowUpRight} style={{ fontSize: 12 }} />
          </Button>
        </div>
        <Alert severity="info" withIcon>
          <FontAwesomeIcon icon={faCircleInfo} />
          These are {shell.name}'s own assets, shown alongside this suite. They are
          managed on the building.
        </Alert>
        <MediaAssetGrid
          scope={inherited}
          kind="photo"
          title="Property Photos"
          emptyHint="The building has no property photos yet."
        />
        <VisualMediaGallery scope={inherited} />
      </div>
    </div>
  );
}
