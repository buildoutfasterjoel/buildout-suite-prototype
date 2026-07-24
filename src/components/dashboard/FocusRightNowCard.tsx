import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faHouse,
  faCircleCheck,
} from "@fortawesome/pro-regular-svg-icons";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { FOCUS_SIGNAL } from "./dashboardData";

export function FocusRightNowCard() {
  return (
    <Card className="panel-card bg-purple-heart-50 border border-purple-heart-300">
      <Card.Header className="d-flex align-items-center gap-2 bg-transparent">
        <Card.Title className="fs-large">Focus right now</Card.Title>
        <Badge variant="secondary" appearance="muted" className="fs-xs">
          1
        </Badge>
      </Card.Header>

      <CardBody className="d-flex flex-wrap gap-4">
        <img
          src={getPhotoUrl(FOCUS_SIGNAL.thumbnailId, 96, 96)}
          alt=""
          className="rounded flex-shrink-0"
          style={{ width: 96, height: 96, objectFit: "cover" }}
        />

        <div className="d-flex flex-column gap-2" style={{ flex: "1 1 320px" }}>
          <span
            className="d-inline-flex align-items-center gap-2 text-purple-heart-700 text-uppercase fs-xs fw-semibold"
            style={{ letterSpacing: "0.04em" }}
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} />
            {FOCUS_SIGNAL.kicker}
          </span>
          <span className="fw-bold">{FOCUS_SIGNAL.headline}</span>
          <p className="text-muted mb-0">{FOCUS_SIGNAL.detail}</p>
          <div className="d-flex flex-wrap gap-2">
            <Badge variant="outline" className="fs-xs">
              <FontAwesomeIcon icon={faHouse} />
              {FOCUS_SIGNAL.potentialTag}
            </Badge>
            <Badge variant="outline" className="fs-xs">
              <FontAwesomeIcon icon={faCircleCheck} />
              {FOCUS_SIGNAL.matchTag}
            </Badge>
          </div>
        </div>

        <div
          className="d-flex flex-column gap-2 flex-shrink-0"
          style={{ minWidth: 160 }}
        >
          {/* Visual-only CTAs — no destination exists for this mock signal. */}
          <Button variant="primary">{FOCUS_SIGNAL.primaryCta} →</Button>
          <Button variant="outline">{FOCUS_SIGNAL.secondaryCta}</Button>
        </div>
      </CardBody>
    </Card>
  );
}
