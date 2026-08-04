import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { SettingsSidebar } from "#/components/settings/SettingsSidebar";

export const Route = createFileRoute("/_shell/settings")({
  component: CompanySettingsLayout,
  head: () => ({ meta: [{ title: "Company Settings | Buildout Suite" }] }),
});

/**
 * Company settings shell — a page header, then the same two-card split the deal
 * workspace uses: a sticky section-nav card beside the content card. Each
 * section route owns its own layout inside the content card.
 */
function CompanySettingsLayout() {
  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <div className="bg-card border-bottom">
        <div className="container p-4">
          <div className="d-flex align-items-center gap-3">
            <h1 className="fs-3 fw-bold mb-0">Company Settings</h1>
            <Separator orientation="vertical" style={{ height: 24 }} />
            <p className="text-muted mb-0">
              Update your company information and settings.
            </p>
          </div>
        </div>
      </div>

      <div className="container d-flex align-items-start gap-4 py-4">
        {/* Section nav — its own card, grouped by what an admin is changing. */}
        <Card
          className="shadow flex-shrink-0 position-sticky"
          style={{ width: 210, top: 0 }}
        >
          <SettingsSidebar />
        </Card>

        <Card className="flex-grow-1 shadow" style={{ minWidth: 0 }}>
          <Outlet />
        </Card>
      </div>
    </div>
  );
}
