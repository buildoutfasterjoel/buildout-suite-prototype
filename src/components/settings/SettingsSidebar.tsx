import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBell,
  faBuilding,
  faBuildings,
  faChevronRight,
  faClipboardCheck,
  faEnvelope,
  faFilter,
  faImages,
  faPuzzlePiece,
  faSignHanging,
  faSitemap,
  faSliders,
  faTowerBroadcast,
  faUsers,
} from "@fortawesome/pro-regular-svg-icons";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label: string; items: NavItem[] };

/** localStorage key for which settings nav groups are collapsed. */
const COLLAPSED_STORAGE_KEY = "settings-sidebar-collapsed-groups";

/**
 * Buildout's company settings are one long flat list today. Grouping them by
 * what an admin is actually trying to change — who we are, who can get in,
 * how deals and data are shaped, how listings go to market — keeps the list
 * scannable and gives Roles & Permissions an obvious home under Users & Access.
 */
export const SETTINGS_NAV: NavGroup[] = [
  {
    label: "Organization",
    items: [
      { label: "Company", href: "company", icon: faBuilding },
      { label: "Offices", href: "offices", icon: faBuildings },
      { label: "Affiliations", href: "affiliations", icon: faSitemap },
    ],
  },
  {
    label: "Users & Access",
    items: [
      { label: "Users", href: "users", icon: faUsers },
      { label: "Notifications", href: "notifications", icon: faBell },
    ],
  },
  {
    label: "Deals & Data",
    items: [
      { label: "Pipeline", href: "pipeline", icon: faFilter },
      { label: "Playbooks", href: "playbooks", icon: faClipboardCheck },
      { label: "Custom Fields", href: "custom-fields", icon: faSliders },
      { label: "Listings", href: "listings", icon: faSignHanging },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Logos", href: "logos", icon: faImages },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Syndication", href: "syndication", icon: faTowerBroadcast },
      { label: "Plugins", href: "plugins", icon: faPuzzlePiece },
    ],
  },
];

/** Section slug for a `/settings/...` pathname, ignoring any deeper segments. */
function sectionHrefFor(pathname: string): string {
  return pathname.split("/settings/")[1]?.split("/")[0] ?? "";
}

export function SettingsSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Starts empty → every group expanded, so SSR and the first client render
  // match; the persisted set is restored in an effect below.
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

  const sectionHref = sectionHrefFor(pathname);

  function handleTabChange(value: string) {
    const item = SETTINGS_NAV.flatMap((g) => g.items).find(
      (i) => i.label === value,
    );
    if (!item) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: `/settings/${item.href}` } as any);
  }

  return (
    <nav className="px-3 py-1" aria-label="Company settings sections">
      {SETTINGS_NAV.map((group) => {
        const activeInGroup =
          group.items.find((item) => item.href === sectionHref)?.label ?? "";
        const isCollapsed = collapsed.has(group.label);
        return (
          <Collapsible
            key={group.label}
            open={!isCollapsed}
            onOpenChange={(open) => setGroupOpen(group.label, open)}
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
            <Collapsible.Content>
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
            </Collapsible.Content>
          </Collapsible>
        );
      })}
    </nav>
  );
}
