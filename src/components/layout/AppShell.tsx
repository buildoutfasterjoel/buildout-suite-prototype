import { Outlet } from "@tanstack/react-router";
import { faSpinnerThird } from "@fortawesome/pro-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { GlobalNavbar } from "#/components/layout/GlobalNavbar";
import { useDataStore } from "#/data/dataStore";

export function AppShell() {
  const hydrated = useDataStore((s) => s.hydrated);

  return (
    <div className="app-shell vh-100 d-flex flex-column overflow-hidden">
      <GlobalNavbar />
      <main className="app-shell__main flex-grow-1 overflow-auto">
        {hydrated ? (
          <Outlet />
        ) : (
          <div className="d-flex justify-content-center align-items-center py-8 w-100 h-100">
            <FontAwesomeIcon icon={faSpinnerThird} spin size="2x" className="text-muted" />
          </div>
        )}
      </main>
    </div>
  );
}
