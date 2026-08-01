import { useEffect, useState } from "react";
import {
  useLocation,
  useParams,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGaugeHigh,
  faAddressBook,
  faBolt,
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
  faClockRotateLeft,
  faRulerCombined,
  faReceipt,
  faNoteSticky,
  faChevronRight,
  faBuildingFlag,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";
import { dealShape, isLeaseParent } from "#/data/dealShape";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

/** localStorage key for which sidebar category groups are collapsed. */
const COLLAPSED_STORAGE_KEY = "deal-sidebar-collapsed-groups";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Deal",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      {
        label: "Client Report",
        href: "client-report",
        icon: faFileChartColumn,
      },
      { label: "Activity", href: "activities", icon: faBolt },
      { label: "History", href: "history", icon: faClockRotateLeft },
      { label: "Spaces", href: "spaces", icon: faVectorSquare },
      { label: "Files", href: "files", icon: faHardDrive },
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
      {
        label: "Property Marketing",
        href: "property-marketing",
        icon: faBuildingFlag,
      },
    ],
  },
  {
    label: "Back Office",
    items: [
      { label: "Voucher", href: "financials", icon: faFileInvoiceDollar },
      {
        label: "Invoices",
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
  // Loose read: most routes under this layout declare no `from` param at all,
  // so this can't be typed against a single route's search schema.
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const from = typeof rawSearch.from === "string" ? rawSearch.from : undefined;
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

  /** Property-level marketing surfaces — a space deal has none of these. */
  const PROPERTY_ONLY = new Set([
    "documents", "website", "email", "demographics", "grids", "plans",
  ]);
  /** Surfaces that only make sense on the building's own assignment. */
  const SHELL_ONLY = new Set(["spaces", "underwriting", "client-report"]);

  const navGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "property-marketing") return shape === "space";
      if (shape === "space") {
        if (PROPERTY_ONLY.has(item.href)) return false;
        if (SHELL_ONLY.has(item.href)) return false;
        return true;
      }
      // Money is earned per space, so a shell has no voucher and no invoices.
      if (shape === "shell" && (item.href === "financials" || item.href === "financial-documents")) {
        return false;
      }
      if (item.href === "spaces") return leaseParent;
      if (item.href === "underwriting") return showsUnderwriting;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  function handleTabChange(value: string) {
    const item = navGroups
      .flatMap((g) => g.items)
      .find((i) => i.label === value);
    if (!item) return;
    // Carry `from` (the space that sent the broker here) across hops within
    // the Marketing group, so the return bar survives Documents -> Website;
    // drop it the moment the broker leaves that group for anything else.
    const inMarketing = navGroups
      .find((g) => g.label === "Marketing")
      ?.items.some((i) => i.href === item.href);
    void navigate({
      to: `/listings/${listingId}/${item.href}`,
      search: inMarketing && from ? { from } : {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
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
