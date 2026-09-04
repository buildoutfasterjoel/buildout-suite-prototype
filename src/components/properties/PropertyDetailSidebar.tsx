import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUpRight,
  faBuilding,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import { getProperty } from "#/data/store";
import type { Listing } from "#/data/types";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";
import { dealShape, isLeaseParent } from "#/data/dealShape";
import { visibleNavGroups } from "#/components/properties/dealNav";
import { useDealAccess } from "#/components/deals/useDealAccess";

/** localStorage key for which sidebar category groups are collapsed. */
const COLLAPSED_STORAGE_KEY = "deal-sidebar-collapsed-groups";

export function PropertyDetailSidebar({
  listing,
  basePath,
  activeLabel,
  buildingLink,
}: {
  /** The record whose sections these are — a building or a space. */
  listing: Listing;
  /**
   * URL prefix each item's href is appended to, no trailing slash. A building
   * passes `/listings/{id}`; a space passes
   * `/listings/{shellId}/spaces/{spaceId}`. Taken as a prop because this
   * component renders under two different routes, and the route id a
   * `useParams({ from })` would need differs between them.
   */
  basePath: string;
  /**
   * Which item is current, by label. Derived by the caller: a building reads
   * `sectionLabel` off the path, a space reads `subsectionLabel`, and this
   * component cannot tell which it is rendering for.
   */
  activeLabel: string | null;
  /**
   * The building that owns this record's marketing sections, when there is one.
   *
   * A space passes its shell here and this renders a link out to the building's
   * Documents at the foot of the Marketing group. The building owns the sections
   * in `BUILDING_OWNED_HREFS`, which `visibleNavGroups` hides for a space — so
   * the suite points at them rather than holding a second, divergent copy.
   *
   * Takes the shell's id rather than a URL so the `Link` target stays a typed
   * route literal; `basePath` above is an interpolated string only because
   * `navigate({ to })` accepts one and `Link`'s `to` does not.
   *
   * `name` is the building's own name, used in the row's tooltip so the warning
   * that you are leaving the suite can say where you land. Separate from `label`
   * because the row itself reads "Building" — the 180px sidebar cannot fit a
   * property name.
   *
   * Omitted by a building, which has no parent to point at.
   */
  buildingLink?: { label: string; listingId: string; name: string };
}) {
  const navigate = useNavigate();
  // Collapsed category labels. Starts empty → all groups expanded, so SSR and
  // the first client render match; the persisted set is restored in an effect
  // on mount (below), avoiding a hydration mismatch.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!stored) return;
    try {
      const labels = JSON.parse(stored);
      if (Array.isArray(labels)) setCollapsed(new Set(labels));
    } catch {
      // Ignore a malformed stored value; fall back to all-expanded.
    }
  }, []);

  function setGroupOpen(label: string, open: boolean) {
    const next = new Set(collapsed);
    if (open) next.delete(label);
    else next.add(label);
    setCollapsed(next);
    window.localStorage.setItem(
      COLLAPSED_STORAGE_KEY,
      JSON.stringify([...next]),
    );
  }
  const property = getProperty(listing.propertyId);
  const showsUnderwriting =
    listing.underwriting != null || propertyQualifiesForUnderwriting(property);

  const shape = dealShape(listing);
  // Whether this deal has a Spaces tab at all — a top-level lease deal, regardless
  // of stage. Shares one predicate with the tab itself (spaces.tsx): separate
  // from canAddSpaces, which governs only the Add-space buttons, not navigation.
  const leaseParent = isLeaseParent(listing);

  // Each half of the deal is shown only to someone entitled to it: a marketing
  // share hides the money, and the back office reaching a deal through
  // `view-other-vouchers` gets the voucher and no marketing. The deal team
  // resolves to both, so this is a no-op for them.
  const access = useDealAccess(listing);

  const navGroups = visibleNavGroups(shape, {
    leaseParent,
    showsUnderwriting,
    isClassic: listing.isClassic,
    showsMarketing: access.marketing !== "none",
    showsBackOffice: access.backOffice !== "none",
  });

  function handleTabChange(value: string) {
    const item = navGroups
      .flatMap((g) => g.items)
      .find((i) => i.label === value);
    if (!item) return;
    void navigate({ to: `${basePath}/${item.href}` });
  }

  return (
    <nav className="px-3 py-1" aria-label="Property sections">
      {navGroups.map((group, i) => {
        const activeInGroup =
          group.items.find((item) => item.label === activeLabel)?.label ?? "";
        const isCollapsed = group.label ? collapsed.has(group.label) : false;
        // The link out sits as the last row of the tab list whose sections it
        // replaces, so it reads as one continuous list rather than something
        // stranded beneath it. Matched by label because Marketing is the group
        // whose items `BUILDING_OWNED_HREFS` removes.
        //
        // A `Link`, not a `Tabs.Tab`: the enclosing `Tabs` keys `value` off the
        // active item's *label*, and an item that targets a different record can
        // never match it — as a Tab it would sit in the value space permanently
        // inactive, and `handleTabChange` would not find it in `navGroups` at all.
        //
        // It mirrors `Tabs.Tab`'s internal markup (`nav-link` > `nav-link-icon` +
        // `nav-link-text`) so it lines up with the pills above it. Note the theme's
        // `.nav-link` is already `display: flex` with its own `gap` and a
        // fixed-width icon slot, so it must NOT also carry `d-flex gap-*` — that
        // doubles the gap and fights the icon column. The trailing arrow gets
        // `ms-auto` instead of a flex-grow spacer.
        // The tooltip carries what the row cannot: that following it leaves the
        // suite, and where it lands. `Tooltip.Provider` is mounted app-wide in
        // `__root.tsx`, so there is none here. `Tooltip.Root` renders no DOM and
        // `Trigger`'s `render` prop reuses the `Link` itself rather than wrapping
        // it, which is what keeps the row aligned with the pills above it.
        const linkRow =
          buildingLink && group.label === "Marketing" ? (
            <Tooltip key="building-link">
              <Tooltip.Trigger
                render={
                  <Link
                    to="/listings/$listingId/documents"
                    params={{ listingId: buildingLink.listingId }}
                    className="nav-link text-decoration-none"
                  >
                    <span className="nav-link-icon">
                      <FontAwesomeIcon icon={faBuilding} />
                    </span>
                    <span className="nav-link-text">{buildingLink.label}</span>
                    <FontAwesomeIcon
                      icon={faArrowUpRight}
                      className="ms-auto"
                      style={{ fontSize: 12 }}
                    />
                  </Link>
                }
              />
              <Tooltip.Content side="right">
                Marketing settings and documents are at the parent level.
              </Tooltip.Content>
            </Tooltip>
          ) : null;
        const tabs = (
          <Tabs
            value={activeInGroup}
            onValueChange={handleTabChange}
            orientation="vertical"
          >
            <Tabs.List variant="pills" orientation="vertical">
              {group.items.map((item) => (
                <Tabs.Tab
                  key={item.label}
                  value={item.label}
                  icon={<FontAwesomeIcon icon={item.icon} />}
                >
                  {item.label}
                </Tabs.Tab>
              ))}
              {linkRow}
            </Tabs.List>
          </Tabs>
        );
        // Groups without a label (none today) are not collapsible.
        if (!group.label) {
          return (
            <div key={`group-${i}`} className="d-flex flex-column gap-1 mb-2">
              {tabs}
            </div>
          );
        }
        return (
          <Collapsible
            key={group.label}
            open={!isCollapsed}
            onOpenChange={(open) => setGroupOpen(group.label!, open)}
            className="d-flex flex-column gap-1 mb-2"
          >
            <Collapsible.Trigger className="d-flex align-items-center gap-2 w-100 border-0 bg-transparent p-0 mt-1 fw-semibold text-body">
              <FontAwesomeIcon
                icon={faChevronRight}
                style={{
                  fontSize: 12,
                  transition: "transform 0.15s ease",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                }}
              />
              <span>{group.label}</span>
            </Collapsible.Trigger>
            <Collapsible.Content>{tabs}</Collapsible.Content>
          </Collapsible>
        );
      })}
    </nav>
  );
}
