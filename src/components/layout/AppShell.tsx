import { Outlet } from "@tanstack/react-router";
import { useHotkey } from "@tanstack/react-hotkeys";
import { faSpinnerThird } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ToasterProvider } from "@buildoutinc/blueprint-react/ui/Toast";
import { GlobalNavbar } from "#/components/layout/GlobalNavbar";
import { AssistantSidebar } from "#/components/ai/AssistantSidebar";
import { OmniSearch } from "#/components/search/OmniSearch";
import { useOmniSearch } from "#/components/search/useOmniSearch";
import { GlobalCreateDealModal } from "#/components/deals/GlobalCreateDealModal";
import { GlobalStageGateModal } from "#/components/deals/GlobalStageGateModal";
import { useDataStore } from "#/data/dataStore";

export function AppShell() {
  const hydrated = useDataStore((s) => s.hydrated);

  // Global command-center shortcut. `Mod` resolves to ⌘ on macOS, Ctrl elsewhere.
  useHotkey("Mod+K", () => useOmniSearch.getState().toggle());

  return (
    <ToasterProvider>
      <div className="app-shell vh-100 d-flex flex-column overflow-hidden">
        <GlobalNavbar />
        <div className="flex-grow-1 d-flex overflow-hidden">
          <main className="app-shell__main flex-grow-1 overflow-auto">
            {hydrated ? (
              <Outlet />
            ) : (
              <div className="d-flex justify-content-center align-items-center py-8 w-100 h-100">
                <FontAwesomeIcon icon={faSpinnerThird} spin size="2x" className="text-muted" />
              </div>
            )}
          </main>
          {hydrated && <AssistantSidebar />}
        </div>
        {hydrated && <OmniSearch />}
        {hydrated && <GlobalCreateDealModal />}
        {hydrated && <GlobalStageGateModal />}
      </div>
    </ToasterProvider>
  );
}
