import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faAngleDown,
  faArrowsRotate,
  faBars,
  faBell,
  faBuildings,
  faChevronRight,
  faCircleQuestion,
  faClockRotateLeft,
  faRectanglesMixed,
  faSquareCheck,
  faUserGear,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
// The Assistant launcher uses the solid sparkle, as on desktop.
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import BuildoutIcon from "#/features/assets/buildout-icon";
import BuildoutWordmark from "#/features/assets/buildout-wordmark";
import { useAssistant } from "#/ai/useAssistant";
import { useDataStore } from "#/data/dataStore";
import { VIEWABLE_PEOPLE, useCurrentUser } from "#/data/currentUser";
import { OmniBarTrigger, useNavClick } from "./navbarParts";
import { HOME, solidIconFor } from "./AppSideNav";
import {
  NAV_SECTIONS,
  isNavGroup,
  isPathActive,
  isSectionActive,
  type NavGroup,
  type NavLeaf,
} from "./navSections";

/**
 * The app shell on a phone (Figma node 2512:13672): one 56px bar and no rail.
 *
 * Three things sit on the bar — a hamburger, the omnibar filling whatever is
 * left, the Assistant shrunk to its sparkle, and the avatar — and two of them
 * open a **sheet**: a full-screen navy panel that replaces the page until it is
 * dismissed. The hamburger opens the sections (2492:12202); the avatar opens
 * the account menu (2512:14603). A sheet rather than a drawer or a dropdown
 * because at 390px wide there is nothing to leave uncovered, and a panel that
 * stops short of the edge just shows a sliver of page nobody can use.
 *
 * Not a Blueprint `Navbar`: none of the parts here read `useNavbar()`, and the
 * Navbar's own mobile branch (a Collapsible under a toggler) is the shape this
 * component exists to replace.
 *
 * The rows are the rail's rows scaled for a thumb — 44px tall, 24px glyphs,
 * 17px labels, a 4px current marker (Figma 2482:2852, Mobile variant). Groups
 * start closed and open in place with a chevron (2530:3896): there is no hover
 * on a phone, so the row itself has to be the disclosure.
 */
export function AppTopBarMobile() {
  const [sheet, setSheet] = useState<"menu" | "account" | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const assistantOpen = useAssistant((s) => s.open);
  const toggleAssistant = useAssistant((s) => s.toggle);
  const seatId = useCurrentUser((s) => s.id);
  const me = VIEWABLE_PEOPLE.find((p) => p.id === seatId) ?? VIEWABLE_PEOPLE[0];

  return (
    <>
      <header className="app-mbar">
        <button
          type="button"
          className="app-mbar__cell"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={sheet === "menu"}
          onClick={() => setSheet("menu")}
        >
          <FontAwesomeIcon icon={faBars} />
          {/* Unread notifications live inside the menu on a phone, so the
              hamburger carries their dot out to the bar (Figma annotation on
              2512:13673). The prototype always has unread. */}
          <span className="app-mbar__dot" aria-hidden />
        </button>

        <div className="app-mbar__center">
          <OmniBarTrigger />
          <button
            type="button"
            className="app-assistant-btn app-assistant-btn--icon"
            aria-label="Assistant"
            aria-pressed={assistantOpen}
            onClick={() => toggleAssistant()}
          >
            <FontAwesomeIcon icon={faSparkles} />
          </button>
        </div>

        <button
          type="button"
          className="app-mbar__cell"
          aria-label={`Account: ${me.name}`}
          aria-haspopup="dialog"
          aria-expanded={sheet === "account"}
          onClick={() => setSheet("account")}
        >
          <Avatar style={{ width: 36, height: 36 }}>
            {me.avatarUrl && <Avatar.Image src={me.avatarUrl} alt="" />}
            <Avatar.Fallback>{me.initials}</Avatar.Fallback>
          </Avatar>
        </button>
      </header>

      {sheet === "menu" && <MenuSheet onClose={closeSheet} />}
      {sheet === "account" && <AccountSheet me={me} onClose={closeSheet} />}
    </>
  );
}

