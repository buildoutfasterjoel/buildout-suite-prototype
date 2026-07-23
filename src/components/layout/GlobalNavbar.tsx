import { useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
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
  faPlus,
  faArrowsRotate,
  faMicrophone,
} from "@fortawesome/pro-regular-svg-icons";
// The AI assistant launcher uses the solid sparkle (per Figma).
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { formatForDisplay } from "@tanstack/hotkeys";
import BuildoutIcon from "#/features/assets/buildout-icon";
import BuildoutWordmark from "#/features/assets/buildout-wordmark";
import { useDataStore } from "#/data/dataStore";
import { useAssistant } from "#/ai/useAssistant";
import { useOmniSearch } from "#/components/search/useOmniSearch";
import { OmniSparkleIcon } from "#/components/search/OmniSparkleIcon";
import { useCreateDeal } from "#/data/useCreateDeal";
import { useNewContact } from "#/data/useNewContact";
import { useAddTask } from "#/data/useAddTask";

/** Platform-aware shortcut hint, e.g. "⌘K" on macOS, "Ctrl K" elsewhere. */
const SEARCH_HINT = formatForDisplay("Mod+K");

type Role = "principal" | "broker" | "marketing";

type NavContext = {
  label: string;
  href: string;
  icon: IconDefinition;
};

// NOW is no longer a nav item — the logo links to /suite. Tasks moved to a
// footer icon button.
const navContexts: NavContext[] = [
  { label: "Properties", href: "/properties", icon: faBuilding },
  { label: "Contacts", href: "/backoffice/contacts", icon: faUsers },
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

  const navigate = useNavigate();
  const resetDemo = useDataStore((s) => s.reset);
  const assistantOpen = useAssistant((s) => s.open);
  const toggleAssistant = useAssistant((s) => s.toggle);
  const openOmniSearch = useOmniSearch((s) => s.setOpen);

  // Navigate client-side so the persistent shell — and the open AI assistant
  // session — survives section changes. A plain <a> would full-reload the
  // document and remount everything. We keep the <a href> (for accessibility
  // and cmd/ctrl/middle-click "open in new tab") but intercept the plain
  // left-click. navigate() is used instead of <Link> because some nav targets
  // are placeholder routes that don't exist yet; navigate degrades to
  // not-found rather than throwing at render time.
  function handleNavClick(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    e.preventDefault();
    navigate({ to: href as never });
  }

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
    <Navbar expand="lg" className="global-navbar">
      <Navbar.Brand
        href="/suite"
        onClick={(e) => handleNavClick(e, "/suite")}
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
                render={
                  <a
                    href={ctx.href}
                    onClick={(e) => handleNavClick(e, ctx.href)}
                  />
                }
              >
                <Navbar.ItemLinkIcon>
                  <FontAwesomeIcon icon={ctx.icon} />
                </Navbar.ItemLinkIcon>
                <Navbar.ItemLinkLabel>{ctx.label}</Navbar.ItemLinkLabel>
              </Navbar.ItemLink>
            </Navbar.Item>
          ))}

          {/* Omni search — a gradient "AI omnibar" trigger that opens the
              command palette. A div (not a button) so the nested voice button
              is valid markup; it's keyboard-activatable via role + handlers. */}
          <Navbar.Item className="d-flex align-items-center ms-2">
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => openOmniSearch(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openOmniSearch(true);
                }
              }}
              aria-label="Search or ask AI"
              className="omni-bar flex-shrink-0"
            >
              <span className="omni-bar__icon">
                <OmniSparkleIcon variant="navbar" />
              </span>
              <span className="omni-bar__label">Search or ask AI</span>
              <span className="omni-bar__end">
                <span className="omni-bar__kbd">{SEARCH_HINT}</span>
                <button
                  type="button"
                  className="omni-bar__voice"
                  aria-label="Voice search"
                  onClick={(e) => {
                    e.stopPropagation();
                    openOmniSearch(true);
                  }}
                >
                  <FontAwesomeIcon icon={faMicrophone} />
                </button>
              </span>
            </div>
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
                  <Navbar.GroupTrigger
                    className="navbar-new-trigger"
                    aria-label="New"
                  >
                    <Navbar.ItemLinkIcon>
                      <FontAwesomeIcon icon={faPlus} />
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
              <Navbar.GroupMenuItem
                onClick={() => useAddTask.getState().openFor()}
              >
                New Task
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem onClick={() => console.log("new note")}>
                New Note
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem
                onClick={() => useNewContact.getState().openNew()}
              >
                New Contact
              </Navbar.GroupMenuItem>
              <Navbar.GroupMenuItem onClick={() => useCreateDeal.getState().openFor()}>
                New Deal
              </Navbar.GroupMenuItem>
            </Navbar.GroupMenu>
          </Navbar.Group>

          {/* Tasks — moved out of the main nav into a footer icon button. */}
          <Navbar.Item>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Navbar.ItemLink
                    aria-label="Tasks"
                    render={
                      <a
                        href="/tasks"
                        onClick={(e) => handleNavClick(e, "/tasks")}
                      />
                    }
                  >
                    <Navbar.ItemLinkIcon className="position-relative">
                      <FontAwesomeIcon icon={faSquareCheck} />
                      <span className="navbar-dot" aria-hidden />
                    </Navbar.ItemLinkIcon>
                  </Navbar.ItemLink>
                }
              />
              <Tooltip.Content>Tasks</Tooltip.Content>
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
                      <span className="navbar-dot" aria-hidden />
                    </Navbar.ItemLinkIcon>
                  </Navbar.ItemLink>
                }
              />
              <Tooltip.Content>Notifications</Tooltip.Content>
            </Tooltip>
          </Navbar.Item>

          {/* AI Assistant launcher — a filled purple-gradient circle. */}
          <Navbar.Item>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Navbar.ItemLink
                    aria-label="Assistant"
                    className="navbar-ai-btn"
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
        </Navbar.Nav>
        {/* User profile */}
        <Navbar.Nav className="ms-2">
          <Navbar.Group>
            <Navbar.GroupTrigger
              className="navbar-user-trigger"
              aria-label="Account"
            >
              <Navbar.ItemLinkIcon>
                <Avatar style={{ width: 28, height: 28 }}>
                  <Avatar.Image
                    src="https://randomuser.me/api/portraits/men/32.jpg"
                    alt="Ethan Thompson"
                  />
                  <Avatar.Fallback>E</Avatar.Fallback>
                </Avatar>
              </Navbar.ItemLinkIcon>
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
