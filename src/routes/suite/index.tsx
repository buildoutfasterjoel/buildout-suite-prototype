import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { PipelineStepper } from "#/components/pipeline/PipelineStepper";
import { SubStagePanel } from "#/components/pipeline/SubStagePanel";
import { NeedsAttentionSection } from "#/components/pipeline/NeedsAttentionSection";
import {
  PIPELINE_STAGES,
  MOCK_DEALS,
  formatValue,
} from "#/components/pipeline/pipelineData";
import { ACTION_ITEMS } from "#/components/pipeline/actionItemsData";
import { getStore } from "#/data/store";

export const Route = createFileRoute("/suite/")({
  component: SuiteDashboard,
  head: () => ({
    meta: [{ title: "Pipeline Dashboard | Buildout Suite" }],
  }),
});

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="d-flex flex-column">
      <span
        className="text-muted fs-xs text-uppercase"
        style={{ letterSpacing: "0.04em" }}
      >
        {label}
      </span>
      <span className="fw-semibold mt-1 fs-5" style={{ lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && <span className="text-muted fs-xs">{sub}</span>}
    </div>
  );
}

function SuiteDashboard() {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  // Each pipeline card opens a real seeded listing (which is its deal, 1:1) so the
  // pipeline and the listing workspace share one place. Pipeline stages are untouched.
  const dealsWithLinks = useMemo(() => {
    const listingIds = [...getStore().listings.keys()];
    return MOCK_DEALS.map((d, i) => ({
      ...d,
      listingId: listingIds.length ? listingIds[i % listingIds.length] : undefined,
    }));
  }, []);

  // Track the active sub-stage per stage independently
  const [subStageSelections, setSubStageSelections] = useState<
    Record<string, string>
  >(() =>
    Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, s.subStages[0].id])),
  );

  const totalDeals = PIPELINE_STAGES.reduce((sum, s) => sum + s.dealCount, 0);
  const totalValue = PIPELINE_STAGES.reduce((sum, s) => sum + s.totalValue, 0);
  const avgDays = Math.round(
    dealsWithLinks.reduce((sum, d) => sum + d.daysInStage, 0) /
      dealsWithLinks.length,
  );
  const activeListings =
    PIPELINE_STAGES.find((s) => s.id === "listing-mktg")?.dealCount ?? 0;
  const closingThisMonth =
    PIPELINE_STAGES.find((s) => s.id === "close-press")?.dealCount ?? 0;

  function handleStageSelect(stageId: string) {
    setSelectedStageId((prev) => (prev === stageId ? null : stageId));
  }

  function handleSubStageSelect(stageId: string, subStageId: string) {
    setSubStageSelections((prev) => ({ ...prev, [stageId]: subStageId }));
  }

  function dealsForStage(stageId: string) {
    return dealsWithLinks.filter((d) => d.stageId === stageId);
  }

  const stagesToShow = selectedStageId
    ? PIPELINE_STAGES.filter((s) => s.id === selectedStageId)
    : PIPELINE_STAGES;

  return (
    <div className="d-flex flex-column h-100 overflow-hidden">
      {/* Page header */}
      <div className="px-5 py-4 border-bottom bg-white">
        <div className="d-flex align-items-baseline gap-3">
          <h1 className="fs-4 fw-semibold mb-0">Pipeline</h1>
          <span className="text-muted">
            Brokerage deal lifecycle &middot; {totalDeals} active deals
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="px-5 py-3 border-bottom d-flex flex-wrap align-items-stretch bg-card gap-6">
        <StatCard
          label="Total pipeline value"
          value={formatValue(totalValue)}
          sub="across all stages"
        />
        <div className="vr h-100" />
        <StatCard label="Avg. days in stage" value={`${avgDays}d`} />
        <div className="vr h-100" />
        <StatCard
          label="Active listings"
          value={String(activeListings)}
          sub="in marketing"
        />
        <div className="vr h-100" />
        <StatCard
          label="Closing this month"
          value={String(closingThisMonth)}
          sub="scheduled"
        />
      </div>

      {/* Main scrollable area */}
      <div className="flex-grow-1 overflow-auto p-5">

        {/* Pipeline stepper — full width */}
        <Card className="shadow-sm mb-4">
          <CardBody>
            <PipelineStepper
              stages={PIPELINE_STAGES}
              selectedStageId={selectedStageId}
              onStageSelect={handleStageSelect}
            />
          </CardBody>
        </Card>

        {/* Two-column layout: pipeline detail (left) + needs attention (right) */}
        <div className="row g-4 align-items-start">
          <div className="col-8">
            <Card className="shadow-sm">
              {stagesToShow.map((stage) => (
                <SubStagePanel
                  key={stage.id}
                  stage={stage}
                  deals={dealsForStage(stage.id)}
                  selectedSubStageId={subStageSelections[stage.id]}
                  onSubStageSelect={(id) => handleSubStageSelect(stage.id, id)}
                  onStageClick={
                    selectedStageId ? undefined : () => handleStageSelect(stage.id)
                  }
                />
              ))}
            </Card>
          </div>
          <div className="col-4">
            <NeedsAttentionSection items={ACTION_ITEMS} />
          </div>
        </div>

      </div>
    </div>
  );
}
