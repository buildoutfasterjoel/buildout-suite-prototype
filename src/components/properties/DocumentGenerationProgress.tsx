import { useEffect, useRef, useState } from "react";
import { Progress, CircularProgress } from "@buildoutinc/blueprint-react/ui/Progress";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCircle } from "@fortawesome/pro-regular-svg-icons";
import { cn } from "@buildoutinc/blueprint-react/lib/utils";
import type { SourceFileRef } from "#/data/documentGeneration";

/** Total run time, scaled by how much was fed in and capped so a demo never stalls. */
function durationFor(steps: number): number {
  return Math.min(9_000, Math.max(2_800, 1_400 + steps * 700));
}

/**
 * The faked "AI is reading your files" experience: one step per source file,
 * then extraction, then assembly. Purely client-side theater — there is no
 * backend — but the steps name the broker's actual files so the run reads as
 * being about their deal.
 */
export function DocumentGenerationProgress({
  files,
  sectionCount,
  onComplete,
}: {
  files: SourceFileRef[];
  sectionCount: number;
  onComplete: () => void;
}) {
  const steps = [
    ...files.map((f) => `Reading ${f.name}`),
    "Extracting figures and highlights",
    `Building ${sectionCount} sections`,
  ];

  const [done, setDone] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const perStep = durationFor(steps.length) / steps.length;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= steps.length; i++) {
      timers.push(setTimeout(() => setDone(i), perStep * i));
    }
    timers.push(
      setTimeout(() => onCompleteRef.current(), perStep * steps.length + 500),
    );
    return () => timers.forEach(clearTimeout);
    // Steps are derived once for this run; length is the only knob.
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
          {done < steps.length ? "Building your document…" : "Document ready"}
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
              key={i}
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
