import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faUsers,
  faHandshake,
  faSignal,
  faBell,
  faCirclePlus,
} from "@fortawesome/pro-regular-svg-icons";
import { faDiamonds4 } from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import BuildoutIcon from "#/features/assets/buildout-icon";
import BuildoutWordmark from "#/features/assets/buildout-wordmark";

type Role = "principal" | "broker" | "marketing";

type NavDropdownItem = {
  label: string;
  href: string;
};

type NavContext = {
  label: string;
  icon: IconDefinition;
  allowedRoles: Role[];
} & ({ href: string } | { items: NavDropdownItem[] });

const ALL_ROLES: Role[] = ["principal", "broker", "marketing"];

const navContexts: NavContext[] = [
  {
    label: "Brokerage",
    icon: faDiamonds4,
    allowedRoles: ["principal"],
    items: [
      { label: "Dashboard", href: "/suite" },
      { label: "Team", href: "#" },
      { label: "Revenue", href: "#" },
    ],
  },
  {
    label: "Properties",
    icon: faBuilding,
    allowedRoles: ALL_ROLES,
    items: [
      { label: "Research", href: "/research/properties" },
      { label: "Prospecting", href: "/crm/prospecting" },
      { label: "Listings", href: "/listings" },
      { label: "Comps", href: "/research/comps" },
    ],
  },
  {
    label: "Contacts",
    icon: faUsers,
    allowedRoles: ALL_ROLES,
    items: [
      { label: "Leads", href: "/leads" },
      { label: "People", href: "/backoffice/contacts" },
      { label: "Companies", href: "#" },
      { label: "Lists", href: "#" },
      { label: "Sequences", href: "#" },
      { label: "Campaigns", href: "/email" },
    ],
  },
  {
    label: "Deals",
    icon: faHandshake,
    allowedRoles: ["principal", "broker"],
    items: [
      { label: "Transactions", href: "/deals/transactions" },
      { label: "Tasks", href: "/deals/planner" },
      { label: "Commissions", href: "/backoffice/broker_earnings" },
    ],
  },
  {
    label: "Reports",
    icon: faSignal,
    allowedRoles: ALL_ROLES,
    href: "/reports",
  },
];

const ROLE_LABELS: Record<Role, string> = {
  principal: "Principal",
  broker: "Broker",
  marketing: "Marketing",
};

function isPathActive(href: string, pathname: string): boolean {
  if (!href || href === "#") return false;
  return pathname === href || pathname.startsWith(href + "/");
}

function isContextActive(ctx: NavContext, pathname: string): boolean {
  if ("href" in ctx) return isPathActive(ctx.href, pathname);
  return ctx.items.some((item) => isPathActive(item.href, pathname));
}

