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
  faFileInvoice,
  faMoneyCheckDollar,
} from "@fortawesome/pro-regular-svg-icons";

type NavItem = { label: string; href: string; icon: IconDefinition };
type NavGroup = { label?: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Project",
    items: [
      { label: "Overview", href: "overview", icon: faGaugeHigh },
      { label: "Activity", href: "activities", icon: faBolt },
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
    ],
  },
  {
    label: "Back Office",
    items: [
      { label: "Transaction", href: "transaction", icon: faHandshake },
      { label: "Financials", href: "financials", icon: faFileInvoiceDollar },
      { label: "Invoices", href: "invoices", icon: faFileInvoice },
      { label: "Deposits", href: "deposits", icon: faMoneyCheckDollar },
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
    <nav className="px-3 py-1" aria-label="Property sections">
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
