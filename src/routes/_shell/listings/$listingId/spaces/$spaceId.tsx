import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { useDataStore } from "#/data/dataStore";
import { getProperty } from "#/data/store";
import { dealShape } from "#/data/dealShape";
import { DealStageChip } from "#/components/deals/DealStageChip";
import { requestStageChange } from "#/components/deals/useStageGate";
import type { ListingStage } from "#/data/types";
import {
  SPACE_PANEL_TABS,
  DEFAULT_SPACE_PANEL_LEAF,
  leafFromPathname,
  tabForLeaf,
  type SpacePanelLeaf,
} from "#/components/deals/spacePanelTabs";

export const Route = createFileRoute(
  "/_shell/listings/$listingId/spaces/$spaceId",
)({
  component: SpacePanelRoute,
});

/**
 * A suite, rendered as a panel over its building. The route's presence *is* the
 * open state — closing navigates back to the roster — so a deep link and a click
 * arrive at exactly the same UI, and the building behind never unmounts.
 */
function SpacePanelRoute() {
  const { listingId, spaceId } = Route.useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // Subscribe to the map, not `.get(spaceId)`: a suite's shape and its siblings are
  // derived from other listings (see 413dda8).
  const listings = useDataStore((s) => s.listings);
  const listing = listings.get(spaceId);
  const property = listing ? getProperty(listing.propertyId) : undefined;

  if (!listing || !property) return null;

  const unit = property.units.find((u) => u.id === listing.unitId);
  const activeLeaf = leafFromPathname(pathname) ?? DEFAULT_SPACE_PANEL_LEAF;
  const activeTab = tabForLeaf(activeLeaf);
  const pills =
    SPACE_PANEL_TABS.find((t) => t.id === activeTab)?.leaves ?? [];

  const goToLeaf = (leaf: SpacePanelLeaf) => {
    void navigate({
      to: `/listings/${listingId}/spaces/${spaceId}/${leaf}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  };

  const close = () =>
    void navigate({
      to: "/listings/$listingId/spaces",
      params: { listingId },
    });

  return (
    <Offcanvas open onOpenChange={(next) => !next && close()}>
      <Offcanvas.Content
        side="right"
        className="suite-panel"
        style={{ width: "min(78vw, 1100px)" }}
      >
        <Offcanvas.Header>
          <Offcanvas.Title>{unit?.label ?? listing.name}</Offcanvas.Title>
          <DealStageChip
            value={listing.status}
            shape={dealShape(listing)}
            onChange={(v) => requestStageChange(listing.id, v as ListingStage)}
          />
        </Offcanvas.Header>

        <Offcanvas.Body className="d-flex flex-column gap-3">
          {/* Major sections */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const tab = SPACE_PANEL_TABS.find((t) => t.id === v);
              if (tab) goToLeaf(tab.leaves[0].leaf);
            }}
          >
            <Tabs.List>
              {SPACE_PANEL_TABS.map((t) => (
                <Tabs.Tab key={t.id} value={t.id}>
                  {t.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          {/* Sub-sections. Rendered only when the active tab subdivides, so the
              Terms tab shows no redundant single pill. */}
          {pills.length > 1 && (
            <Tabs value={activeLeaf} onValueChange={(v) => goToLeaf(v as SpacePanelLeaf)}>
              <Tabs.List variant="pills">
                {pills.map((p) => (
                  <Tabs.Tab key={p.leaf} value={p.leaf}>
                    {p.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          )}

          <Outlet />
        </Offcanvas.Body>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