export function GlobalNavbar() {
  const { pathname } = useLocation();
  const [role, setRole] = useState<Role>(
    () =>
      (typeof window !== "undefined"
        ? (localStorage.getItem("dev_role") as Role)
        : null) ?? "principal",
  );

  function handleRoleChange(newRole: Role) {
    if (typeof window !== "undefined") {
      localStorage.setItem("dev_role", newRole);
    }
    setRole(newRole);
  }

  const visibleContexts = navContexts.filter((ctx) =>
    ctx.allowedRoles.includes(role),
  );

  return (
    <Navbar expand="lg">
      <Navbar.Brand
        href="/suite"
        aria-label="Buildout"
        className="d-inline-flex align-items-center gap-2"
      >
        <BuildoutIcon style={{ height: 24, width: 24 }} />
        <BuildoutWordmark style={{ height: 24 }} />
      </Navbar.Brand>

      <Navbar.Toggler />

      <Navbar.Content className="flex-nowrap">
        <Navbar.Nav>
          {visibleContexts.map((ctx) =>
            "items" in ctx ? (
              <Navbar.Group key={ctx.label}>
                <Navbar.GroupTrigger
                  className={
                    isContextActive(ctx, pathname) ? "active" : undefined
                  }
                >
                  <Navbar.ItemLinkIcon>
                    <FontAwesomeIcon icon={ctx.icon} />
                  </Navbar.ItemLinkIcon>
                  <Navbar.ItemLinkLabel>{ctx.label}</Navbar.ItemLinkLabel>
                </Navbar.GroupTrigger>
                <Navbar.GroupMenu>
                  {ctx.items.map((sub) => (
                    <Navbar.GroupMenuItem
                      key={sub.label}
                      render={<a href={sub.href} />}
                      className={
                        isPathActive(sub.href, pathname) ? "active" : undefined
                      }
                    >
                      {sub.label}
                    </Navbar.GroupMenuItem>
                  ))}
                </Navbar.GroupMenu>
              </Navbar.Group>
            ) : (
              <Navbar.Item key={ctx.label}>
                <Navbar.ItemLink
                  isActive={isContextActive(ctx, pathname)}
                  render={<a href={ctx.href} />}
                >
                  <Navbar.ItemLinkIcon>
                    <FontAwesomeIcon icon={ctx.icon} />
                  </Navbar.ItemLinkIcon>
                  <Navbar.ItemLinkLabel>{ctx.label}</Navbar.ItemLinkLabel>
                </Navbar.ItemLink>
              </Navbar.Item>
            ),
          )}
        </Navbar.Nav>
      </Navbar.Content>

      <Navbar.Footer className="flex-grow-0 flex-shrink-0 d-flex align-items-center">
        <Navbar.Nav>
          {/* New action menu */}
          <Navbar.Group>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Navbar.GroupTrigger aria-label="New">
                    <Navbar.ItemLinkIcon>
                      <FontAwesomeIcon icon={faCirclePlus} />
                    </Navbar.ItemLinkIcon>
                  </Navbar.GroupTrigger>
                }
              />
              <Tooltip.Content>New</Tooltip.Content>
            </Tooltip>
            <Navbar.GroupMenu>
              <Navbar.GroupMenuItem onClick={() => console.log("new activity")}>
                New Activity
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem onClick={() => console.log("new task")}>
                New Task
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem onClick={() => console.log("new note")}>
                New Note
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem onClick={() => console.log("new contact")}>
                New Contact
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem onClick={() => console.log("new deal")}>
                New Deal
              </Navbar.GroupMenuItem>
            </Navbar.GroupMenu>
          </Navbar.Group>

          {/* Notifications */}
          <Navbar.Item>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Navbar.ItemLink
                    aria-label="Notifications"
                    render={<a href="#" />}
                  >
                    <Navbar.ItemLinkIcon className="position-relative">
                      <FontAwesomeIcon icon={faBell} />
                      <Badge
                        variant="primary"
                        className="position-absolute top-0 start-100 translate-middle"
                      >
                        3
                      </Badge>
                    </Navbar.ItemLinkIcon>
                  </Navbar.ItemLink>
                }
              />
              <Tooltip.Content>Notifications</Tooltip.Content>
            </Tooltip>
          </Navbar.Item>
        </Navbar.Nav>
        {/* User profile */}
        <Navbar.Nav>
          <Navbar.Group>
            <Navbar.GroupTrigger>
              <Navbar.ItemLinkIcon>
                <Avatar size="sm">
                  <Avatar.Fallback>E</Avatar.Fallback>
                </Avatar>
              </Navbar.ItemLinkIcon>
              <Navbar.ItemLinkLabel>
                <span className="d-inline-flex flex-column">
                  <span className="fw-semibold">Ethan Thompson</span>
                  <span className="fs-xs">{ROLE_LABELS[role]}</span>
                </span>
              </Navbar.ItemLinkLabel>
            </Navbar.GroupTrigger>
            <Navbar.GroupMenu>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                <Navbar.GroupMenuItem
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  className={r === role ? "active" : undefined}
                >
                  {ROLE_LABELS[r]}
                </Navbar.GroupMenuItem>
              ))}
            </Navbar.GroupMenu>
          </Navbar.Group>
        </Navbar.Nav>
      </Navbar.Footer>
    </Navbar>
  );
}
