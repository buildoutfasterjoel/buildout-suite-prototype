import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ReportsSidebar } from "#/components/reports/ReportsSidebar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus } from "@fortawesome/pro-regular-svg-icons";

export const Route = createFileRoute("/_shell/reports")({
  component: ReportsLayout,
  head: () => ({ meta: [{ title: "Reports | Buildout Suite" }] }),
});

/**
 * Reports shell — the same full-bleed header band a deal uses, then the
 * sticky section-nav card beside a content card. Each section route owns its
 * own list inside the content card.
 */
function ReportsLayout() {
  return (
    <div className="h-100 overflow-y-auto overflow-x-hidden">
      <div className="bg-card border-bottom">
        <div className="container p-4 d-flex align-items-center gap-3">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <h1 className="fs-4 fw-semibold mb-0">Reports</h1>
            <p className="text-muted mb-0">
              View and analyze data about your company.
            </p>
          </div>
          <Button>
            <FontAwesomeIcon icon={faCirclePlus} />
            New Report
          </Button>
        </div>
      </div>

      <div className="container d-flex align-items-start gap-4 py-4">
        <Card
          className="shadow flex-shrink-0 position-sticky"
          style={{ width: 210, top: 0 }}
        >
          <ReportsSidebar />
        </Card>

        <Card className="flex-grow-1 shadow" style={{ minWidth: 0 }}>
          <Outlet />
        </Card>
      </div>
    </div>
  );
}
