import { useNavigate } from "@tanstack/react-router";
import { Navbar, useNavbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBuildings,
  faClockRotateLeft,
  faPaintbrush,
  faRectanglesMixed,
  faSidebar,
  faUser,
  faUserGear,
} from "@fortawesome/pro-regular-svg-icons";
import { useDataStore } from "#/data/dataStore";
import { VIEWABLE_PEOPLE, useCurrentUser } from "#/data/currentUser";
import { useAccessRequests } from "#/components/contacts/useAccessRequests";
import { useRoster } from "#/components/settings/users/useRoster";
import { useDesignToggles } from "./useDesignToggles";
import { navModeLabel, useNavMode } from "./useNavMode";

/**
 * The account dropdown in the navbar footer.
 *
 * Three zones: an inert identity card, real product settings links, and
 * prototype-only controls (persona switcher, prototype index, changelog,
 * reset). The zones are separated so demo scaffolding never reads as shipped
 * product.
 */
export function AccountMenu() {
  const navigate = useNavigate();
  const { isMobile } = useNavbar();
  const resetDemo = useDataStore((s) => s.reset);
  const navMode = useNavMode((s) => s.mode);
  const toggleNavMode = useNavMode((s) => s.toggle);
  const designTogglesShown = useDesignToggles((s) => s.shown);
  const toggleDesignToggles = useDesignToggles((s) => s.toggle);

  // The chosen role lives on the signed-in user's roster row, so the menu reads
  // it back from there rather than keeping its own copy — editing Ethan's roles
  // on his own permissions page moves this checkmark too.

  // The seat: who's looking. Switching it is the demo's way to see the same
  // screens as Sarah (a Broker with a private book), Riley (an Office Admin
  // with no book) or Ethan (a Managing Director who sees through). Pending
  // access requests are the old seat's, so they're cleared on the way out.
  const seatId = useCurrentUser((s) => s.id);
  const setSeat = useCurrentUser((s) => s.setId);
  const me = VIEWABLE_PEOPLE.find((p) => p.id === seatId) ?? VIEWABLE_PEOPLE[0];
  const rosterRow = useRoster((s) => s.users.find((u) => u.id === seatId));
  function changeSeat(next: string) {
    if (next === seatId) return;
    setSeat(next);
    useAccessRequests.setState({ requests: {} });
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
          aria-label={`Account: ${me.name}`}
        >
          <Navbar.ItemLinkIcon>
            <Avatar style={{ width: 28, height: 28 }}>
              {me.avatarUrl && <Avatar.Image src={me.avatarUrl} alt={me.name} />}
              <Avatar.Fallback>{me.initials}</Avatar.Fallback>
            </Avatar>
          </Navbar.ItemLinkIcon>
        </Navbar.GroupTrigger>

        <Navbar.GroupMenu align="end">
          {/* Zone 1 — identity. Deliberately not a menu item: it states who you
              are, so it must not compete with Profile settings right below. */}
          <div className="account-menu__card d-flex align-items-center gap-3">
            <Avatar style={{ width: 40, height: 40 }}>
              {me.avatarUrl && <Avatar.Image src={me.avatarUrl} alt="" />}
              <Avatar.Fallback>{me.initials}</Avatar.Fallback>
            </Avatar>
            <div className="account-menu__identity">
              <div className="fw-semibold text-truncate">
                {me.name}
              </div>
              <div className="small text-truncate text-buildout-blue-200">
                {me.email}
              </div>
              <div className="small text-truncate text-buildout-blue-200">
                {[rosterRow?.title ?? me.role, me.company ?? "Buildout"].join(" · ")}
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
            VIEWABLE_PEOPLE.map((p) => (
              <Navbar.GroupMenuItem
                key={p.id}
                onClick={() => changeSeat(p.id)}
                className={p.id === seatId ? "active" : undefined}
              >
                {p.name}
              </Navbar.GroupMenuItem>
            ))
          ) : (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="d-flex align-items-center gap-2">
                <FontAwesomeIcon icon={faUser} />
                Viewing as: {me.name}
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent className="navbar-dropdown">
                <DropdownMenu.RadioGroup
                  value={seatId}
                  onValueChange={(value) => changeSeat(String(value))}
                >
                  {VIEWABLE_PEOPLE.map((p) => (
                    <DropdownMenu.RadioItem key={p.id} value={p.id}>
                      {p.name}
                      <span className="text-muted ms-2 small">{p.role}</span>
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
            onClick={() => navigate({ to: "/changelog" })}
          >
            <FontAwesomeIcon icon={faClockRotateLeft} />
            Changelog
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
