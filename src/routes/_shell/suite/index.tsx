import { createFileRoute } from "@tanstack/react-router";
import { ForecastSummaryCard } from "#/components/dashboard/ForecastSummaryCard";
import { PipelineSummaryRow } from "#/components/dashboard/PipelineSummaryRow";
import { FocusRightNowCard } from "#/components/dashboard/FocusRightNowCard";
import { DashboardTasksSection } from "#/components/dashboard/DashboardTasksSection";
import { YourListingsSection } from "#/components/dashboard/YourListingsSection";
import { AiFocusNextCard } from "#/components/dashboard/AiFocusNextCard";
import { RecentActivitySection } from "#/components/dashboard/RecentActivitySection";
import { DASHBOARD_TODAY } from "#/components/dashboard/dashboardData";

export const Route = createFileRoute("/_shell/suite/")({
  component: SuiteHome,
  head: () => ({
    meta: [{ title: "Home | Buildout Suite" }],
  }),
});

const FORMATTED_TODAY = DASHBOARD_TODAY.toLocaleDateString("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

function SuiteHome() {
  return (
    <div className="d-flex flex-column h-100 overflow-auto">
      <div className="border-bottom bg-card">
        <div className="container py-4">
          <h1 className="fs-4 fw-semibold mb-0">Good afternoon, Ethan</h1>
          <span className="text-muted">{FORMATTED_TODAY}</span>
        </div>
      </div>

      <div className="container p-5 d-flex flex-column gap-4">
        <ForecastSummaryCard />
        <PipelineSummaryRow />
        <FocusRightNowCard />
        <DashboardTasksSection />
        <YourListingsSection />
        <AiFocusNextCard />
        <RecentActivitySection />
      </div>
    </div>
  );
}
