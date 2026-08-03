import { useEffect } from "react";
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
import { DealStageSelect } from "#/components/deals/DealStageSelect";
import { suitePanelPath } from "#/data/suitePanelPath";
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

  // The `listingId` segment declares which building this panel is scoped to — the
  // header, breadcrumb, and Back Office guards all key off it. A suite whose real
  // parent differs (or a listing that isn't a suite at all, i.e. has no
  // `parentDealId`) must never render under it: that would paint this suite's
  // voucher/commission/etc. over the wrong building's frame. If the suite has
  // simply been reparented, send it to where it actually lives instead of just
  // going blank; `suitePanelPath` returns null for a non-suite listing, so that
  // case falls through to the plain "render nothing" guard below.
  const belongsHere = !!listing && listing.parentDealId === listingId;
  const correctPath =
    listing && !belongsHere
      ? suitePanelPath(listing, leafFromPathname(pathname))
      : null;

  useEffect(() => {
    if (correctPath && correctPath !== pathname) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void navigate({ to: correctPath, replace: true } as any);
    }
  }, [correctPath, pathname, navigate]);

  if (!listing || !property || !belongsHere) return null;

  const unit = property.units.find((u) => u.id === listing.unitId);
  const activeLeaf = leafFromPathname(pathname) ?? DEFAULT_SPACE_PANEL_LEAF;
  const activeTab = tabForLeaf(activeLeaf);
  const pills =
    SPACE_PANEL_TABS.find((t) => t.id === activeTab)?.leaves ?? [];

  // Tab/pill clicks replace the current history entry rather than pushing: they
  // move between sections of the same panel, not to a new place, so Back should
  // still close the panel in one step instead of walking every section visited.
  // The deep-link entry that opened the panel (see the route's own navigate, and
  // the canonicalizing redirect in $listingId.tsx) stays a normal push, so Back
  // from a freshly-opened panel closes it.
  const goToLeaf = (leaf: SpacePanelLeaf) => {
    void navigate({
      to: `/listings/${listingId}/spaces/${spaceId}/${leaf}`,
      replace: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  };

  // A normal push, deliberately: clicking close is a forward action the user chose
  // (mirroring the push that opened the panel), not the Back button itself — that
  // case is handled above by making in-panel tab/pill moves replace instead of
  // push. Leaving this as a push means Back after an explicit close returns to the
  // last tab viewed (symmetric with how opening/closing already behave elsewhere),
  // rather than skipping the panel out of history entirely.
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
          {/* Blueprint's theme sets `.offcanvas-header` to `flex-direction: column`,
              so header children stack by default. This row puts the stage control
              opposite the title instead. The header already reserves inline-end
              padding for its own absolutely-positioned close button, so `w-100`
              stops short of it rather than colliding. */}
          <div className="d-flex align-items-center justify-content-between gap-3 w-100">
            <Offcanvas.Title
              className="text-truncate"
              style={{ minWidth: 0 }}
              title={unit?.label ?? listing.name}
            >
              {unit?.label ?? listing.name}
            </Offcanvas.Title>
            <DealStageSelect listing={listing} />
          </div>
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