// ── The sheets ───────────────────────────────────────────────────────────────

/**
 * A full-screen panel with a 56px header — the shell both sheets share. Focus
 * moves to the close button on open and back to whatever opened it on close;
 * Escape closes. Scroll needs no locking: the shell already pins the document
 * at `vh-100` and scrolls the page inside `<main>`, which the sheet covers.
 */
function Sheet({
  label,
  start,
  end,
  onClose,
  children,
}: {
  label: string;
  /** The header's leading content — brand or identity. */
  start: ReactNode;
  /** Extra header actions, placed before the close button. */
  end?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  return (
    <div className="app-msheet" role="dialog" aria-modal="true" aria-label={label}>
      <div className="app-msheet__bar">
        <div className="app-msheet__bar-start">{start}</div>
        <div className="app-msheet__bar-end">
          {end}
          <button
            ref={closeRef}
            type="button"
            className="app-msheet__iconbtn"
            aria-label="Close"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      </div>
      <div className="app-msheet__body">{children}</div>
    </div>
  );
}

/** The sections (Figma 2492:12202), with Tasks above and Support below. */
function MenuSheet({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation();
  const handleNavClick = useNavClick();

  // A tap that navigates also dismisses the sheet — the destination is the
  // point, and a menu still covering it would look like the tap did nothing.
  function go(e: MouseEvent<HTMLAnchorElement>, href: string) {
    handleNavClick(e, href);
    onClose();
  }

  function renderLeaf(section: NavLeaf) {
    const active = isSectionActive(section, pathname);
    return (
      <li
        key={section.href}
        className={`app-mnav__item${active ? " app-mnav__item--active" : ""}`}
      >
        <a
          href={section.href}
          onClick={(e) => go(e, section.href)}
          aria-current={active ? "page" : undefined}
          className={`app-mnav__link${active ? " app-mnav__link--active" : ""}`}
        >
          <Glyph icon={section.icon} active={active} />
          <span className="app-mnav__label">{section.label}</span>
        </a>
      </li>
    );
  }

  return (
    <Sheet
      label="Menu"
      onClose={onClose}
      start={
        <a
          href="/suite"
          onClick={(e) => go(e, "/suite")}
          aria-label="Buildout"
          className="app-msheet__brand"
        >
          <BuildoutIcon style={{ height: 24, width: 24 }} />
          <BuildoutWordmark style={{ height: 24 }} />
        </a>
      }
      end={
        <button
          type="button"
          className="app-msheet__iconbtn"
          aria-label="Notifications"
        >
          <FontAwesomeIcon icon={faBell} />
          <span className="app-mbar__dot" aria-hidden />
        </button>
      }
    >
      <ul className="app-mnav">
        {renderLeaf({ label: "Tasks", href: "/tasks", icon: faSquareCheck })}
        <li className="app-mnav__divider" role="separator" />
        {renderLeaf(HOME)}
        {NAV_SECTIONS.map((section) =>
          isNavGroup(section) ? (
            <MenuGroup
              key={section.label}
              section={section}
              pathname={pathname}
              onGo={go}
            />
          ) : (
            renderLeaf(section)
          ),
        )}
        <li className="app-mnav__divider" role="separator" />
        <li className="app-mnav__item">
          <button type="button" className="app-mnav__link">
            <Glyph icon={faCircleQuestion} active={false} />
            <span className="app-mnav__label">Support</span>
          </button>
        </li>
      </ul>
    </Sheet>
  );
}

/**
 * A group row that discloses its pages in place. Closed to start, every time
 * the sheet opens (Figma 2492:12202) — the design's call, and it keeps the
 * list short enough to see whole on a phone.
 */
function MenuGroup({
  section,
  pathname,
  onGo,
}: {
  section: NavGroup;
  pathname: string;
  onGo: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = isSectionActive(section, pathname);
  const id = `mnav-${section.label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <li className="app-mnav__item app-mnav__item--group">
      <button
        type="button"
        className={`app-mnav__link${active ? " app-mnav__link--active" : ""}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <Glyph icon={section.icon} active={active} />
        <span className="app-mnav__label">{section.label}</span>
        <span className="app-mnav__chevron" aria-hidden>
          <FontAwesomeIcon icon={open ? faAngleDown : faChevronRight} />
        </span>
      </button>
      {open && (
        <ul id={id} className="app-mnav__sublist">
          {section.items.map((item) => {
            const itemActive = isPathActive(item.href, pathname);
            return (
              <li
                key={item.href}
                className={`app-mnav__subitem${
                  itemActive ? " app-mnav__subitem--active" : ""
                }`}
              >
                <a
                  href={item.href}
                  onClick={(e) => onGo(e, item.href)}
                  aria-current={itemActive ? "page" : undefined}
                  className="app-mnav__sublink"
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

/**
 * The account menu as a sheet (Figma 2512:14603). Carries the desktop menu's
 * real rows — Profile settings, Company settings — and the prototype controls
 * that are plain rows (index, changelog, reset). The seat and role switchers
 * stay desktop-only: they are radio submenus, and a phone demo is not where
 * anyone is comparing personas.
 */
function AccountSheet({
  me,
  onClose,
}: {
  me: (typeof VIEWABLE_PEOPLE)[number];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const resetDemo = useDataStore((s) => s.reset);

  function go(to: string) {
    navigate({ to: to as never });
    onClose();
  }

  // Same as the desktop menu: back to the clean seed, then reload so every
  // screen re-reads the store. Reload fires even if the reset throws.
  async function handleResetDemo() {
    try {
      await resetDemo();
    } finally {
      window.location.reload();
    }
  }

  function row(
    label: string,
    icon: IconDefinition,
    onClick?: () => void,
  ) {
    return (
      <li className="app-mnav__item" key={label}>
        <button type="button" className="app-mnav__link" onClick={onClick}>
          <Glyph icon={icon} active={false} />
          <span className="app-mnav__label">{label}</span>
        </button>
      </li>
    );
  }

  return (
    <Sheet
      label="Account"
      onClose={onClose}
      start={
        <div className="app-msheet__identity">
          <Avatar style={{ width: 36, height: 36 }}>
            {me.avatarUrl && <Avatar.Image src={me.avatarUrl} alt="" />}
            <Avatar.Fallback>{me.initials}</Avatar.Fallback>
          </Avatar>
          <div className="app-msheet__who">
            <div className="app-msheet__name">{me.name}</div>
            <div className="app-msheet__email">{me.email}</div>
          </div>
        </div>
      }
    >
      <ul className="app-mnav">
        {/* Profile settings has no screen yet, so it closes the sheet and goes
            nowhere — same as the desktop row. */}
        {row("Profile settings", faUserGear, onClose)}
        {row("Company settings", faBuildings, () => go("/settings/company"))}
        <li className="app-mnav__divider" role="separator" />
        {row("Prototype index", faRectanglesMixed, () => go("/"))}
        {row("Changelog", faClockRotateLeft, () => go("/changelog"))}
        {row("Reset demo", faArrowsRotate, handleResetDemo)}
        <li className="app-mnav__divider" role="separator" />
        {row("Support", faCircleQuestion)}
      </ul>
    </Sheet>
  );
}

/** A row's 44px glyph cell; lit rows show the solid cut in purple. */
function Glyph({ icon, active }: { icon: IconDefinition; active: boolean }) {
  return (
    <span className="app-mnav__icon">
      <FontAwesomeIcon icon={active ? solidIconFor(icon) : icon} />
    </span>
  );
}
