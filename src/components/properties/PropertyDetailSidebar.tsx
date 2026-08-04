import { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";
import { dealShape, isLeaseParent } from "#/data/dealShape";
import { visibleNavGroups } from "#/components/properties/dealNav";

/** localStorage key for which sidebar category groups are collapsed. */
const COLLAPSED_STORAGE_KEY = "deal-sidebar-collapsed-groups";

export function PropertyDetailSidebar() {
  const { pathname } = useLocation();
  const { listingId } = useParams({ from: "/_shell/listings/$listingId" });
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
  // Reactive: re-render when the listing changes (e.g. promoted to an umbrella).
  const version = useDataStore((s) => s.listings);
  void version;
  const listing = getListing(listingId);
  const property = listing ? getProperty(listing.propertyId) : undefined;
  const showsUnderwriting =
    listing?.underwriting != null || propertyQualifiesForUnderwriting(property);

  const shape = listing ? dealShape(listing) : "sale";
  // Whether this deal has a Spaces tab at all — a top-level lease deal, regardless
  // of stage. Shares one predicate with the tab itself (spaces.tsx): separate
  // from canAddSpaces, which governs only the Add-space buttons, not navigation.
  const leaseParent = isLeaseParent(listing);

  const navGroups = visibleNavGroups(shape, { leaseParent, showsUnderwriting });

  function handleTabChange(value: string) {
    const item = navGroups
      .flatMap((g) => g.items)
      .find((i) => i.label === value);
    if (!item) return;
    void navigate({ to: `/listings/${listingId}/${item.href}` });
  }

  return (
    <nav className="px-3 py-1" aria-label="Property sections">
      {navGroups.map((group, i) => {
        const activeInGroup =
          group.items.find((item) => pathname.endsWith(`/${item.href}`))
            ?.label ?? "";
        const isCollapsed = group.label ? collapsed.has(group.label) : false;
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
