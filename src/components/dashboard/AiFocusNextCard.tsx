import { Card, CardBody } from "@buildoutinc/blueprint-react/ui/Card";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWandMagicSparkles } from "@fortawesome/pro-regular-svg-icons";
import { AI_FOCUS_NEXT } from "./dashboardData";

export function AiFocusNextCard() {
  return (
    <Card className="shadow-sm bg-purple-heart-50 border border-primary">
      <Card.Header className="d-flex align-items-center gap-2 bg-transparent">
        <Card.Title className="fs-large d-inline-flex align-items-center gap-2">
          <FontAwesomeIcon icon={faWandMagicSparkles} />
          AI · Focus next
        </Card.Title>
      </Card.Header>

      <CardBody className="d-flex flex-column gap-3">
        <p className="mb-0">{AI_FOCUS_NEXT.paragraph}</p>
        <div className="d-flex flex-wrap gap-2">
          {/* Visual-only recommendations — no destinations wired up in this mock. */}
          {AI_FOCUS_NEXT.actions.map((action) => (
            <Button key={action} variant="outline" size="sm">
              {action}
            </Button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
