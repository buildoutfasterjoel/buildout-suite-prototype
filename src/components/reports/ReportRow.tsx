import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * One report in either index list — a tinted icon tile, the name, and a line of
 * supporting text. Shared so a saved report and the standard it came from read
 * as the same kind of thing; `meta` is the only slot where they differ.
 *
 * Inert by default: most reports have no page behind them yet, so the card
 * stays a plain `div` rather than a link that goes nowhere. Passing `to` wraps
 * the same card in a `Link` for the reports that do have a page.
 */
export function ReportRow({
  icon,
  title,
  description,
  meta,
  to,
}: {
  icon: IconDefinition;
  title: string;
  description: string;
  meta?: ReactNode;
  to?: LinkProps["to"];
}) {
  const card = (
    <Card className="shadow-sm report-row">
      <div className="d-flex align-items-start gap-3 p-3">
        <div
          className="flex-shrink-0 d-flex align-items-center justify-content-center rounded bg-body"
          style={{ width: 40, height: 40 }}
        >
          <FontAwesomeIcon icon={icon} className="text-primary" />
        </div>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-semibold">{title}</div>
          <div className="text-muted small">{description}</div>
          {meta}
        </div>
      </div>
    </Card>
  );

  if (!to) return card;

  return (
    <Link to={to} className="text-decoration-none d-block">
      {card}
    </Link>
  );
}
