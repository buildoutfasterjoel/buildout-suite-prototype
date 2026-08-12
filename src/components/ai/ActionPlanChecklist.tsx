import { useEffect, useState } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faCircleNotch, faCircle } from "@fortawesome/pro-regular-svg-icons";

/**
 * The work the assistant narrates while it ranks the day. These are the real
 * inputs `buildDayPlan` uses — the pipeline's open tasks, the overnight signal,
 * the overdue sort, then the queue itself — so the checklist describes what
 * actually happened rather than inventing steps.
 */
const STEPS = [
  "Scanning your pipeline + today's tasks",
  "Checking overnight signals + quiet relationships",
  "Scoring by leverage and time-sensitivity",
  "Building your ranked action queue",
];

/** How long each step lingers before the next one lights up. */
const STEP_MS = 700;

/**
 * Progress checklist for "recommend my next actions", in two states: `done: false`
 * ticks the steps off on a timer while the run is in flight, and `done: true` is
 * the settled record that stays in the transcript.
 *
 * The steps are paced by a timer rather than driven by real progress events:
 * `buildDayPlan` is synchronous client-side work that finishes in a millisecond,
 * so there is no genuine multi-stage progress to report. The timer holds on the
 * last step instead of looping, so a slow model response never makes the
 * checklist claim it finished before the queue exists.
 */
export function ActionPlanChecklist({ done, summary }: { done: boolean; summary?: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) return;
    // Stop one short of the end: the final step only completes when the result
    // lands and `done` flips.
    if (step >= STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, done]);

  return (
    <div className="border rounded p-3 bg-white d-flex flex-column gap-2">
      <div className="d-flex align-items-center gap-2">
        <Badge
          variant="secondary"
          appearance="muted"
          // Verified utilities: `bg-success-subtle` and the purple-heart scale
          // both resolve; there is no `bg-green-*` scale in this theme.
          className={done ? "bg-success-subtle" : "bg-purple-heart-200 text-purple-heart-800"}
        >
          {done ? "Done" : "Working…"}
        </Badge>
        <span className="fw-semibold">Recommend my next actions</span>
      </div>

      <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
        {STEPS.map((label, i) => {
          const complete = done || i < step;
          const active = !done && i === step;
          return (
            <li key={label} className="d-flex align-items-start gap-2 small">
              <span className="flex-shrink-0" style={{ width: 16, textAlign: "center" }}>
                {complete ? (
                  <FontAwesomeIcon icon={faCheck} className="text-success" />
                ) : active ? (
                  <FontAwesomeIcon icon={faCircleNotch} spin className="text-purple-heart-600" />
                ) : (
                  <FontAwesomeIcon
                    icon={faCircle}
                    className="text-body-tertiary"
                    style={{ fontSize: "0.5rem" }}
                  />
                )}
              </span>
              <span className={complete || active ? "text-body" : "text-body-tertiary"}>
                {label}
              </span>
            </li>
          );
        })}
      </ul>

      {done && summary && (
        <div className="small text-body border-top pt-2 mb-0">{summary}</div>
      )}
    </div>
  );
}
