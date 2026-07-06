import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/pro-regular-svg-icons";
import { FORECAST } from "./dashboardData";

function StatCard({ label, value }: { label: string; value: string }) {
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
    </div>
  );
}

export function ForecastSummaryCard() {
  return (
    <Card className="shadow-sm">
      <Card.Header className="d-flex align-items-center gap-2">
        <Card.Title className="fs-large">Forecast</Card.Title>
        <Button
          variant="ghost"
          className="ms-auto"
          nativeButton={false}
          render={
            <Link to="/listings">
              View pipeline
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          }
        />
      </Card.Header>
      <CardBody className="d-flex flex-wrap align-items-center gap-6">
        <div className="d-flex flex-column">
          <span className="fs-2 fw-bold" style={{ lineHeight: 1.1 }}>
            {FORECAST.weightedTotal}
          </span>
          <span className="text-muted">Weighted pipeline forecast</span>
        </div>

        <Separator orientation="vertical" className="d-none d-md-block" />

        <div className="d-flex flex-wrap align-items-stretch gap-6 ms-md-auto">
          <StatCard label="Open pipeline" value={FORECAST.openPipeline} />
          <Separator orientation="vertical" />
          <StatCard label="Open deals" value={String(FORECAST.openDeals)} />
          <Separator orientation="vertical" />
          <StatCard label="Closed" value={FORECAST.closedValue} />
        </div>
      </CardBody>
    </Card>
  );
}
