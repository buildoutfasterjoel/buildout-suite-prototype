import { useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { CircularProgress } from "@buildoutinc/blueprint-react/ui/Progress";
import { ToasterProvider } from "@buildoutinc/blueprint-react/ui/Toast";
import { ToastBridge } from "#/components/layout/ToastBridge";
import { UndoHotkey } from "#/components/layout/UndoHotkey";
import { GlobalNavbar } from "#/components/layout/GlobalNavbar";
import { AssistantSidebar } from "#/components/ai/AssistantSidebar";
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

  // Global command-center shortcut. `Mod` resolves to ⌘ on macOS, Ctrl elsewhere.
  useHotkey("Mod+K", () => useOmniSearch.getState().toggle());

  return (
    <ToasterProvider>
      <ToastBridge />
      <UndoHotkey />
      <div className="app-shell vh-100 d-flex flex-column overflow-hidden">
        {mounted && <GlobalNavbar />}
        <div className="flex-grow-1 d-flex overflow-hidden">
          <main className="app-shell__main flex-grow-1 overflow-auto">
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
