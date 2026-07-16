import { useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Separator } from "@buildoutinc/blueprint-react/ui/Separator";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/pro-solid-svg-icons";
import { faCircle } from "@fortawesome/pro-regular-svg-icons";
import {
  faChevronDown,
  faChevronRight,
} from "@fortawesome/pro-regular-svg-icons";
import "./UnderwritingDepth.scss";

// The underwriting checks, in the order they turn on as the slider advances.
// Rendered row-major into a two-column grid (left→right, top→bottom).
const CHECKS = [
  "Rent roll summary",
  "Net operating income",
  "T-12 operating statement",
  "Cap rate & DSCR",
  "Sales comparables",
  "Rent comparables",
  "Cash flow projection",
  "Tenant credit review",
  "Lease abstraction",
  "Market & demographics",
  "Environmental (Phase I)",
  "Sensitivity & stress test",
] as const;

const TOTAL = CHECKS.length; // 12

// Four depth tiers, one per band of three selected checks.
function tierForCount(count: number): string {
  if (count <= 3) return "Rapid Screen";
  if (count <= 6) return "Standard";
  if (count <= 9) return "Deep Dive";
  return "Institutional";
}

/**
 * Underwriting depth control for the Approve & Publish gate. Visual-only for
 * this phase: the slider selects the first N of 12 checks and swaps a tier
 * badge, but drives no data and does not affect publishing.
 */
export function UnderwritingDepth() {
  // The set of selected check indices. The slider and the individual check
  // toggles both drive this: dragging selects the first N in order, clicking a
  // check toggles just that one. Default is the first 6 (Standard).
  const [selectedSet, setSelectedSet] = useState<Set<number>>(
    () => new Set([0, 1, 2, 3, 4, 5]),
  );
  const [checksOpen, setChecksOpen] = useState(false);

  const count = selectedSet.size;
  const tier = count === 0 ? "None" : tierForCount(count);

  // Percent filled, used to color the slider track up to the thumb.
  const fillPct = (count / TOTAL) * 100;

  // Dragging the slider selects the first N checks in order.
  function setDepth(n: number) {
    setSelectedSet(new Set(Array.from({ length: n }, (_, i) => i)));
  }

  // Clicking a check toggles just that one (selection may be non-contiguous).
  function toggleCheck(i: number) {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="underwriting-depth border rounded p-3">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
        <span className="fw-semibold">Underwriting depth</span>
        <Badge
          key={tier}
          variant="secondary"
          appearance={count === 0 ? "muted" : "accent"}
          className="underwriting-depth__badge"
        >
          {tier}
        </Badge>
      </div>

      <p className="fs-small text-muted mb-3">
        Set how thorough the underwriting is. Slide, or pick the checks you want
        below.
      </p>

      <div className="d-flex justify-content-between fs-small text-muted mb-1">
        <span>Fast</span>
        <span>Thorough</span>
      </div>
      <input
        type="range"
        className="underwriting-depth__slider"
        min={0}
        max={TOTAL}
        step={1}
        value={count}
        onChange={(e) => setDepth(Number(e.target.value))}
        aria-label="Underwriting depth"
        style={{ "--fill": `${fillPct}%` } as React.CSSProperties}
      />

      <Separator className="my-3" />

      <div className="d-flex align-items-center justify-content-between gap-2">
        <button
          type="button"
          className="underwriting-depth__toggle"
          onClick={() => setChecksOpen((o) => !o)}
        >
          <FontAwesomeIcon icon={checksOpen ? faChevronDown : faChevronRight} />
          {checksOpen ? "Hide checks" : "Show checks"}
        </button>
        <span className="fs-small text-muted">
          <span className="fw-semibold text-body">{count}</span> of {TOTAL}
        </span>
      </div>

      {checksOpen && (
        <div className="underwriting-depth__checks mt-3">
          {CHECKS.map((label, i) => {
            const on = selectedSet.has(i);
            return (
              <button
                type="button"
                key={label}
                className={`underwriting-depth__check${on ? " is-on" : ""}`}
                onClick={() => toggleCheck(i)}
                aria-pressed={on}
              >
                <span className="underwriting-depth__check-icon">
                  <FontAwesomeIcon icon={faCircle} className="uw-icon uw-icon--off" />
                  <FontAwesomeIcon icon={faCircleCheck} className="uw-icon uw-icon--on" />
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
