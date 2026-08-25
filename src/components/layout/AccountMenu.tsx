import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Navbar, useNavbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBuildings,
  faPaintbrush,
  faRectanglesMixed,
  faSidebar,
  faUser,
  faUserGear,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { CURRENT_USER } from "#/data/teammates";
import type { RoleId } from "#/data/permissions";
import { useRoster } from "#/components/settings/users/useRoster";
import { useViewerRoles } from "#/components/settings/users/useViewer";
import { useDesignToggles } from "./useDesignToggles";
import { navModeLabel, useNavMode } from "./useNavMode";
import {
  VIEW_AS_ORDER,
  identityLine,
  readViewAsRole,
  viewAsLabel,
  writeViewAsRole,
} from "./viewAsRole";

/**
 * The account dropdown in the navbar footer.
 *
 * Three zones: an inert identity card, real product settings links, and
 * prototype-only controls (persona switcher, prototype index, reset). The zones
 * are separated so demo scaffolding never reads as shipped product.
 */
export function AccountMenu() {
  const navigate = useNavigate();
  const { isMobile } = useNavbar();
  const resetDemo = useDataStore((s) => s.reset);
  const navMode = useNavMode((s) => s.mode);
  const toggleNavMode = useNavMode((s) => s.toggle);
  const designTogglesShown = useDesignToggles((s) => s.shown);
  const toggleDesignToggles = useDesignToggles((s) => s.toggle);
  const setRoles = useRoster((s) => s.setRoles);

  // The chosen role lives on the signed-in user's roster row, so the menu reads
  // it back from there rather than keeping its own copy — editing Ethan's roles
  // on his own permissions page moves this checkmark too.
  const viewerRoles = useViewerRoles();
  const activeRole = viewerRoles[0] ?? "broker";

  // Restore the persisted seat on mount. The roster seed can't read
  // localStorage itself (it's built at module load, and has to be SSR-safe), so
  // the stored choice is applied here once the client is up. Skipped when it
  // already matches, so this never writes a fresh users array for no reason.
  useEffect(() => {
    const stored = readViewAsRole();
    const current = useRoster.getState().users.find(
      (u) => u.id === CURRENT_USER.id,
    );
    if (current && (current.roleIds.length !== 1 || current.roleIds[0] !== stored)) {
      setRoles(CURRENT_USER.id, [stored]);
    }
  }, [setRoles]);

  function changeRole(next: RoleId) {
    writeViewAsRole(next);
    setRoles(CURRENT_USER.id, [next]);
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
    <Navbar.Nav className="ms-2">
      <Navbar.Group>
        <Navbar.GroupTrigger
          className="navbar-user-trigger"
          aria-label={`Account: ${CURRENT_USER.name}`}
        >
          <Navbar.ItemLinkIcon>
            <Avatar style={{ width: 28, height: 28 }}>
              <Avatar.Image
                src={CURRENT_USER.avatarUrl}
                alt={CURRENT_USER.name}
              />
              <Avatar.Fallback>{CURRENT_USER.initials}</Avatar.Fallback>
            </Avatar>
          </Navbar.ItemLinkIcon>
        </Navbar.GroupTrigger>

        <Navbar.GroupMenu align="end">
          {/* Zone 1 — identity. Deliberately not a menu item: it states who you
              are, so it must not compete with Profile settings right below. */}
          <div className="account-menu__card d-flex align-items-center gap-3">
            <Avatar style={{ width: 40, height: 40 }}>
              <Avatar.Image src={CURRENT_USER.avatarUrl} alt="" />
              <Avatar.Fallback>{CURRENT_USER.initials}</Avatar.Fallback>
            </Avatar>
            <div className="account-menu__identity">
              <div className="fw-semibold text-truncate">
                {CURRENT_USER.name}
              </div>
              <div className="small text-truncate text-buildout-blue-200">
                {CURRENT_USER.email}
              </div>
              <div className="small text-truncate text-buildout-blue-200">
                {identityLine(activeRole, CURRENT_USER.company)}
              </div>
            </div>
          </div>

          {/* Zone 2 — real product settings. Profile settings has no screen yet,
              so it closes the menu and goes nowhere. */}
          <Navbar.Separator orientation="horizontal" className="my-1" />
          <Navbar.GroupMenuItem className="d-flex align-items-center gap-2">
            <FontAwesomeIcon icon={faUserGear} />
            Profile settings
          </Navbar.GroupMenuItem>
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={() => navigate({ to: "/settings/company" })}
          >
            <FontAwesomeIcon icon={faBuildings} />
            Company settings
          </Navbar.GroupMenuItem>

          {/* Zone 3 — prototype scaffolding. */}
          <Navbar.Separator orientation="horizontal" className="my-1" />
          {isMobile ? (
            // Base UI's submenu and radio parts have no Menu.Root in Navbar's
            // collapsible branch, so mobile gets flat rows instead.
            VIEW_AS_ORDER.map((roleId) => (
              <Navbar.GroupMenuItem
                key={roleId}
                onClick={() => changeRole(roleId)}
                className={roleId === activeRole ? "active" : undefined}
              >
                {viewAsLabel(roleId)}
              </Navbar.GroupMenuItem>
            ))
          ) : (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faUser} />
                Viewing as: {viewAsLabel(activeRole)}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className="navbar-dropdown">
                <DropdownMenu.RadioGroup
                  value={activeRole}
                  onValueChange={(value) => changeRole(value as RoleId)}
                >
                  {VIEW_AS_ORDER.map((roleId) => (
                    <DropdownMenu.RadioItem key={roleId} value={roleId}>
                      {viewAsLabel(roleId)}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          )}
          {/* The nav-shape switch. Named for what you'd get, not for what you
              have, so one read of the row tells you what clicking it does. */}
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={toggleNavMode}
          >
            <FontAwesomeIcon icon={faSidebar} />
            Switch to {navModeLabel(navMode === "app" ? "classic" : "app")}
          </Navbar.GroupMenuItem>
          {/* The floating paintbrush on the contact page and the Pipeline
              board. Off by default — it's a reviewer's tool, and it sits in the
              corner of every screenshot of those pages until someone asks for
              it. Same "name the outcome" phrasing as the row above. */}
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={toggleDesignToggles}
          >
            <FontAwesomeIcon icon={faPaintbrush} />
            {designTogglesShown ? "Hide" : "Show"} style toggle
          </Navbar.GroupMenuItem>
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={() => navigate({ to: "/" })}
          >
            <FontAwesomeIcon icon={faRectanglesMixed} />
            Prototype index
          </Navbar.GroupMenuItem>
          <Navbar.GroupMenuItem
            className="d-flex align-items-center gap-2"
            onClick={handleResetDemo}
          >
            <FontAwesomeIcon icon={faArrowsRotate} />
            Reset demo
          </Navbar.GroupMenuItem>
        </Navbar.GroupMenu>
      </Navbar.Group>
    </Navbar.Nav>
  );
}
