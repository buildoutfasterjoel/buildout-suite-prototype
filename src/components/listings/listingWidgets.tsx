import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp } from "@fortawesome/pro-regular-svg-icons";

/** Card shell with a title header (+ optional action) and padded body. */
export function SectionCard({
  title,
  action,
  children,
  bodyClassName = "p-4",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="bg-card border rounded h-100" style={{ borderRadius: 6 }}>
      <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
        <h2 className="fs-6 fw-semibold mb-0">{title}</h2>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
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
