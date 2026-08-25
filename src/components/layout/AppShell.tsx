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
import { BovWatcher } from "#/components/call/BovWatcher";
import { RosaLeadsWatcher } from "#/components/call/RosaLeadsWatcher";
import { IngestionWatcher } from "#/components/deals/IngestionWatcher";
import { useDataStore } from "#/data/dataStore";

export function AppShell() {
  const hydrated = useDataStore((s) => s.hydrated);
  const navMode = useNavMode((s) => s.mode);
  const setNavMode = useNavMode((s) => s.setMode);
  const setDesignTogglesShown = useDesignToggles((s) => s.setShown);
  // Full-screen chat: the rail takes the whole stage and the page underneath is
  // pulled out of the flow entirely. `open` is checked alongside `expanded` so a
  // rail closed while expanded can never leave the page hidden behind nothing.
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

  // The same one-render hold pays for the nav mode too. The store can't read
  // localStorage in its initializer without disagreeing with the server, so the
  // persisted choice is applied here — and every branch that reads `appMode`
  // below is gated on `mounted`, so the first client render still matches the
  // HTML that arrived.
  useEffect(() => {
    const stored = readNavMode();
    if (stored !== useNavMode.getState().mode) setNavMode(stored);
  }, [setNavMode]);

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
  useEffect(() => {
    document.documentElement.dataset.navMode = appMode ? "app" : "classic";
  }, [appMode]);

  // Global command-center shortcut. `Mod` resolves to ⌘ on macOS, Ctrl elsewhere.
  useHotkey("Mod+K", () => useOmniSearch.getState().toggle());

  return (
    <ToasterProvider>
      <ToastBridge />
      <UndoHotkey />
      {/*
        One structure serves both nav modes, and the slots are deliberately
        never removed — `{appMode ? <AppSideNav/> : null}` holds its index so
        the body div, the `<main>` and the assistant rail keep their positions
        in the tree when the mode flips. Collapsing the rail's slot instead
        would shift every sibling by one and remount the router outlet and the
        open chat session along with it.

        In classic mode the rail slot is empty and the body is the full width,
        which is exactly the old flex column.
      */}
      <div
        className={`app-shell d-flex overflow-hidden vh-100${
          appMode ? " app-shell--app" : ""
        }`}
      >
        {appMode ? <AppSideNav /> : null}
        <div className="app-shell__body d-flex flex-column flex-grow-1 overflow-hidden">
          {!mounted ? null : appMode ? <AppTopBar /> : <GlobalNavbar />}
          {/*
            The stage is what the app shell rounds: page content and the
            assistant rail share one container so the rail's 8px top/right
            inset is measured against the container, not the window, and the
            top-left radius clips whichever of them reaches the corner.
          */}
          <div className="app-shell__stage flex-grow-1 d-flex overflow-hidden">
            <main
              className={`app-shell__main flex-grow-1 overflow-auto${
                chatFullscreen ? " d-none" : ""
              }`}
            >
              {hydrated && <LiveCallBar />}
              {hydrated && <CallSessionController />}
              {hydrated && <BovWatcher />}
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
        {hydrated && <GlobalNewContactModal />}
        {hydrated && <GlobalAddTaskModal />}
      </div>
    </ToasterProvider>
  );
}
