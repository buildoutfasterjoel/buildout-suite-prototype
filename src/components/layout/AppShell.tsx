import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { CircularProgress } from "@buildoutinc/blueprint-react/ui/Progress";
import { ToasterProvider } from "@buildoutinc/blueprint-react/ui/Toast";
import { ToastBridge } from "#/components/layout/ToastBridge";
import { UndoHotkey } from "#/components/layout/UndoHotkey";
import { GlobalNavbar } from "#/components/layout/GlobalNavbar";
import { AppTopBar } from "#/components/layout/AppTopBar";
import { AppSideNav } from "#/components/layout/AppSideNav";
import { readNavMode, useNavMode } from "#/components/layout/useNavMode";
import {
  readRailExpanded,
  useRailExpanded,
} from "#/components/layout/useRailExpanded";
import {
  readDesignTogglesShown,
  useDesignToggles,
} from "#/components/layout/useDesignToggles";
import { AssistantSidebar } from "#/components/ai/AssistantSidebar";
import { useAssistant } from "#/ai/useAssistant";
import { OmniSearch } from "#/components/search/OmniSearch";
import { useOmniSearch } from "#/components/search/useOmniSearch";
import { GlobalCreateDealModal } from "#/components/deals/GlobalCreateDealModal";
import { GlobalStageGateModal } from "#/components/deals/GlobalStageGateModal";
import { GlobalLogCallModal } from "#/components/contacts/GlobalLogCallModal";
import { GlobalNewContactModal } from "#/components/contacts/GlobalNewContactModal";
import { GlobalAddTaskModal } from "#/components/tasks/GlobalAddTaskModal";
import { LiveCallBar } from "#/components/call/LiveCallBar";
import { CallSessionController } from "#/components/call/CallSessionController";
import { BovFlow } from "#/components/contacts/BovFlow";
import { RosaLeadsWatcher } from "#/components/call/RosaLeadsWatcher";
import { IngestionWatcher } from "#/components/deals/IngestionWatcher";
import { useDataStore } from "#/data/dataStore";
import { useHydrateContactAccessSettings } from "#/components/settings/useContactAccessSettings";
import { useCurrentUser, useHydrateCurrentUser } from "#/data/currentUser";
import { useRoster } from "#/components/settings/users/useRoster";

