import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars } from "@fortawesome/pro-regular-svg-icons";
// The AI assistant launcher uses the solid sparkle (per Figma).
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import BuildoutIcon from "#/features/assets/buildout-icon";
import BuildoutWordmark from "#/features/assets/buildout-wordmark";
import { useAssistant } from "#/ai/useAssistant";
import { AccountMenu } from "./AccountMenu";
import {
  NewMenu,
  NotificationsLink,
  OmniBarTrigger,
  TasksLink,
  useNavClick,
} from "./navbarParts";
import { useRailExpanded } from "./useRailExpanded";

/**
 * The app shell's top bar (Figma node 2482:5510) — the full-width strip across
 * the top of the `app` nav mode, with `AppSideNav` hanging beneath its left end.
 *
 * Three zones. The right one is the design's 244px; the left one is that same
 * 244px *plus the rail's width*, so the middle zone is exactly as wide as the
 * page stage below it and the omnibar/Assistant pair is centred over the page
 * rather than over the window. When the rail expands the left zone grows with
 * it and the pair slides right to stay centred. Both numbers are CSS variables
 * (`--app-topbar-side`, `--app-rail-width`) so the zones can only move together.
 *
 * The hamburger that collapses and expands the rail sits here rather than in
 * the rail (Figma puts it in the bar's own 52px corner, left of the brand): the
 * rail's width is the thing being toggled, so the control that toggles it
 * shouldn't move when it does.
 *
 * Sections are gone from here entirely — they're the rail's job, which is what
 * buys the middle its room.
 *
 * It's still a Blueprint `Navbar` rather than a bare flex row because
 * `AccountMenu`, `NewMenu` and the notification links all read `useNavbar()`
 * for their mobile branch. `expand="sm"` rather than the classic bar's `lg`:
 * there are four icons and a search box here, not five labelled sections, so it
 * has no business collapsing at tablet widths.
 */
export function AppTopBar() {
  const handleNavClick = useNavClick();
  const assistantOpen = useAssistant((s) => s.open);
  const toggleAssistant = useAssistant((s) => s.toggle);
  const railExpanded = useRailExpanded((s) => s.expanded);
  const toggleRail = useRailExpanded((s) => s.toggle);

  return (
    <Navbar expand="sm" className="global-navbar app-topbar">
      <div className="app-topbar__side app-topbar__side--start d-flex align-items-center">
        <button
          type="button"
          className="app-topbar__menu"
          aria-label={railExpanded ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={railExpanded}
          aria-controls="app-rail"
          onClick={toggleRail}
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
        <Navbar.Brand
          href="/suite"
          onClick={(e) => handleNavClick(e, "/suite")}
          aria-label="Buildout"
          className="app-topbar__brand d-inline-flex align-items-center gap-2"
        >
          <BuildoutIcon style={{ height: 24, width: 24 }} />
          <BuildoutWordmark style={{ height: 24 }} />
        </Navbar.Brand>
      </div>

      <Navbar.Toggler />

      <Navbar.Content className="app-topbar__center flex-nowrap">
        <Navbar.Nav className="app-topbar__center-nav">
          <Navbar.Item className="omni-bar-item d-flex align-items-center">
            <OmniBarTrigger />
          </Navbar.Item>

          {/* Assistant, promoted out of the icon cluster into a named button
              beside the omnibar (Figma node 2482:5517): in the app shell the two
              AI entry points read as one pair, which is the emphasis this
              layout exists to give them. */}
          <Navbar.Item className="d-flex align-items-center">
            <button
              type="button"
              className="app-assistant-btn"
              aria-pressed={assistantOpen}
              onClick={() => toggleAssistant()}
            >
              Assistant
              <FontAwesomeIcon icon={faSparkles} />
            </button>
          </Navbar.Item>
        </Navbar.Nav>
      </Navbar.Content>

      <Navbar.Footer className="app-topbar__side app-topbar__side--end flex-grow-0 flex-shrink-0 d-flex align-items-center justify-content-end">
        <Navbar.Nav>
          <NewMenu />
          <TasksLink />
          <NotificationsLink />
        </Navbar.Nav>
        <AccountMenu />
      </Navbar.Footer>
    </Navbar>
  );
}
