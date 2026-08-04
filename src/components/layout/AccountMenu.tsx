import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Navbar, useNavbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBuildings,
  faRectanglesMixed,
  faUser,
  faUserGear,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { CURRENT_USER } from "#/data/teammates";
import {
  PERSONA_LABELS,
  PERSONA_ORDER,
  identityLine,
  readPersona,
  writePersona,
  type Persona,
} from "./personas";

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
  const [persona, setPersona] = useState<Persona>(() => readPersona());
  const resetDemo = useDataStore((s) => s.reset);

  function changePersona(next: Persona) {
    writePersona(next);
    setPersona(next);
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
                {identityLine(persona, CURRENT_USER.company)}
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
            PERSONA_ORDER.map((p) => (
              <Navbar.GroupMenuItem
                key={p}
                onClick={() => changePersona(p)}
                className={p === persona ? "active" : undefined}
              >
                {PERSONA_LABELS[p]}
              </Navbar.GroupMenuItem>
            ))
          ) : (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faUser} />
                Viewing as: {PERSONA_LABELS[persona]}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className="navbar-dropdown">
                <DropdownMenu.RadioGroup
                  value={persona}
                  onValueChange={(value) => changePersona(value as Persona)}
                >
                  {PERSONA_ORDER.map((p) => (
                    <DropdownMenu.RadioItem key={p} value={p}>
                      {PERSONA_LABELS[p]}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          )}
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
