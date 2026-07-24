import { useState } from "react";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faHouse,
  faCircleCheck,
  faPhone,
  faSpinner,
} from "@fortawesome/pro-regular-svg-icons";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { generateProspectAssessment } from "#/ai/generate";
import type { ProspectSpecT } from "#/ai/generate/schemas";
import { FOCUS_SIGNAL } from "./dashboardData";

const VERDICT_BADGE_CLASS: Record<ProspectSpecT["verdict"], string> = {
  strong: "text-bg-success",
  moderate: "text-bg-warning",
  challenging: "text-bg-secondary",
};

const VERDICT_LABEL: Record<ProspectSpecT["verdict"], string> = {
  strong: "Strong call",
  moderate: "Moderate call",
  challenging: "Challenging call",
};

export function FocusRightNowCard() {
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<ProspectSpecT | null>(null);

  const assess = async () => {
    setLoading(true);
    try {
      const result = await generateProspectAssessment({
        data: {
          property: {
            name: FOCUS_SIGNAL.headline,
            signal: FOCUS_SIGNAL.detail,
            kicker: FOCUS_SIGNAL.kicker,
            potentialTag: FOCUS_SIGNAL.potentialTag,
            matchTag: FOCUS_SIGNAL.matchTag,
          },
        },
      });
      setAssessment(result);
    } finally {
      setLoading(false);
    }
  };

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

        <div className="w-100 d-flex flex-column gap-2 pt-2 border-top border-purple-heart-300">
          <Button
            variant="outline"
            className="align-self-start"
            onClick={assess}
            disabled={loading}
          >
            <FontAwesomeIcon icon={loading ? faSpinner : faPhone} spin={loading} />
            {loading ? "Assessing…" : "Is this worth a call?"}
          </Button>

          {assessment && (
            <div className="d-flex flex-column gap-1">
              <div className="d-flex align-items-center gap-2">
                <Badge className={VERDICT_BADGE_CLASS[assessment.verdict]}>
                  {VERDICT_LABEL[assessment.verdict]}
                </Badge>
                <span className="fw-bold">{assessment.headline}</span>
              </div>
              <p className="text-muted mb-0">{assessment.reasoning}</p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
