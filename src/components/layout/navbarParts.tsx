/**
 * The pieces both global navs are built from.
 *
 * `GlobalNavbar` (classic) and `AppTopBar` (app shell) disagree about *where*
 * the omnibar, the New menu and the notification icons sit — but not about what
 * they are. They live here so a change to the New menu's contents, or to the
 * omnibar's voice hand-off, lands in both shapes at once.
 *
 * Everything here assumes a Blueprint `Navbar` ancestor: both consumers are one,
 * which is also why the app top bar is a `Navbar` rather than a bare flex row —
 * `AccountMenu` and the group menus read `useNavbar()` for their mobile branch.
 */
import type { MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Navbar } from "@buildoutinc/blueprint-react/ui/Navbar";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faMicrophone,
  faPlus,
  faSquareCheck,
} from "@fortawesome/pro-regular-svg-icons";
import { formatForDisplay } from "@tanstack/hotkeys";
import { useOmniSearch } from "#/components/search/useOmniSearch";
import { OmniSparkleIcon } from "#/components/search/OmniSparkleIcon";
import { useCreateDeal } from "#/data/useCreateDeal";
import { useNewContact } from "#/data/useNewContact";
import { useAddTask } from "#/data/useAddTask";

/** Platform-aware shortcut hint, e.g. "⌘K" on macOS, "Ctrl K" elsewhere. */
export const SEARCH_HINT = formatForDisplay("Mod+K");

/**
 * Client-side navigation for nav links, so the persistent shell — and the open
 * AI assistant session — survives section changes. A plain <a> would full-reload
 * the document and remount everything. The `<a href>` stays (for accessibility
 * and cmd/ctrl/middle-click "open in new tab"); only the plain left-click is
 * intercepted. `navigate()` is used instead of `<Link>` because some nav targets
 * are placeholder routes that don't exist yet; navigate degrades to not-found
 * rather than throwing at render time.
 */
export function useNavClick() {
  const navigate = useNavigate();
  return function handleNavClick(
    e: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
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
  };
}

/**
 * Omni search — a gradient "AI omnibar" trigger that opens the command palette.
 * A div (not a button) so the nested voice button is valid markup; it's
 * keyboard-activatable via role + handlers.
 *
 * Stays put while the palette is open: it used to fade out and hand off to the
 * palette's own bar, which read as the search box being yanked away mid-thought.
 * Only the tab stop goes, since the palette traps focus and the backdrop
 * swallows clicks.
 */
export function OmniBarTrigger() {
  const openOmniSearch = useOmniSearch((s) => s.setOpen);
  const openOmniSearchWithVoice = useOmniSearch((s) => s.openWithVoice);
  const omniSearchOpen = useOmniSearch((s) => s.open);

  return (
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions */
    <div
      role="button"
      tabIndex={omniSearchOpen ? -1 : 0}
      onClick={() => openOmniSearch(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openOmniSearch(true);
        }
      }}
      aria-label="Search or ask Otto"
      className="omni-bar flex-shrink-0"
    >
      <span className="omni-bar__icon">
        <OmniSparkleIcon variant="navbar" />
      </span>
      <span className="omni-bar__label">Search or ask Otto</span>
      <span className="omni-bar__end">
        <span className="omni-bar__kbd">{SEARCH_HINT}</span>
        <button
          type="button"
          className="omni-bar__voice"
          aria-label="Voice search"
          onClick={(e) => {
            e.stopPropagation();
            // Open the overlay already listening, so one tap starts dictating
            // instead of just revealing a second mic button.
            openOmniSearchWithVoice();
          }}
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </button>
      </span>
    </div>
  );
}

/** The "+" action menu. */
export function NewMenu() {
  return (
    <Navbar.Group>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Navbar.GroupTrigger className="navbar-new-trigger" aria-label="New">
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
        <Navbar.GroupMenuItem onClick={() => useAddTask.getState().openFor()}>
          New Task
        </Navbar.GroupMenuItem>
        <Navbar.GroupMenuItem onClick={() => console.log("new note")}>
          New Note
        </Navbar.GroupMenuItem>
        <Navbar.GroupMenuItem onClick={() => useNewContact.getState().openNew()}>
          New Contact
        </Navbar.GroupMenuItem>
        <Navbar.GroupMenuItem onClick={() => useCreateDeal.getState().openFor()}>
          New Deal
        </Navbar.GroupMenuItem>
      </Navbar.GroupMenu>
    </Navbar.Group>
  );
}

/** Tasks — an icon button rather than a main-nav section. */
export function TasksLink() {
  const handleNavClick = useNavClick();
  return (
    <Navbar.Item>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Navbar.ItemLink
              aria-label="Tasks"
              render={
                <a href="/tasks" onClick={(e) => handleNavClick(e, "/tasks")} />
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
  );
}

/** Notifications — no destination in the prototype, just the affordance. */
export function NotificationsLink() {
  return (
    <Navbar.Item>
      <Tooltip>
        <Tooltip.Trigger
          render={
            <Navbar.ItemLink aria-label="Notifications" render={<a href="#" />}>
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
  );
}
