import { Outlet } from "@tanstack/react-router";
import { GlobalNavbar } from "#/components/layout/GlobalNavbar";

export function AppShell() {
  return (
    <div className="app-shell vh-100 d-flex flex-column overflow-hidden">
      <GlobalNavbar />
      <main className="app-shell__main flex-grow-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
