import { useLocation } from "@tanstack/react-router";
import type { ReactElement } from "react";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCircleQuestion, faHouse } from "@fortawesome/pro-regular-svg-icons";
import {
  faBuilding as faBuildingSolid,
  faDoorOpen as faDoorOpenSolid,
  faHandshake as faHandshakeSolid,
  faHouse as faHouseSolid,
  faSignal as faSignalSolid,
  faUsers as faUsersSolid,
} from "@fortawesome/pro-solid-svg-icons";
import { useNavClick } from "./navbarParts";
import {
  NAV_SECTIONS,
  isNavGroup,
  isPathActive,
  isSectionActive,
  type NavGroup,
  type NavLeaf,
  type NavSection,
} from "./navSections";
import { useRailExpanded } from "./useRailExpanded";

/**
 * The app shell's left rail (Figma nodes 2482:5072 collapsed, 2482:5509
 * expanded) — a navy column of section links under the top bar, at one of two
 * widths. The hamburger that flips it lives in `AppTopBar`, beside the brand,
 * which is why this component reads the width and never sets it.
 *
 * The design's own icon set is deliberately ignored: the rail carries the
 * prototype's real sections from `NAV_SECTIONS`, with their existing icons. One
 * nav vocabulary, two presentations — plus a Dashboard entry at the top that
 * goes where the logo goes, since the design gives the home a row of its own.
 *
 * The two widths ask for different things:
 *
 * - **Collapsed**, a leaf's icon is its only name, so it gets a tooltip; a group
 *   gets a flyout that opens on hover — and on keyboard focus, which is why it's
 *   `:hover, :focus-within` in CSS rather than React state. Clicking the group's
 *   icon goes to its first child: a section you can hover but not click reads
 *   as broken. The flyout has no gap to cross — it starts at the rail's edge and
 *   pads its own content in.
 * - **Expanded**, every section is labelled and a group's pages are listed
 *   beneath it, always open (Figma 2489:8967): five sections and six pages fit
 *   without folding, and a fold would hide the very links the width exists to
 *   show.
 *
 * The lit section swaps its glyph for the solid cut and turns purple, and a 2px
 * bar sits on the rail's edge beside it. In the expanded rail a group hands that
 * bar to whichever of its pages is open (Figma 2489:8989) — the header keeps
 * the purple glyph, the page keeps the marker.
 */
export function AppSideNav() {
  const { pathname } = useLocation();
  const handleNavClick = useNavClick();
  const expanded = useRailExpanded((s) => s.expanded);

  function renderLeaf(section: NavLeaf) {
    const active = isSectionActive(section, pathname);
    return (
      <li
        key={section.label}
        className={`app-rail__item${active ? " app-rail__item--active" : ""}`}
      >
        <RailTooltip label={section.label} enabled={!expanded}>
          <a
            href={section.href}
            onClick={(e) => handleNavClick(e, section.href)}
            aria-label={expanded ? undefined : section.label}
            aria-current={active ? "page" : undefined}
            className={`app-rail__link${active ? " app-rail__link--active" : ""}`}
          >
            <RailGlyph icon={section.icon} active={active} />
            {expanded && (
              <span className="app-rail__label">{section.label}</span>
            )}
          </a>
        </RailTooltip>
      </li>
    );
  }

  function renderGroup(section: NavGroup) {
    // Non-empty by construction (see `NavGroup`), so this is the group's own
    // destination, not a fallback.
    const first = section.items[0];
    const active = isSectionActive(section, pathname);

    const header = (
      <a
        href={first.href}
        onClick={(e) => handleNavClick(e, first.href)}
        aria-label={expanded ? undefined : section.label}
        // Expanded, the open page below carries the current marker itself.
        aria-current={active && !expanded ? "page" : undefined}
        className={`app-rail__link${active ? " app-rail__link--active" : ""}`}
      >
        <RailGlyph icon={section.icon} active={active} />
        {expanded && <span className="app-rail__label">{section.label}</span>}
      </a>
    );

    if (expanded) {
      return (
        <li key={section.label} className="app-rail__item app-rail__item--group">
          {header}
          <ul className="app-rail__sublist">
            {section.items.map((item) => {
              const itemActive = isPathActive(item.href, pathname);
              return (
                <li
                  key={item.href}
                  className={`app-rail__subitem${
                    itemActive ? " app-rail__subitem--active" : ""
                  }`}
                >
                  <a
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.href)}
                    aria-current={itemActive ? "page" : undefined}
                    className="app-rail__sublink"
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </li>
      );
    }

    return (
      <li
        key={section.label}
        className={`app-rail__item app-rail__item--group${
          active ? " app-rail__item--active" : ""
        }`}
      >
        {header}
        <div className="app-rail__flyout" role="group" aria-label={section.label}>
          <div className="app-rail__flyout-inner">
            {section.items.map((item) => {
              const itemActive = isPathActive(item.href, pathname);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  aria-current={itemActive ? "page" : undefined}
                  className={`app-rail__flyout-link${
                    itemActive ? " app-rail__flyout-link--active" : ""
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </li>
    );
  }

  function renderSection(section: NavSection) {
    return isNavGroup(section) ? renderGroup(section) : renderLeaf(section);
  }

  return (
    <nav
      id="app-rail"
      className={`app-rail${expanded ? " app-rail--expanded" : ""}`}
      aria-label="Sections"
    >
      <ul className="app-rail__list">
        {renderLeaf(HOME)}
        {NAV_SECTIONS.map((section) => renderSection(section))}
      </ul>

      {/* Pinned to the foot of the rail. Support has no destination in the
          prototype yet — it's the affordance and its placement being shown, so
          the button is real and the link isn't. */}
      <div className="app-rail__foot">
        <div className="app-rail__item">
          <RailTooltip label="Support" enabled={!expanded}>
            <button
              type="button"
              className="app-rail__link"
              aria-label={expanded ? undefined : "Support"}
            >
              <RailGlyph icon={faCircleQuestion} active={false} />
              {expanded && <span className="app-rail__label">Support</span>}
            </button>
          </RailTooltip>
        </div>
      </div>
    </nav>
  );
}

/**
 * The home row. Not in `NAV_SECTIONS` because the classic bar has no such item
 * — there the brand is the way home — so it's the rail's own.
 */
const HOME: NavLeaf = { label: "Dashboard", href: "/suite", icon: faHouse };

/**
 * The solid cut of each section's icon, for the lit state (Figma 2482:2847).
 * Keyed by name so `NAV_SECTIONS` keeps declaring one icon per section; a
 * section whose solid twin isn't listed here simply stays regular when lit.
 */
const SOLID_BY_NAME: Record<string, IconDefinition> = Object.fromEntries(
  [
    faHouseSolid,
    faBuildingSolid,
    faUsersSolid,
    faHandshakeSolid,
    faDoorOpenSolid,
    faSignalSolid,
  ].map((icon) => [icon.iconName, icon]),
);

function RailGlyph({
  icon,
  active,
}: {
  icon: IconDefinition;
  active: boolean;
}) {
  const shown = active ? (SOLID_BY_NAME[icon.iconName] ?? icon) : icon;
  return (
    <span className="app-rail__icon">
      <FontAwesomeIcon icon={shown} />
    </span>
  );
}

/**
 * A tooltip only while the rail is collapsed: expanded, the label is right
 * there, and a tooltip repeating it is noise.
 */
function RailTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactElement;
}) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <Tooltip.Trigger render={children} />
      <Tooltip.Content side="right">{label}</Tooltip.Content>
    </Tooltip>
  );
}
