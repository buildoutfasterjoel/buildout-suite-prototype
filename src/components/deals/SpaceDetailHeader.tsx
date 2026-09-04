import { Link, useLocation } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake, faPencil } from "@fortawesome/pro-regular-svg-icons";
import type { Listing, Property } from "#/data/types";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
import { getRefId, getPhotoUrl } from "#/components/properties/propertyDisplay";
import { DealHeroAccessAvatars } from "#/components/deals/DealHeroAccessAvatars";
import { DealStageSelect } from "#/components/deals/DealStageSelect";
import { dealEditTarget } from "#/components/deals/dealCardLink";

/**
 * The space page's own header. Deliberately not `PropertyDetailHeader`, which is
 * built around a building's publish state, property facts and access avatars —
 * none of which a suite owns.
 *
 * The building is one crumb away, which is the only way back the page needs; a
 * separate back button a few pixels from the crumb would be noise.
 */
export function SpaceDetailHeader({
  space,
  shell,
  property,
  label,
}: {
  space: Listing;
  shell: Listing;
  property: Property;
  label: string;
}) {
  const { pathname } = useLocation();
  // Read against the *shell's* id: the path is
  // /listings/{shellId}/spaces/{spaceId}/{section}, so the shell is the prefix
  // and the space's own section is the third segment.
  const { subsectionLabel } = dealBreadcrumbTrail(pathname, shell.id);
  // Seeded on the space, not the building: access is granted per space deal —
  // a broker can be on one suite of a building and not its neighbours — and the
  // ref id names this deal, not its parent.
  const refId = getRefId(space.id);

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        {/* Thumbnail, then identity, then stage — the same three-column shape
            PropertyDetailHeader uses, so a space header and a building header
            read as the same kind of page. */}
        <div className="d-flex align-items-center gap-3">
          {/* Thumbnail, seeded on the SPACE's id, not the building's: each
              suite gets its own photo instead of six copies of the building's.
              Photos are not modelled on a Listing yet — `getPhotoUrl` derives
              a stable one from the curated CRE pool — so this is the one call
              site that changes when spaces gain real media. */}
          <div
            className="flex-shrink-0 d-none d-sm-block align-self-stretch"
            style={{ width: 164 }}
          >
            <img
              src={getPhotoUrl(space.id, 328, 200)}
              alt={space.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: 4,
                display: "block",
              }}
            />
          </div>

          {/* `minWidth: 0` lets the truncation below actually engage — a flex
              child defaults to min-content width and would push the stage select
              off instead of ellipsizing. */}
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            {/* Structure mirrors PropertyDetailHeader's exactly — List wrapper,
                Separator between items, Page for the crumb you are on — so a
                space's trail and a building's are the same component doing the
                same thing. Without the List the items lose Blueprint's own
                layout and the two headers drift apart visually. */}
            <Breadcrumb className="mb-1">
              <Breadcrumb.List>
                <Breadcrumb.Item>
                  <Breadcrumb.Link render={<Link to="/listings" />}>
                    <FontAwesomeIcon icon={faHandshake} />
                    All Deals
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Link
                    render={
                      <Link
                        to="/listings/$listingId"
                        params={{ listingId: shell.id }}
                      />
                    }
                  >
                    {shell.name}
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  <Breadcrumb.Link
                    render={
                      <Link
                        to="/listings/$listingId/spaces"
                        params={{ listingId: shell.id }}
                      />
                    }
                  >
                    Spaces
                  </Breadcrumb.Link>
                </Breadcrumb.Item>
                <Breadcrumb.Separator />
                <Breadcrumb.Item>
                  {/* The suite is a link only when a section sits below it —
                      that link is how a section gets back to the space's own
                      overview, which is why no section carries a back button. */}
                  {subsectionLabel ? (
                    <Breadcrumb.Link
                      render={
                        <Link
                          to="/listings/$listingId/spaces/$spaceId/overview"
                          params={{ listingId: shell.id, spaceId: space.id }}
                        />
                      }
                    >
                      {label}
                    </Breadcrumb.Link>
                  ) : (
                    <Breadcrumb.Page>{label}</Breadcrumb.Page>
                  )}
                </Breadcrumb.Item>
                {subsectionLabel && (
                  <>
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      <Breadcrumb.Page>{subsectionLabel}</Breadcrumb.Page>
                    </Breadcrumb.Item>
                  </>
                )}
              </Breadcrumb.List>
            </Breadcrumb>

            <h1 className="fs-5 fw-semibold mb-0 text-truncate" title={label}>
              {label}
            </h1>
            <div className="text-muted text-truncate">
              {property.street}, {property.city}, {property.state} {property.zip}
            </div>
            {/* The building's fourth row, with this suite's own values. It is
                also what makes the two headers line up: `align-items-center`
                centres this column against the thumbnail, so without a fourth
                row the column is shorter than the image and the breadcrumb sits
                below the building's. No SyndicationStatus — syndication is a
                building-level listing concept in phase 1. */}
            <div className="d-flex align-items-center gap-2 mt-2">
              <Badge variant="secondary" appearance="muted">
                {space.dealType}
              </Badge>
              <Badge variant="secondary" appearance="muted">
                #{refId}
              </Badge>
            </div>
          </div>

          {/* Stage block · actions — the same two-group cluster
              PropertyDetailHeader ends with, at the same `gap-3`, so a suite's
              controls sit where a broker already expects them. No Add Space (a
              suite has no suites) and no options menu: access is granted per
              space deal and deleting one is the roster's job, so neither of the
              building menu's two items has a space equivalent yet.
              The access cluster leads it, as on the building: the same people,
              resolved from this suite's own broker team rather than the
              building's. No gear — sharing is the building's, and a suite has
              nothing of its own to hand out. */}
          <div className="d-flex align-items-center gap-3 flex-shrink-0">
            <DealHeroAccessAvatars listing={space} manage={false} />
            <div className="d-flex align-items-center gap-2">
              <DealStageSelect listing={space} />
            </div>
            <div className="d-flex align-items-center gap-2">
              <Tooltip>
                <Tooltip.Trigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      // Named on the button, not left to the tooltip: Blueprint's
                      // Tooltip describes a trigger, it does not name it, so an
                      // icon-only pencil reads as an unlabelled button to a
                      // screen reader until hover — which never happens there.
                      aria-label="Edit deal"
                      nativeButton={false}
                      // `dealEditTarget` rather than a literal: a space's edit
                      // page is nested under its building, and this is the same
                      // rule the Voucher's Transaction pencil follows.
                      render={<Link {...dealEditTarget(space)} />}
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </Button>
                  }
                />
                <Tooltip.Content>Edit Deal</Tooltip.Content>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
