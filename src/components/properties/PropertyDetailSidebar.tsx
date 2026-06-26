import { useLocation, useParams, useNavigate } from "@tanstack/react-router";
import { Tabs } from "@buildoutinc/blueprint-react/ui/Tabs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faGaugeHigh,
  faAddressBook,
  faListCheck,
  faUsers,
  faBolt,
  faClockRotateLeft,
  faHandshake,
  faFileInvoiceDollar,
  faFileLines,
  faGlobe,
  faEnvelope,
  faImage,
} from "@fortawesome/pro-regular-svg-icons";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Project",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      { label: "Leads", href: "leads", icon: faAddressBook },
      { label: "Tasks", href: "tasks", icon: faListCheck },
      { label: "Contacts", href: "contacts", icon: faUsers },
      { label: "Activities", href: "activities", icon: faBolt },
      { label: "History", href: "history", icon: faClockRotateLeft },
    ],
  },
  {
    label: "Deal",
    items: [
      { label: "Transaction", href: "transaction", icon: faHandshake },
      { label: "Voucher", href: "voucher", icon: faFileInvoiceDollar },
    ],
  },
  {
    label: "Listing",
    items: [
      { label: "Documents", href: "documents", icon: faFileLines },
      { label: "Website", href: "website", icon: faGlobe },
      { label: "Email", href: "email", icon: faEnvelope },
      { label: "Media", href: "media", icon: faImage },
    ],
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
