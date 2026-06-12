import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarFooter,
  NavbarNav,
  NavbarItem,
  NavbarItemLink,
  NavbarItemLinkIcon,
  NavbarItemLinkLabel,
  NavbarToggler,
  NavbarGroup,
  NavbarGroupTrigger,
  NavbarGroupMenu,
  NavbarGroupMenuItem,
} from "@buildoutinc/blueprint-react/ui/Navbar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiamonds4 } from "@fortawesome/pro-regular-svg-icons";
import { faHandshake } from "@fortawesome/pro-regular-svg-icons";
import { faBullhorn } from "@fortawesome/pro-regular-svg-icons";
import { faCalculator } from "@fortawesome/pro-regular-svg-icons";
import { faSignal } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import BuildoutLogo from "#/features/assets/buildout-logo";

type NavDropdownItem = {
  label: string;
  href: string;
};

type NavItem =
  | {
      label: string;
      icon: IconDefinition;
      href: string;
    }
  | {
      label: string;
      icon: IconDefinition;
      items: NavDropdownItem[];
    };

const navItems: NavItem[] = [
  {
    label: "CRM",
    icon: faDiamonds4,
    items: [
      { label: "Properties", href: "/research/properties" },
      { label: "Prospecting", href: "/crm/prospecting" },
      { label: "Tasks", href: "/deals/planner" },
      { label: "Contacts", href: "/backoffice/contacts" },
      { label: "Comps", href: "/research/comps?tab=lease" },
      { label: "Activities", href: "/apex/activities.html" },
    ],
  },
  {
    label: "Deals",
    icon: faHandshake,
    items: [
      { label: "Pipeline", href: "/deals/pipeline" },
      { label: "Broker Earnings", href: "/backoffice/broker_earnings" },
      { label: "Transactions", href: "/deals/transactions" },
    ],
  },
  {
    label: "Showcase",
    icon: faBullhorn,
    items: [
      { label: "Listings", href: "/properties" },
      { label: "Email", href: "/email/messages" },
      { label: "Comps", href: "/comps" },
      { label: "Leads", href: "/leads" },
    ],
  },
  {
    label: "Back Office",
    icon: faCalculator,
    items: [
      { label: "Vouchers", href: "/backoffice/vouchers" },
      { label: "My Receivables", href: "/backoffice/receivables" },
    ],
  },
  {
    label: "Reports",
    icon: faSignal,
    href: "/reports",
  },
];

export default function AppNavbar() {
  return (
    <Navbar expand="lg">
      <NavbarBrand href="/">
        <BuildoutLogo style={{ height: 32 }} />
      </NavbarBrand>
      <NavbarToggler />
      <NavbarContent>
        <NavbarNav>
          {navItems.map((item) =>
            "items" in item ? (
              <NavbarGroup key={item.label}>
                <NavbarGroupTrigger>
                  <NavbarItemLinkIcon>
                    <FontAwesomeIcon icon={item.icon} />
                  </NavbarItemLinkIcon>
                  <NavbarItemLinkLabel>{item.label}</NavbarItemLinkLabel>
                </NavbarGroupTrigger>
                <NavbarGroupMenu>
                  {item.items.map((sub) => (
                    <NavbarGroupMenuItem
                      key={sub.href}
                      render={<a href={sub.href} />}
                    >
                      {sub.label}
                    </NavbarGroupMenuItem>
                  ))}
                </NavbarGroupMenu>
              </NavbarGroup>
            ) : (
              <NavbarItem key={item.label}>
                <NavbarItemLink href={item.href}>
                  <NavbarItemLinkIcon>
                    <FontAwesomeIcon icon={item.icon} />
                  </NavbarItemLinkIcon>
                  <NavbarItemLinkLabel>{item.label}</NavbarItemLinkLabel>
                </NavbarItemLink>
              </NavbarItem>
            ),
          )}
        </NavbarNav>
      </NavbarContent>
      <NavbarFooter>
        <Badge variant="secondary" appearance="accent">
          Prototype
        </Badge>
      </NavbarFooter>
    </Navbar>
  );
}
