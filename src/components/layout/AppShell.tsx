import { Outlet } from "@tanstack/react-router";
import { GlobalSidebar } from "#/components/layout/GlobalSidebar";

export function AppShell() {
  return (
    <div className="app-shell vh-100 overflow-hidden">
      <GlobalSidebar />
      <main className="app-shell__main h-100 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
