import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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

/**
 * The app shell's top bar (Figma node 208:11154) — the horizontal half of the
 * `app` nav mode, sitting to the right of `AppSideNav`.
 *
 * Three zones, and the point of the whole thing is that the outer two are the
 * *same width*: the omnibar and the Assistant pill then land dead-centre over
 * the page content rather than drifting with the length of the brand or the
 * count of account icons. 244px is the design's number; it's a CSS variable
 * (`--app-topbar-side`) so both zones can only ever be changed together.
 *
 * Sections are gone from here entirely — they're the rail's job now, which is
 * what buys the middle its room.
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

  return (
    <Navbar expand="sm" className="global-navbar app-topbar">
      <Navbar.Brand
        href="/suite"
        onClick={(e) => handleNavClick(e, "/suite")}
        aria-label="Buildout"
        className="app-topbar__side d-inline-flex align-items-center gap-2"
      >
        <BuildoutIcon style={{ height: 24, width: 24 }} />
        <BuildoutWordmark style={{ height: 24 }} />
      </Navbar.Brand>

      <Navbar.Toggler />

      <Navbar.Content className="app-topbar__center flex-nowrap">
        <Navbar.Nav className="app-topbar__center-nav">
          <Navbar.Item className="omni-bar-item d-flex align-items-center">
            <OmniBarTrigger />
          </Navbar.Item>

          {/* Assistant, promoted out of the icon cluster into a named button
              beside the omnibar (Figma node 208:11159): in the app shell the two
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
