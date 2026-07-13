import { useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSquareCheck,
  faBuilding,
  faUsers,
  faHandshake,
  faSignal,
  faBell,
  faCirclePlus,
  faArrowsRotate,
  faSparkles,
  faMagnifyingGlass,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { formatForDisplay } from "@tanstack/hotkeys";
import BuildoutIcon from "#/features/assets/buildout-icon";
import BuildoutWordmark from "#/features/assets/buildout-wordmark";
import { useDataStore } from "#/data/dataStore";
import { useAssistant } from "#/ai/useAssistant";
import { useOmniSearch } from "#/components/search/useOmniSearch";

/** Platform-aware shortcut hint, e.g. "⌘K" on macOS, "Ctrl K" elsewhere. */
const SEARCH_HINT = formatForDisplay("Mod+K");

type Role = "principal" | "broker" | "marketing";

type NavContext = {
  label: string;
  href: string;
  icon?: IconDefinition;
  isLive?: boolean;
};

const navContexts: NavContext[] = [
  { label: "NOW", href: "/suite", isLive: true },
  { label: "Tasks", href: "/tasks", icon: faSquareCheck },
  { label: "Properties", href: "/properties", icon: faBuilding },
  { label: "People", href: "/backoffice/contacts", icon: faUsers },
  { label: "Deals", href: "/listings", icon: faHandshake },
  { label: "Reports", href: "/reports", icon: faSignal },
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

export function GlobalNavbar() {
  const { pathname } = useLocation();
  const [role, setRole] = useState<Role>(
    () =>
      (typeof window !== "undefined"
        ? (localStorage.getItem("dev_role") as Role)
        : null) ?? "principal",
  );

  const resetDemo = useDataStore((s) => s.reset);
  const assistantOpen = useAssistant((s) => s.open);
  const toggleAssistant = useAssistant((s) => s.toggle);
  const openOmniSearch = useOmniSearch((s) => s.setOpen);

  function handleRoleChange(newRole: Role) {
    if (typeof window !== "undefined") {
      localStorage.setItem("dev_role", newRole);
    }
    setRole(newRole);
  }

  // Wipe the demo world back to the deterministic clean state, then reload so
  // every screen re-reads the fresh store. Reload fires even if the reset throws.
  async function handleResetDemo() {
    try {
      await resetDemo();
    } finally {
      window.location.reload();
    }
  }

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
          {navContexts.map((ctx) => (
            <Navbar.Item key={ctx.label}>
              <Navbar.ItemLink
                isActive={isPathActive(ctx.href, pathname)}
                render={<a href={ctx.href} />}
              >
                <Navbar.ItemLinkIcon>
                  {ctx.isLive ? (
                    <span
                      className="rounded-circle bg-success d-inline-block"
                      style={{ width: 8, height: 8 }}
                      aria-hidden
                    />
                  ) : (
                    ctx.icon && <FontAwesomeIcon icon={ctx.icon} />
                  )}
                </Navbar.ItemLinkIcon>
                <Navbar.ItemLinkLabel>{ctx.label}</Navbar.ItemLinkLabel>
              </Navbar.ItemLink>
            </Navbar.Item>
          ))}

          {/* Omni search — a nav item so it shares the navbar-nav flex row and
              stays inline with the other items instead of wrapping to a second
              line. Opposite color from the navbar (buildout-blue-50) so it
              stands out; a trigger, not a live input, that opens the overlay. */}
          <Navbar.Item className="d-flex align-items-center ms-2">
            <button
              type="button"
              onClick={() => openOmniSearch(true)}
              aria-label="Search properties, people, and deals"
              className="omni-search-trigger btn bg-buildout-blue-50 border d-inline-flex align-items-center gap-2 rounded-pill px-3 py-2 flex-shrink-0"
              style={{ width: 260 }}
            >
              <FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted" />
              <span className="flex-grow-1 text-start text-muted text-truncate">
                Search…
              </span>
              <kbd className="bg-white border text-muted rounded px-2 py-0 fs-xs flex-shrink-0">
                {SEARCH_HINT}
              </kbd>
            </button>
          </Navbar.Item>
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

          {/* AI Assistant launcher */}
          <Navbar.Item>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Navbar.ItemLink
                    aria-label="Assistant"
                    isActive={assistantOpen}
                    render={<a href="#" />}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleAssistant();
                    }}
                  >
                    <Navbar.ItemLinkIcon>
                      <FontAwesomeIcon icon={faSparkles} />
                    </Navbar.ItemLinkIcon>
                  </Navbar.ItemLink>
                }
              />
              <Tooltip.Content>Assistant</Tooltip.Content>
            </Tooltip>
          </Navbar.Item>

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
              <Navbar.GroupMenuItem
                onClick={handleResetDemo}
                className="border-top d-flex align-items-center gap-2"
              >
                <FontAwesomeIcon icon={faArrowsRotate} />
                Reset demo
              </Navbar.GroupMenuItem>
            </Navbar.GroupMenu>
          </Navbar.Group>
        </Navbar.Nav>
      </Navbar.Footer>
    </Navbar>
  );
}
