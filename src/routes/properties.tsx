import { Outlet, createFileRoute } from "@tanstack/react-router";
import { GlobalNav } from "#/components/layout/GlobalNav";

export const Route = createFileRoute("/properties")({
  component: PropertiesLayout,
});

function PropertiesLayout() {
  return (
    <div className="d-flex flex-column vh-100 overflow-hidden">
      <GlobalNav />
      <main className="flex-grow-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
