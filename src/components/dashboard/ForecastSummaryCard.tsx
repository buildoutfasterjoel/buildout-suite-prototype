import { useMemo } from "react";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight } from "@fortawesome/pro-regular-svg-icons";
import { getStore } from "#/data/store";
import { isUmbrella } from "#/data/leaseSpaces";
import { commissionForecast } from "#/data/commission";
import { formatPrice } from "#/components/properties/propertyDisplay";
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
  // Umbrella (parent) deals are shells that hold child space listings — the
  // children are the real deals and carry their own commission, so exclude the
  // parent from the forecast to avoid double-counting the building.
  const commission = useMemo(
    () =>
      commissionForecast(
        [...getStore().listings.values()].filter((l) => !isUmbrella(l.id)),
      ),
    [],
  );

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
          <span
            className="text-muted fs-xs text-uppercase"
            style={{ letterSpacing: "0.04em" }}
          >
            Commission forecast
          </span>
          <div className="d-flex align-items-baseline gap-4 mt-1">
            <div className="d-flex flex-column">
              <span className="fs-2 fw-bold" style={{ lineHeight: 1.1 }}>
                {formatPrice(commission.you)}
              </span>
              <span className="text-muted">You</span>
            </div>
            <Separator orientation="vertical" />
            <div className="d-flex flex-column">
              <span className="fs-2 fw-bold" style={{ lineHeight: 1.1 }}>
                {formatPrice(commission.brokerage)}
              </span>
              <span className="text-muted">Brokerage</span>
            </div>
          </div>
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
