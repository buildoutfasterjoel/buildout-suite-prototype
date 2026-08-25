import { useLocation } from "@tanstack/react-router";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBars, faCircleQuestion } from "@fortawesome/pro-regular-svg-icons";
import { useNavClick } from "./navbarParts";
import {
  NAV_SECTIONS,
  isNavGroup,
  isSectionActive,
  type NavGroup,
  type NavLeaf,
  type NavSection,
} from "./navSections";

/**
 * The app shell's left rail (Figma node 193:4125) — a 48px navy strip of
 * icon-only section links, running the full height of the window so the top bar
 * and the page container both sit inside its frame.
 *
 * The design's own icon set is deliberately ignored: this rail carries the
 * prototype's real sections from `NAV_SECTIONS`, with their existing icons, just
 * stripped of their labels. One nav vocabulary, two presentations.
 *
 * Losing the labels is what the interactions have to pay for:
 *
 * - A **leaf** gets a tooltip, since its icon is now its only name.
 * - A **group** gets a flyout that opens on hover — and on keyboard focus, which
 *   is why it's `:hover, :focus-within` in CSS rather than React state. The
 *   flyout's heading carries the group's name, so it needs no tooltip of its
 *   own. Clicking the group's icon goes to its first child: the icon is the
 *   section, and a section you can hover but not click reads as broken.
 *
 * The flyout has no gap to cross — it starts at the rail's edge and pads its own
 * content in — so the pointer can never fall through the crack on its way over.
 */
export function AppSideNav() {
  const { pathname } = useLocation();
  const handleNavClick = useNavClick();

  function renderLeaf(section: NavLeaf) {
    return (
      <li key={section.label} className="app-rail__item">
        <Tooltip>
          <Tooltip.Trigger
            render={
              <a
                href={section.href}
                onClick={(e) => handleNavClick(e, section.href)}
                aria-label={section.label}
                aria-current={
                  isSectionActive(section, pathname) ? "page" : undefined
                }
                className={`app-rail__link${
                  isSectionActive(section, pathname)
                    ? " app-rail__link--active"
                    : ""
                }`}
              >
                <FontAwesomeIcon icon={section.icon} />
              </a>
            }
          />
          <Tooltip.Content side="right">{section.label}</Tooltip.Content>
        </Tooltip>
      </li>
    );
  }

  function renderGroup(section: NavGroup) {
    // Non-empty by construction (see `NavGroup`), so this is the group's own
    // destination, not a fallback.
    const first = section.items[0];
    const active = isSectionActive(section, pathname);

    return (
      <li key={section.label} className="app-rail__item">
        <a
          href={first.href}
          onClick={(e) => handleNavClick(e, first.href)}
          aria-label={section.label}
          aria-current={active ? "page" : undefined}
          className={`app-rail__link${active ? " app-rail__link--active" : ""}`}
        >
          <FontAwesomeIcon icon={section.icon} />
        </a>
        <div className="app-rail__flyout" role="group" aria-label={section.label}>
          <div className="app-rail__flyout-inner">
            <div className="app-rail__flyout-title">{section.label}</div>
            {section.items.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="app-rail__flyout-link"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </li>
    );
  }

  function renderSection(section: NavSection) {
    return isNavGroup(section) ? renderGroup(section) : renderLeaf(section);
  }

  return (
    <nav className="app-rail" aria-label="Sections">
      {/* The hamburger is chrome-only for now — the design has it collapsing an
          expanded rail that doesn't exist yet, so it stays inert rather than
          shipping a button that half-works. It occupies the rail's own 60px
          header so the first section icon lines up with the top bar's floor. */}
      <div className="app-rail__top">
        <button
          type="button"
          className="app-rail__link app-rail__hamburger"
          aria-label="Menu"
          aria-disabled="true"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      <ul className="app-rail__list">
        {NAV_SECTIONS.map((section) => renderSection(section))}
      </ul>

      {/* Extra actions, pinned to the foot of the rail (Figma node 193:4135).
          Support has no destination in the prototype yet — it's the affordance
          and its placement being shown, so the button is real and the link
          isn't. */}
      <div className="app-rail__foot">
        <Tooltip>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                className="app-rail__link"
                aria-label="Support"
              >
                <FontAwesomeIcon icon={faCircleQuestion} />
              </button>
            }
          />
          <Tooltip.Content side="right">Support</Tooltip.Content>
        </Tooltip>
      </div>
    </nav>
  );
}
