import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sidebar } from "@buildoutinc/blueprint-react/ui/Sidebar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faUsers,
  faHandshake,
  faSignal,
  faMagnifyingGlass,
  faBell,
  faUserGear,
  faCirclePlus,
} from "@fortawesome/pro-regular-svg-icons";
import { faAngleRight, faDiamonds4 } from "@fortawesome/pro-solid-svg-icons";
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
      { label: "Campaigns", href: "/email/messages" },
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

export function GlobalSidebar() {
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
    <Sidebar>
      <Sidebar.Header>
        <Sidebar.MenuLink
          aria-label="Buildout"
          render={
            <a href="/suite">
              <Sidebar.MenuLinkIcon className="p-0">
                <BuildoutIcon style={{ height: 24, width: 24 }} />
              </Sidebar.MenuLinkIcon>
              <Sidebar.MenuLinkLabel>
                <BuildoutWordmark style={{ height: 24 }} />
              </Sidebar.MenuLinkLabel>
            </a>
          }
        />
      </Sidebar.Header>

      <Sidebar.Content>
        <Sidebar.Menu>
          {visibleContexts.map((ctx) =>
            "items" in ctx ? (
              <Sidebar.MenuItem key={ctx.label}>
                <Sidebar.Group defaultOpen={isContextActive(ctx, pathname)}>
                  <Sidebar.GroupTrigger
                    className={
                      isContextActive(ctx, pathname) ? "active" : undefined
                    }
                  >
                    <Sidebar.MenuLinkIcon>
                      <FontAwesomeIcon icon={ctx.icon} />
                    </Sidebar.MenuLinkIcon>
                    <Sidebar.MenuLinkLabel>{ctx.label}</Sidebar.MenuLinkLabel>
                  </Sidebar.GroupTrigger>
                  <Sidebar.GroupContent>
                    {ctx.items.map((sub) => (
                      <Sidebar.GroupItem
                        key={sub.label}
                        render={<a href={sub.href} />}
                        isActive={isPathActive(sub.href, pathname)}
                      >
                        {sub.label}
                      </Sidebar.GroupItem>
                    ))}
                  </Sidebar.GroupContent>
                </Sidebar.Group>
              </Sidebar.MenuItem>
            ) : (
              <Sidebar.MenuItem key={ctx.label}>
                <Sidebar.MenuLink
                  isActive={isContextActive(ctx, pathname)}
                  render={
                    <a href={ctx.href}>
                      <Sidebar.MenuLinkIcon>
                        <FontAwesomeIcon icon={ctx.icon} />
                      </Sidebar.MenuLinkIcon>
                      <Sidebar.MenuLinkLabel>{ctx.label}</Sidebar.MenuLinkLabel>
                    </a>
                  }
                />
              </Sidebar.MenuItem>
            ),
          )}
        </Sidebar.Menu>

        <Sidebar.Menu className="flex-grow-0">
          <Sidebar.MenuItem>
            <Sidebar.Dropdown>
              <Sidebar.DropdownTrigger>
                <Sidebar.MenuLinkIcon>
                  <FontAwesomeIcon icon={faCirclePlus} />
                </Sidebar.MenuLinkIcon>
                <Sidebar.MenuLinkLabel>New</Sidebar.MenuLinkLabel>
                <Sidebar.MenuLinkIcon>
                  <FontAwesomeIcon icon={faAngleRight} />
                </Sidebar.MenuLinkIcon>
              </Sidebar.DropdownTrigger>
              <Sidebar.DropdownMenu>
                <Sidebar.DropdownMenuItem
                  onClick={() => console.log("new activity")}
                >
                  New Activity
                </Sidebar.DropdownMenuItem>
                <Sidebar.DropdownMenuItem
                  onClick={() => console.log("new task")}
                >
                  New Task
                </Sidebar.DropdownMenuItem>
                <Sidebar.DropdownMenuItem
                  onClick={() => console.log("new note")}
                >
                  New Note
                </Sidebar.DropdownMenuItem>
                <Sidebar.DropdownMenuItem
                  onClick={() => console.log("new contact")}
                >
                  New Contact
                </Sidebar.DropdownMenuItem>
                <Sidebar.DropdownMenuItem
                  onClick={() => console.log("new deal")}
                >
                  New Deal
                </Sidebar.DropdownMenuItem>
              </Sidebar.DropdownMenu>
            </Sidebar.Dropdown>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
        <Sidebar.Menu className="flex-grow-0">
          <Sidebar.MenuItem>
            <Sidebar.MenuLink
              render={
                <a href="#">
                  <Sidebar.MenuLinkIcon className="position-relative">
                    <FontAwesomeIcon icon={faBell} />
                    <Badge
                      variant="primary"
                      className="position-absolute top-0 start-100 translate-middle"
                    >
                      3
                    </Badge>
                  </Sidebar.MenuLinkIcon>
                  <Sidebar.MenuLinkLabel>Notifications</Sidebar.MenuLinkLabel>
                </a>
              }
            />
          </Sidebar.MenuItem>

          {/* Dev-only role switcher */}
          <Sidebar.MenuItem className="flex-grow-0">
            <Sidebar.Dropdown>
              <Sidebar.DropdownTrigger aria-label="Dev role switcher">
                <Sidebar.MenuLinkIcon>
                  <FontAwesomeIcon icon={faUserGear} />
                </Sidebar.MenuLinkIcon>
                <Sidebar.MenuLinkLabel>
                  {ROLE_LABELS[role]}
                </Sidebar.MenuLinkLabel>
                <Sidebar.MenuLinkIcon>
                  <FontAwesomeIcon icon={faAngleRight} />
                </Sidebar.MenuLinkIcon>
              </Sidebar.DropdownTrigger>
              <Sidebar.DropdownMenu>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <Sidebar.DropdownMenuItem
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={r === role ? "active" : undefined}
                  >
                    {ROLE_LABELS[r]}
                  </Sidebar.DropdownMenuItem>
                ))}
              </Sidebar.DropdownMenu>
            </Sidebar.Dropdown>
          </Sidebar.MenuItem>
        </Sidebar.Menu>
      </Sidebar.Content>

      <Sidebar.Footer>
        <Sidebar.Dropdown>
          <Sidebar.DropdownTrigger>
            <Sidebar.MenuLinkIcon>
              <Avatar size="sm">
                <Avatar.Fallback>E</Avatar.Fallback>
              </Avatar>
            </Sidebar.MenuLinkIcon>
            <Sidebar.MenuLinkLabel>
              <span className="d-inline-flex flex-column">
                <span className="fw-semibold">Ethan Thompson</span>
                <span className="fs-xs">{ROLE_LABELS[role]}</span>
              </span>
            </Sidebar.MenuLinkLabel>
            <Sidebar.MenuLinkIcon>
              <FontAwesomeIcon icon={faAngleRight} />
            </Sidebar.MenuLinkIcon>
          </Sidebar.DropdownTrigger>
        </Sidebar.Dropdown>
      </Sidebar.Footer>
    </Sidebar>
  );
}
