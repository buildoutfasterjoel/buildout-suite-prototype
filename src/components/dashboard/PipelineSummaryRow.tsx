import { Fragment } from "react";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Link } from "@tanstack/react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faSatelliteDish,
} from "@fortawesome/pro-regular-svg-icons";
import { PIPELINE_SUMMARY } from "./dashboardData";

export function PipelineSummaryRow() {
  return (
    <Card className="panel-card">
      <Card.Header className="d-flex align-items-center gap-2">
        <Card.Title className="fs-large">Your pipeline</Card.Title>
        <Button
          variant="ghost"
          className="ms-auto"
          nativeButton={false}
          render={
            <Link to="/listings">
              View all deals
              <FontAwesomeIcon icon={faArrowRight} />
            </Link>
          }
        />
      </Card.Header>

      <CardBody className="d-flex align-items-stretch gap-3">
        {PIPELINE_SUMMARY.map((stage, i) => (
          <Fragment key={stage.id}>
            <div
              className={`position-relative flex-fill rounded border p-3 d-flex flex-column gap-1 ${
                stage.accent ? "bg-purple-heart-50 border-primary" : ""
              }`}
            >
              {stage.accent && (
                <FontAwesomeIcon
                  icon={faSatelliteDish}
                  className="position-absolute top-0 end-0 m-2 text-purple-heart-700"
                />
              )}
              <span
                className={
                  stage.accent
                    ? "fs-2 fw-bold text-purple-heart-700"
                    : "fs-2 fw-bold"
                }
                style={{ lineHeight: 1.1 }}
              >
                {stage.count}
              </span>
              <span className="fw-medium">{stage.label}</span>
              <span className="text-muted fs-xs">{stage.subtext}</span>
            </div>
            {i === 0 && (
              <FontAwesomeIcon
                icon={faArrowRight}
                className="text-muted align-self-center"
              />
            )}
          </Fragment>
        ))}
      </CardBody>
    </Card>
  );
}
