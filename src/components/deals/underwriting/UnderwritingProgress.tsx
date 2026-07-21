import { useEffect, useRef, useState } from "react";
import { Progress, CircularProgress } from "@buildoutinc/blueprint-react/ui/Progress";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCircle } from "@fortawesome/pro-regular-svg-icons";
import { cn } from "@buildoutinc/blueprint-react/lib/utils";
import { checksFor, coerceStrategy } from './strategies'
import type { UnderwritingStrategyId } from './strategies'

/** Total run time for the fake generation, scaled by how many checks were chosen. */
function durationFor(count: number): number {
  const ms = 1800 + count * 650;
  return Math.min(10_000, Math.max(3_000, ms));
}

/**
 * The inline "Cactus is generating your underwriting" experience — a progress
 * bar over a checklist of the selected checks, each one flipping from pending →
 * working (spinner) → done as the fake work advances. The more thorough the
 * underwriting, the more steps and the longer it runs (capped at 10s). Purely
 * client-side theater; there is no real backend.
 */
export function UnderwritingProgress({
  strategy,
  selectedChecks,
  onComplete,
}: {
  strategy?: UnderwritingStrategyId
  selectedChecks: number[]
  onComplete: () => void
}) {
  const checks = checksFor(coerceStrategy(strategy))
  const steps =
    selectedChecks.length > 0
      ? [...selectedChecks]
          .sort((a, b) => a - b)
          .filter((i) => i >= 0 && i < checks.length)
          .map((i) => `Building ${checks[i].label.toLowerCase()}`)
      : ['Assembling underwriting']

  // How many steps have finished. `steps.length` means everything is done.
  const [done, setDone] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const perStep = durationFor(steps.length) / steps.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps.length; i++) {
      timers.push(setTimeout(() => setDone(i), perStep * i));
    }
    // A short beat after the last check lands, hand off to placement.
    timers.push(
      setTimeout(() => onCompleteRef.current(), perStep * steps.length + 500),
    );
    return () => timers.forEach(clearTimeout);
    // Steps are derived once from the selection this run; length is the only knob.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.length]);

  const pct = Math.round((done / steps.length) * 100);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-center gap-2">
        {done < steps.length ? (
          <CircularProgress size="sm" />
        ) : (
          <FontAwesomeIcon icon={faCheck} className="text-accent" />
        )}
        <span className="fw-semibold flex-grow-1">
          {done < steps.length
            ? "Cactus is building your underwriting…"
            : "Underwriting ready"}
        </span>
        <span className="text-muted fs-small">
          {done} of {steps.length}
        </span>
      </div>

      <Progress value={pct} />

      <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
        {steps.map((label, i) => {
          const complete = i < done;
          const active = i === done;
          return (
            <li
              key={label}
              className={cn("d-flex align-items-center gap-2 fs-small", {
                "text-muted": !complete && !active,
              })}
            >
              <span
                className="d-inline-flex align-items-center justify-content-center"
                style={{ width: 20, height: 20 }}
              >
                {complete ? (
                  <FontAwesomeIcon icon={faCheck} className="text-accent" />
                ) : active ? (
                  <CircularProgress size="sm" />
                ) : (
                  <FontAwesomeIcon icon={faCircle} className="text-muted opacity-50" />
                )}
              </span>
              <span className={cn({ "fw-medium": active })}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
