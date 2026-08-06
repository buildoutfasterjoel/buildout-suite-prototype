import { Link, useLocation } from "@tanstack/react-router";
import { Breadcrumb } from "@buildoutinc/blueprint-react/ui/Breadcrumb";
import type { Listing, Property } from "#/data/types";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
import { DealStageSelect } from "#/components/deals/DealStageSelect";

/**
 * The space page's own header. Deliberately not `PropertyDetailHeader`, which is
 * built around a building's address, publish state, photo and property facts —
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

  return (
    <div className="bg-card border-bottom">
      <div className="container p-4">
        <Breadcrumb className="mb-2">
          <Breadcrumb.Item>
            <Breadcrumb.Link render={<Link to="/listings" />}>All Deals</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Breadcrumb.Link
              render={<Link to="/listings/$listingId" params={{ listingId: shell.id }} />}
            >
              {shell.name}
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Breadcrumb.Link
              render={
                <Link to="/listings/$listingId/spaces" params={{ listingId: shell.id }} />
              }
            >
              Spaces
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          {subsectionLabel ? (
            <>
              <Breadcrumb.Item>
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
              </Breadcrumb.Item>
              <Breadcrumb.Item>{subsectionLabel}</Breadcrumb.Item>
            </>
          ) : (
            <Breadcrumb.Item>{label}</Breadcrumb.Item>
          )}
        </Breadcrumb>

        <div className="d-flex align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fs-5 fw-semibold mb-0">{label}</h1>
            <div className="text-muted">
              {property.street}, {property.city}, {property.state} {property.zip}
            </div>
          </div>
          <DealStageSelect listing={space} />
        </div>
      </div>
    </div>
  );
}
