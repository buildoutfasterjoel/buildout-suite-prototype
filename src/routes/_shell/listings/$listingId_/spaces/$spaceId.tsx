import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVectorSquare } from "@fortawesome/pro-regular-svg-icons";
import { getListing, getStore } from "#/data/store";
import { dealBreadcrumbTrail } from "#/components/properties/dealNav";
import { PropertyDetailSidebar } from "#/components/properties/PropertyDetailSidebar";
import { SpaceDetailHeader } from "#/components/deals/SpaceDetailHeader";
import { useSpaceRoute } from "#/components/deals/useSpaceRoute";

/**
 * A space deal's page, nested under its building.
 *
 * The trailing underscore on the `$listingId_` directory keeps the URL
 * (`/listings/{shellId}/spaces/{spaceId}/…`) while un-nesting from
 * `$listingId.tsx`'s layout — so the space paints its own header and sidebar
 * instead of rendering inside the building's frame, which is what sank the
 * reverted panel attempt (`c8a84ca`).
 *
 * `validateSearch` declares the union of what any section reads, because search
 * params are inherited by children rather than declared per section. Today that
 * is only `q`, for Leads — a space has no `listing` section, so the `review` param
 * that route validates has no space equivalent.
 */
export const Route = createFileRoute("/_shell/listings/$listingId_/spaces/$spaceId")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    ...(typeof search.q === "string" && search.q ? { q: search.q } : {}),
  }),
  head: ({ params }) => {
    const space = getStore().listings.get(params.spaceId);
    return {
      meta: [{ title: `${space?.name ?? "Space"} | Buildout Suite` }],
    };
  },
  component: SpaceDetailLayout,
});

function SpaceNotFound({ listingId }: { listingId: string }) {
  return (
    <div className="container py-8 d-flex justify-content-center">
      <Empty>
        <Empty.Media>
          <FontAwesomeIcon icon={faVectorSquare} aria-label="Space not found" />
        </Empty.Media>
        <Empty.Content>
          <Empty.Title>Space not found</Empty.Title>
          This space is not part of this building, or it has been removed.
        </Empty.Content>
        <Empty.Actions>
          <Button
            variant="primary"
            nativeButton={false}
            render={<Link to="/listings/$listingId/spaces" params={{ listingId }} />}
          >
            Back to Spaces
          </Button>
        </Empty.Actions>
      </Empty>
    </div>
  );
}

function SpaceDetailLayout() {
  const { listingId, spaceId } = Route.useParams();
  const { pathname } = useLocation();
  const record = useSpaceRoute(listingId, spaceId);
  const shell = getListing(listingId);

  if (!record || !shell) return <SpaceNotFound listingId={listingId} />;

  // The space's current section is the *third* segment, so the sidebar reads
  // `subsectionLabel`; a building reads `sectionLabel` from the same function.
  const { subsectionLabel } = dealBreadcrumbTrail(pathname, listingId);

  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <SpaceDetailHeader
        space={record.space}
        shell={shell}
        property={record.property}
        label={record.label}
      />

      <div className="container d-flex align-items-start gap-4 py-4">
        <Card
          className="shadow flex-shrink-0 position-sticky"
          style={{ width: 180, top: 0 }}
        >
          <PropertyDetailSidebar
            listing={record.space}
            basePath={`/listings/${listingId}/spaces/${spaceId}`}
            activeLabel={subsectionLabel}
            // `listingId` here is the shell's — the space's route is nested under
            // it — which is exactly the building that owns its marketing.
            buildingLink={{ label: "Building", listingId, name: shell.name }}
          />
        </Card>

        <Card className="flex-grow-1 shadow" style={{ minWidth: 0 }}>
          <Outlet />
        </Card>
      </div>
    </div>
  );
}
