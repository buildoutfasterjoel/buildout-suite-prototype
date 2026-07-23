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
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { getListing, getProperty } from "#/data/store";
import { propertyQualifiesForUnderwriting } from "#/components/deals/underwriting/eligibility";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

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
        return (
          <div
            key={group.label ?? `group-${i}`}
            className="d-flex flex-column gap-1 mb-2"
          >
            {group.label && (
              <div className="fw-semibold mt-1">{group.label}</div>
            )}
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
          </div>
        );
      })}
    </nav>
  );
}
