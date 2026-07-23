import { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGaugeHigh,
  faAddressBook,
  faBolt,
  faHandshake,
  faFileInvoiceDollar,
  faFileLines,
  faGlobe,
  faEnvelope,
  faImage,
  faTableCells,
  faMapLocationDot,
  faFileChartColumn,
  faVectorSquare,
  faHardDrive,
  faCalculator,
  faUsers,
  faListCheck,
  faClockRotateLeft,
  faRulerCombined,
  faReceipt,
  faNoteSticky,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

/** localStorage key for which sidebar category groups are collapsed. */
const COLLAPSED_STORAGE_KEY = "deal-sidebar-collapsed-groups";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Deal",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      { label: "Contacts", href: "contacts", icon: faUsers },
      { label: "Planner", href: "planner", icon: faListCheck },
      {
        label: "Client Report",
        href: "client-report",
        icon: faFileChartColumn,
      },
      { label: "Activity", href: "activities", icon: faBolt },
      { label: "History", href: "history", icon: faClockRotateLeft },
      { label: "Spaces", href: "spaces", icon: faVectorSquare },
      { label: "Data", href: "files", icon: faHardDrive },
      { label: "Underwriting", href: "underwriting", icon: faCalculator },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faMapLocationDot },
      { label: "Grids", href: "grids", icon: faTableCells },
      { label: "Plans", href: "plans", icon: faRulerCombined },
    ],
  },
  {
    label: "Back Office",
    items: [
      { label: "Transaction", href: "transaction", icon: faHandshake },
      { label: "Financials", href: "financials", icon: faFileInvoiceDollar },
      {
        label: "Financial Docs",
        href: "financial-documents",
        icon: faReceipt,
      },
      { label: "Notes", href: "notes", icon: faNoteSticky },
    ],
  },
];

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

  function toggleGroup(label: string) {
    const next = new Set(collapsed);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    setCollapsed(next);
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...next]));
  }
  // Reactive: re-render when the listing changes (e.g. promoted to an umbrella).
  const version = useDataStore((s) => s.listings);
  void version;
  const listing = getListing(listingId);
  const canAddSpace =
    listing?.dealType === "Lease" && listing?.parentDealId == null;
  const property = listing ? getProperty(listing.propertyId) : undefined;
  const showsUnderwriting =
    listing?.underwriting != null || propertyQualifiesForUnderwriting(property);

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "spaces") return canAddSpace;
      if (item.href === "underwriting") return showsUnderwriting;
      return true;
    }),
  }));

  function handleTabChange(value: string) {
    const item = navGroups
      .flatMap((g) => g.items)
      .find((i) => i.label === value);
    if (!item) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: `/listings/${listingId}/${item.href}` } as any);
  }

  return (
    <nav className="px-3 py-1" aria-label="Property sections">
      {navGroups.map((group, i) => {
        const activeInGroup =
          group.items.find((item) => pathname.endsWith(`/${item.href}`))
            ?.label ?? "";
        const isCollapsed = group.label
          ? collapsed.has(group.label)
          : false;
        return (
          <div
            key={group.label ?? `group-${i}`}
            className="d-flex flex-column gap-1 mb-2"
          >
            {group.label && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                aria-expanded={!isCollapsed}
                className="d-flex align-items-center gap-2 w-100 border-0 bg-transparent p-0 mt-1 fw-semibold text-body"
                style={{ cursor: "pointer" }}
              >
                <FontAwesomeIcon
                  icon={faChevronRight}
                  style={{
                    fontSize: 12,
                    transition: "transform 0.15s ease",
                    transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                  }}
                />
                <span>{group.label}</span>
              </button>
            )}
            {!isCollapsed && (
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
            )}
          </div>
        );
      })}
    </nav>
  );
}
