import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { ReportShell } from "#/components/reports/ReportShell";
import { PipelineReportTable } from "#/components/reports/pipeline/PipelineReportTable";
import { PipelineFilterBar } from "#/components/reports/pipeline/PipelineFilterBar";
import { PipelineFilterModal } from "#/components/reports/pipeline/PipelineFilterModal";
import { pipelineRows } from "#/components/reports/pipeline/pipelineRows";
import {
  EMPTY_PIPELINE_FILTERS,
  applyPipelineFilters,
} from "#/components/reports/pipeline/pipelineFilters";
import { DASHBOARD_TODAY } from "#/components/dashboard/dashboardData";
import { useDataStore } from "#/data/dataStore";

export const Route = createFileRoute("/_shell/reports_/pipeline")({
  component: PipelineReport,
  head: () => ({ meta: [{ title: "Pipeline Report | Buildout Suite" }] }),
});

function PipelineReport() {
  const listings = useDataStore((s) => s.listings);
  const [filters, setFilters] = useState(EMPTY_PIPELINE_FILTERS);
  const [allOpen, setAllOpen] = useState(false);

  const rows = useMemo(() => pipelineRows([...listings.values()]), [listings]);

  // Options come from the data actually in the report, so a filter can never
  // offer a value that matches nothing.
  const offices = useMemo(
    () => [...new Set(rows.map((r) => r.office).filter((o): o is string => !!o))].sort(),
    [rows],
  );
  const brokers = useMemo(
    () => [...new Set(rows.flatMap((r) => r.brokers).filter((b): b is string => !!b))].sort(),
    [rows],
  );

  const filtered = useMemo(
    () => applyPipelineFilters(rows, filters, DASHBOARD_TODAY),
    [rows, filters],
  );

  return (
    <ReportShell title="Pipeline Report">
      <Card className="shadow">
        <div className="p-4 d-flex flex-column gap-3">
          <PipelineFilterBar
            filters={filters}
            onChange={setFilters}
            onOpenAll={() => setAllOpen(true)}
          />
          <PipelineReportTable rows={filtered} />
        </div>
      </Card>

      <PipelineFilterModal
        open={allOpen}
        onOpenChange={setAllOpen}
        filters={filters}
        onChange={setFilters}
        offices={offices}
        brokers={brokers}
      />
    </ReportShell>
  );
}
