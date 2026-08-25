import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/pro-regular-svg-icons";
// Solid, deliberately: at 13px the regular check-in-a-circle reads as two
// hairlines, and the whole point of the finished row is that it's unmistakable.
import { faCircleCheck, faCircleNotch } from "@fortawesome/pro-solid-svg-icons";
import { ChatSection } from "#/components/ai/chat/ChatSection";

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

/** One row: an empty circle, a spinner, or a struck-through green check. */
function TaskRow({ label, state }: { label: string; state: "pending" | "running" | "done" }) {
  return (
    <li className="assistant-task-row">
      <span className="assistant-task-row__status">
        {state === "done" ? (
          <FontAwesomeIcon icon={faCircleCheck} className="assistant-task-row__check" />
        ) : state === "running" ? (
          <FontAwesomeIcon icon={faCircleNotch} spin className="assistant-task-row__spinner" />
        ) : (
          <FontAwesomeIcon icon={faCircle} className="assistant-task-row__pending" />
        )}
      </span>
      <span className={`assistant-task-row__label assistant-task-row__label--${state}`}>
        {label}
      </span>
    </li>
  );
}

/**
 * Progress list for "recommend my next actions" (Figma nodes 193:9074, 193:8991,
 * 193:9001), in two states.
 *
 * **Running** — a bare header over ticking rows. No card: this is Otto showing
 * its working, and boxing it gave a transient progress readout the same visual
 * weight as the answer it was on the way to.
 *
 * **Finished** — the whole thing folds to a single muted line, "Recommended next
 * actions", which opens to the struck-through record of what ran. The result
 * that matters is the Next Actions card below it, not the steps that produced it.
 *
 * The steps are paced by a timer rather than driven by real progress events:
 * `buildDayPlan` is synchronous client-side work that finishes in a millisecond,
 * so there is no genuine multi-stage progress to report. The timer holds on the
 * last step instead of looping, so a slow model response never makes the
 * checklist claim it finished before the queue exists.
 */
export function ActionPlanChecklist({ done }: { done: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (done) return;
    // Stop one short of the end: the final step only completes when the result
    // lands and `done` flips.
    if (step >= STEPS.length - 1) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, done]);

  const rows = (
    <ul className="assistant-task-list">
      {STEPS.map((label, i) => (
        <TaskRow
          key={label}
          label={label}
          state={done || i < step ? "done" : i === step ? "running" : "pending"}
        />
      ))}
    </ul>
  );

  if (done) {
    return (
      <ChatSection label="Recommended next actions" defaultOpen={false}>
        {rows}
      </ChatSection>
    );
  }

  return (
    <div className="d-flex flex-column" style={{ gap: 12 }}>
      {/* Present tense while it runs, past tense once folded — the header is the
          same line of copy doing two jobs. */}
      <div className="assistant-section__label">Recommending next actions</div>
      {rows}
    </div>
  );
}
