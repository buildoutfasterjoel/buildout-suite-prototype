import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faUsers,
  faHandshake,
  faSignal,
  faMagnifyingGlass,
  faPlus,
  faBell,
  faChevronDown,
} from "@fortawesome/pro-regular-svg-icons";
import { faDiamonds4 } from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import BuildoutLogo from "#/features/assets/buildout-logo";

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
      { label: "Listings", href: "/properties" },
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

export function GlobalNav() {
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
      <Navbar.Brand href="/suite">
        <BuildoutLogo style={{ height: 32 }} />
      </Navbar.Brand>
      <Navbar.Toggler />
      <Navbar.Content>
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
                  href={ctx.href}
                  isActive={isContextActive(ctx, pathname)}
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
      <Navbar.Footer className="d-flex gap-2 align-items-center">
        <Navbar.Nav>
          <Navbar.Item>
            <Navbar.ItemLink href="#">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </Navbar.ItemLink>
          </Navbar.Item>
          <Navbar.Item>
            <Navbar.ItemLink href="#" className="position-relative me-2">
              <FontAwesomeIcon icon={faBell} />
              <Badge
                variant="primary"
                className="position-absolute top-0 start-100 translate-middle"
              >
                3
              </Badge>
            </Navbar.ItemLink>
          </Navbar.Item>
          <Navbar.Item>
            <DropdownMenu>
              <DropdownMenu.Trigger render={<Button variant="primary" />}>
                <FontAwesomeIcon icon={faPlus} className="me-1" />
                New
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="ms-1"
                  style={{ fontSize: "0.75em" }}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={() => console.log("new activity")}>
                  New Activity
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => console.log("new task")}>
                  New Task
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => console.log("new note")}>
                  New Note
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                <DropdownMenu.Item onClick={() => console.log("new contact")}>
                  New Contact
                </DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => console.log("new deal")}>
                  New Deal
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </Navbar.Item>

          {/* Dev-only role switcher */}
          <Navbar.Item>
            <Select
              value={role}
              onValueChange={(val) => handleRoleChange(val as Role)}
              aria-label="Dev role switcher"
            >
              <Select.Trigger render={<Button variant="secondary" />}>
                <Select.Value>
                  {(value) => ROLE_LABELS[value as Role]}
                </Select.Value>
              </Select.Trigger>
              <Select.Content>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <Select.Item key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </Navbar.Item>
        </Navbar.Nav>
        <Navbar.Separator orientation="vertical" />
        <Navbar.Nav>
          <Navbar.Group>
            <Navbar.GroupTrigger style={{ height: "auto" }}>
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
          </Navbar.Group>
        </Navbar.Nav>
      </Navbar.Footer>
    </Navbar>
  );
}
