import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookmark, faChartSimple } from "@fortawesome/pro-regular-svg-icons";
import { REPORTS_BY_ID } from "#/components/reports/reportCatalog";
import { SAVED_REPORTS, formatLastRun } from "#/components/reports/savedReports";
import { ReportRow } from "#/components/reports/ReportRow";

export const Route = createFileRoute("/_shell/reports/my-reports")({
  component: MyReports,
  head: () => ({ meta: [{ title: "My Reports | Buildout Suite" }] }),
});

function MyReports() {
  if (SAVED_REPORTS.length === 0) {
    return (
      <div className="p-5 d-flex justify-content-center">
        <Empty>
          <Empty.Media>
            <FontAwesomeIcon icon={faBookmark} aria-label="No saved reports" />
          </Empty.Media>
          <Empty.Content>
            <Empty.Title>No saved reports yet</Empty.Title>
            Run a standard report with filters applied and save it here to reuse
            the same view later.
          </Empty.Content>
        </Empty>
      </div>
    );
  }

  return (
    <div className="p-4 d-flex flex-column gap-2">
      {SAVED_REPORTS.map((saved) => {
        const base = REPORTS_BY_ID.get(saved.baseReportId);
        return (
          <ReportRow
            key={saved.id}
            icon={base?.icon ?? faChartSimple}
            title={saved.name}
            description={`${base?.title ?? "Custom report"} · Saved by ${saved.owner} · Last run ${formatLastRun(saved.lastRunAt)}`}
            meta={
              <div className="d-flex flex-wrap gap-1 mt-2">
                {saved.filters.map((filter) => (
                  <Badge key={filter} variant="secondary" appearance="muted">
                    {filter}
                  </Badge>
                ))}
              </div>
            }
          />
        );
      })}
    </div>
  );
}
