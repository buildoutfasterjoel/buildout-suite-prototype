import { useNavigate } from "@tanstack/react-router";
import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWandMagicSparkles,
  faHouse,
  faCircleCheck,
  faPhone,
} from "@fortawesome/pro-regular-svg-icons";
import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import { getContactByHeroKey } from "#/data/store";
import { callFlow } from "#/components/call/callFlow";
import { notify } from "#/lib/notify";
import { FOCUS_SIGNAL } from "./dashboardData";

export function FocusRightNowCard() {
  const navigate = useNavigate();

  /** The live contact this signal is about (e.g. Rosa). */
  const signalContact = () => getContactByHeroKey(FOCUS_SIGNAL.heroKey);

  const openRecord = () => {
    const c = signalContact();
    if (!c) return;
    void navigate({
      to: "/backoffice/contacts/$contactId",
      params: { contactId: c.id },
    });
  };

  // Start the live call and land on the contact's page so the call bar + arc
  // play out over their record (calls from the AI do the same — see tools.ts).
  const callContact = () => {
    const c = signalContact();
    if (!c) {
      notify({ title: "Contact unavailable", description: FOCUS_SIGNAL.headline });
      return;
    }
    callFlow.open(c);
    void navigate({
      to: "/backoffice/contacts/$contactId",
      params: { contactId: c.id },
    });
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
          <Button variant="primary" onClick={callContact}>
            <FontAwesomeIcon icon={faPhone} />
            {FOCUS_SIGNAL.primaryCta}
          </Button>
          <Button variant="outline" onClick={openRecord}>
            {FOCUS_SIGNAL.secondaryCta}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
