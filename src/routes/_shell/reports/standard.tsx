import { createFileRoute } from "@tanstack/react-router";
import { REPORT_GROUPS } from "#/components/reports/reportCatalog";
import { ReportRow } from "#/components/reports/ReportRow";

export const Route = createFileRoute("/_shell/reports/standard")({
  component: StandardReports,
  head: () => ({ meta: [{ title: "Standard Reports | Buildout Suite" }] }),
});

function StandardReports() {
  return (
    <div className="p-4 d-flex flex-column gap-4">
      {REPORT_GROUPS.map((group) => (
        <section key={group.label}>
          <h2 className="report-row__group-label mb-2">{group.label}</h2>
          <div className="d-flex flex-column gap-2">
            {group.reports.map((report) => (
              <ReportRow
                key={report.id}
                icon={report.icon}
                title={report.title}
                description={report.description}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
