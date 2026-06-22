import { useLocation, useParams, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAddressBook,
  faChartBar,
  faFileLines,
  faGaugeHigh,
  faGlobe,
  faEnvelope,
  faSatelliteDish,
  faGrid,
  faCardsBlank,
  faImage,
  faBullseye,
  faFileInvoiceDollar,
} from "@fortawesome/pro-regular-svg-icons";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Project",
    items: [
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Client Report", href: "client-report", icon: faChartBar },
    ],
  },
  {
    label: "Listing",
    items: [
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Web Activity", href: "web-activity", icon: faGaugeHigh },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Syndication", href: "syndication", icon: faSatelliteDish },
      { label: "Grids", href: "grids", icon: faGrid },
      { label: "Plans", href: "plans", icon: faCardsBlank },
      { label: "Media", href: "media", icon: faImage },
      { label: "Demographics", href: "demographics", icon: faBullseye },
    ],
  },
  {
    label: "Deal",
    items: [{ label: "Deals", href: "deals", icon: faFileInvoiceDollar }],
  },
];

export function PropertyDetailSidebar() {
  const { pathname } = useLocation();
  const { listingId } = useParams({ from: "/listings/$listingId" });
  const navigate = useNavigate();

  function handleTabChange(value: string) {
    const item = NAV_GROUPS.flatMap((g) => g.items).find(
      (i) => i.label === value,
    );
    if (!item) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: `/listings/${listingId}/${item.href}` } as any);
  }

  return (
    <nav className="p-3" aria-label="Property sections">
      {NAV_GROUPS.map((group, i) => {
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