export function AppShell() {
  const hydrated = useDataStore((s) => s.hydrated);
  const navMode = useNavMode((s) => s.mode);
  const setNavMode = useNavMode((s) => s.setMode);
  const setDesignTogglesShown = useDesignToggles((s) => s.setShown);
  const railExpanded = useRailExpanded((s) => s.expanded);
  const setRailExpanded = useRailExpanded((s) => s.setExpanded);
  // The assistant panel is positioned over the stage rather than laid out beside
  // it (see `.assistant-rail`), so the stage carries both facts about it: how
  // much width the page gives up to it while it is docked, and whether it has
  // expanded to cover the page entirely.
  //
  // `open` is checked alongside `expanded` for the second one so a rail closed
  // while expanded can never leave the page hidden behind nothing.
  const railOpen = useAssistant((s) => s.open);
  const chatFullscreen = useAssistant((s) => s.open && s.expanded);

  // The navbar is client-only, and not by choice. Blueprint's `Navbar` decides
  // mobile vs desktop with `useMobileBreakpoint`, whose `useState` initializer
  // reads `window.innerWidth` *during* the first render (see
  // blueprint-react/src/hooks/use-mobile.ts). The server has no window, so it
  // always renders the desktop tree — a DropdownMenu per `Navbar.Group` — while
  // a client narrower than the `expand="lg"` breakpoint of 1024px renders the
  // mobile tree, a Collapsible. React sees a `collapsible-container` div where
  // the HTML says `dropdown-menu-trigger` button, throws "Hydration failed",
  // and regenerates the whole tree.
  //
  // Holding the navbar back one render sidesteps it: `mounted` is false on both
  // sides, so the first client render matches the server, and by the time the
  // navbar mounts `innerWidth` is safe to read. It costs nothing here — SSR
  // already sends a spinner for everything below, so the navbar was the only
  // real markup in the payload. Remove this when the hook moves to
  // `useSyncExternalStore` with a server snapshot, the way our own
  // `useMediaQuery` does it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // The company's contact-ownership ceilings, restored from localStorage the
  // same way the "Viewing as" seat is — see the store for why.
  useHydrateContactAccessSettings();
  useHydrateCurrentUser();
  // The YOU badge on the roster follows the seat.
  const seat = useCurrentUser((s) => s.id);
  useEffect(() => {
    useRoster.getState().setViewer(seat);
  }, [seat]);

  // The same one-render hold pays for the nav mode too. The store can't read
  // localStorage in its initializer without disagreeing with the server, so the
  // persisted choice is applied here — and every branch that reads `appMode`
  // below is gated on `mounted`, so the first client render still matches the
  // HTML that arrived.
  useEffect(() => {
    const stored = readNavMode();
    if (stored !== useNavMode.getState().mode) setNavMode(stored);
  }, [setNavMode]);

  // And for the rail's width. Collapsed is the default and the server's
  // answer; the persisted expansion lands after the first commit, so the worst
  // case is a rail that widens once on load rather than a hydration mismatch.
  useEffect(() => {
    const stored = readRailExpanded();
    if (stored !== useRailExpanded.getState().expanded) setRailExpanded(stored);
  }, [setRailExpanded]);

  // Same deal for the design-options button. An effect runs after the first
  // commit, so the worst it can do is make the button appear — never disagree
  // with the HTML the server sent.
  useEffect(() => {
    const stored = readDesignTogglesShown();
    if (stored !== useDesignToggles.getState().shown) {
      setDesignTogglesShown(stored);
    }
  }, [setDesignTogglesShown]);

  const appMode = mounted && navMode === "app";

  // The omni palette is portaled to <body>, outside this tree, so it can't read
  // the mode from an ancestor class. Stamp it on <html> instead — that's the one
  // element both the shell and the portal can see. Written in an effect because
  // it's a DOM side-effect, not markup React renders.
  //
  // The rail's width goes on the same element for the same reason: the palette
  // and the toast viewport both offset themselves by it, and neither can see
  // the rail from where it's portaled to.
  useEffect(() => {
    document.documentElement.dataset.navMode = appMode ? "app" : "classic";
    document.documentElement.dataset.rail = railExpanded
      ? "expanded"
      : "collapsed";
  }, [appMode, railExpanded]);

  // Global command-center shortcut. `Mod` resolves to ⌘ on macOS, Ctrl elsewhere.
  useHotkey("Mod+K", () => useOmniSearch.getState().toggle());

  return (
    <ToasterProvider>
      <ToastBridge />
      <UndoHotkey />
      {/*
        One structure serves both nav modes, and the slots are deliberately
        never removed — `{appMode ? <AppSideNav/> : null}` holds its index so
        the stage, the `<main>` and the assistant rail keep their positions in
        the tree when the mode flips. Collapsing the rail's slot instead would
        shift every sibling by one and remount the router outlet and the open
        chat session along with it.

        The bar spans the window and the rail hangs beneath it (Figma node
        2482:5072) — the rail is a child of the body row, not a sibling of the
        column. In classic mode the rail slot is empty and the body is the
        stage alone, which is exactly the old flex column.
      */}
      <div
        className={`app-shell d-flex flex-column overflow-hidden vh-100${
          appMode ? " app-shell--app" : ""
        }`}
      >
        {!mounted ? null : appMode ? <AppTopBar /> : <GlobalNavbar />}
        <div className="app-shell__body d-flex flex-grow-1 overflow-hidden">
          {appMode ? <AppSideNav /> : null}
          {/*
            The stage is what the app shell rounds: page content and the
            assistant rail share one container so the rail's 8px top/right
            inset is measured against the container, not the window, and the
            top-left radius clips whichever of them reaches the corner.
          */}
          <div
            className={`app-shell__stage flex-grow-1 d-flex overflow-hidden${
              railOpen ? " app-shell__stage--railed" : ""
            }${chatFullscreen ? " app-shell__stage--rail-full" : ""}`}
          >
            <main className="app-shell__main flex-grow-1 overflow-auto">
              {hydrated && <LiveCallBar />}
              {hydrated && <CallSessionController />}
              {hydrated && <RosaLeadsWatcher />}
              {hydrated && <IngestionWatcher />}
              {hydrated ? (
                <Outlet />
              ) : (
                <div className="d-flex justify-content-center align-items-center py-8 w-100 h-100">
                  <CircularProgress size="lg" />
                </div>
              )}
            </main>
            {hydrated && <AssistantSidebar />}
          </div>
        </div>
        {hydrated && <OmniSearch />}
        {hydrated && <GlobalCreateDealModal />}
        {hydrated && <GlobalStageGateModal />}
        {hydrated && <GlobalLogCallModal />}
        {/* The underwriting → BOV wizard. Hosted here rather than on the contact
            page: the assistant rail can offer it from anywhere, and at the top
            of the tree none of its modals sits inside something clickable. */}
        {hydrated && <BovFlow />}
        {hydrated && <GlobalNewContactModal />}
        {hydrated && <GlobalAddTaskModal />}
      </div>
    </ToasterProvider>
  );
}
