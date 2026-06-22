import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faObjectsColumn,
  faCubes,
  faSquareCheck,
  faBolt,
  faAddressBook,
  faChartBar,
  faPaperclip,
  faFileLines,
  faGaugeHigh,
  faGlobe,
  faEnvelope,
  faSatelliteDish,
  faGrid,
  faCardsBlank,
  faImage,
  faBullseye,
  faSquarePollVertical,
  faSignsPost,
  faFileInvoiceDollar,
  faMoneyBill,
  faBuilding,
} from "@fortawesome/pro-regular-svg-icons";

type NavItem = { label: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { items: [{ label: "Dashboard", icon: faObjectsColumn }] },
  {
    label: "Project",
    items: [
      { label: "Overview", icon: faCubes },
      { label: "Tasks", icon: faSquareCheck },
      { label: "Activities", icon: faBolt },
      { label: "Leads", icon: faAddressBook },
      { label: "Client Report", icon: faChartBar },
      { label: "Attachments", icon: faPaperclip },
    ],
  },
  {
    label: "Listing",
    items: [
      { label: "Documents", icon: faFileLines },
      { label: "Web Activity", icon: faGaugeHigh },
      { label: "Website", icon: faGlobe },
      { label: "Email", icon: faEnvelope },
      { label: "Syndication", icon: faSatelliteDish },
      { label: "Grids", icon: faGrid },
      { label: "Plans", icon: faCardsBlank },
      { label: "Media", icon: faImage },
      { label: "Demographics", icon: faBullseye },
      { label: "Area Analytics", icon: faSquarePollVertical },
      { label: "Signs", icon: faSignsPost },
    ],
  },
  {
    label: "Deals",
    items: [
      { label: "Deals", icon: faFileInvoiceDollar },
      { label: "Royalties", icon: faMoneyBill },
    ],
  },
  {
    label: "Data",
    items: [{ label: "Property", icon: faBuilding }],
  },
];

/**
 * Grouped pill navigation for the property detail page. A single vertical Tabs
 * context drives the active state (defaults to "Dashboard"); each Figma group is
 * its own pills track with a section label above it. Visual prototype only.
 */
export function PropertyDetailSidebar() {
  return (
    <nav
      className="flex-shrink-0 border-end p-3 overflow-auto"
      style={{ width: 220 }}
      aria-label="Property sections"
    >
      <Tabs defaultValue="Dashboard" orientation="vertical">
        {NAV_GROUPS.map((group, i) => (
          <div
            key={group.label ?? `group-${i}`}
            className="d-flex flex-column gap-1 mb-2"
          >
            {group.label && (
              <div className="fw-semibold mt-1">{group.label}</div>
            )}
            <Tabs.List variant="pills" orientation="vertical">
              {group.items.map((item) => (
                <Tabs.Tab
                  key={item.label}
                  value={item.label}
                  icon={<FontAwesomeIcon icon={item.icon} fixedWidth />}
                >
                  {item.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </div>
        ))}
      </Tabs>
    </nav>
  );
}
