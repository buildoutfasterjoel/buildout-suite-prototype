import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp } from "@fortawesome/pro-regular-svg-icons";

/** Borderless group: a heading (+ optional action) over its content — sections are set apart by gap, not a card. */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <h3 className="fs-large fw-semibold mb-0">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Small KPI tile: muted label, big value, optional +/- delta. */
export function KpiTile({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string | number;
  delta?: number;
  accent?: boolean;
}) {
  return (
    <div
      className="bg-card border rounded h-100 p-3"
      style={{ borderRadius: 6 }}
    >
      <div className="text-muted text-truncate" style={{ fontSize: 13 }}>
        {label}
      </div>
      <div className="d-flex align-items-baseline gap-2 mt-1">
        <span
          className={`fw-bold ${accent ? "text-danger" : ""}`}
          style={{ fontSize: 28, lineHeight: 1 }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={delta > 0 ? "text-success" : "text-danger"}
            style={{ fontSize: 13 }}
          >
            <FontAwesomeIcon icon={delta > 0 ? faArrowUp : faArrowDown} />{" "}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
    </div>
  );
}
