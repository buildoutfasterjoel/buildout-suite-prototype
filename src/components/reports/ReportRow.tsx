import type { ReactNode } from "react";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * One report in either index list — a tinted icon tile, the name, and a line of
 * supporting text. Shared so a saved report and the standard it came from read
 * as the same kind of thing; `meta` is the only slot where they differ.
 *
 * Inert by design in this phase: the card hovers but nothing is wired behind it
 * yet, so it stays a `div` rather than a button that goes nowhere.
 */
export function ReportRow({
  icon,
  title,
  description,
  meta,
}: {
  icon: IconDefinition;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <Card className="shadow-sm report-row">
      <div className="d-flex align-items-start gap-3 p-3">
        <div
          className="flex-shrink-0 d-flex align-items-center justify-content-center rounded report-row__icon"
          style={{ width: 40, height: 40 }}
        >
          <FontAwesomeIcon icon={icon} />
        </div>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold">{title}</div>
          <div className="text-muted small">{description}</div>
          {meta}
        </div>
      </div>
    </Card>
  );
}
