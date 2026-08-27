import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircle } from "@fortawesome/pro-regular-svg-icons";
// Solid, deliberately — same reason as the day plan's checklist: at 13px the
// regular check-in-a-circle reads as two hairlines.
import { faCircleCheck, faCircleNotch } from "@fortawesome/pro-solid-svg-icons";
import { ChatSection } from "#/components/ai/chat/ChatSection";

/** What the assistant read, mapped, and wrote — returned by the `createDeal` tool. */
export interface DealBuildData {
  /** Files scanned, by name. Empty when the deal was built from the record alone. */
  documents: string[];
  /** What got created, e.g. "The Delgado Building · Pitching". */
  label: string;
  /** Where the facts came from when there were no documents to read. */
  source: string;
}

/** How long each step lingers before the next lights up. */
const STEP_MS = 650;

function TaskRow({ label, detail, state }: { label: string; detail: string; state: "pending" | "running" | "done" }) {
  return (
    <li className="assistant-task-row assistant-task-row--stacked">
      <span className="assistant-task-row__status">
        {state === "done" ? (
          <FontAwesomeIcon icon={faCircleCheck} className="assistant-task-row__check" />
        ) : state === "running" ? (
          <FontAwesomeIcon icon={faCircleNotch} spin className="assistant-task-row__spinner" />
        ) : (
          <FontAwesomeIcon icon={faCircle} className="assistant-task-row__pending" />
        )}
      </span>
      <span className="assistant-task-row__body">
        <span className={`assistant-task-row__label assistant-task-row__label--${state}`}>
          {label}
        </span>
        <span className="assistant-task-row__detail">{detail}</span>
      </span>
    </li>
  );
}

/**
 * The three steps the AI deal-creation modal shows — scan the documents, map
 * what was found to deal fields, create the deal — replayed inside the
 * transcript when the deal is started from the assistant instead.
 *
 * The two paths were doing the same work and saying different amounts about
 * it: acting on Rosa's email from her timeline walked the broker through the
 * scan, while asking Otto for the same deal produced a card and a sentence.
 * Same steps, same wording (see `AiDealProgressModal`), so the rail isn't a
 * quieter, less trustworthy way to do it.
 *
 * Unlike the modal, this runs *after* the fact — the tool has already created
 * the deal by the time the result reaches the transcript — so the rows tick
 * through once and then fold to a single line. It is a record of what Otto did,
 * not a gate the broker waits behind.
 */
export function DealBuildChecklist({ build }: { build: DealBuildData }) {
  const steps = [
    {
      label: "Scanning documents",
      detail: build.documents.length ? build.documents.join(" · ") : build.source,
    },
    {
      label: "Mapping details to fields",
      detail: "Price, size, income, and property facts",
    },
    { label: "Creating deal", detail: build.label },
  ];

  const [step, setStep] = useState(0);
  const done = step >= steps.length;

  useEffect(() => {
    if (step >= steps.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
    // Only the counter drives this; `steps` is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const rows = (
    <ul className="assistant-task-list">
      {steps.map((s, i) => (
        <TaskRow
          key={s.label}
          label={s.label}
          detail={s.detail}
          state={i < step ? "done" : i === step ? "running" : "pending"}
        />
      ))}
    </ul>
  );

  // Folded once it finishes, like the day plan's checklist: the deal card below
  // is the result, and the steps that produced it are worth keeping but not
  // worth the space.
  if (done) {
    return (
      <ChatSection label="Started your deal" defaultOpen={false}>
        {rows}
      </ChatSection>
    );
  }

  return (
    <div className="d-flex flex-column" style={{ gap: 12 }}>
      <div className="assistant-section__label">Starting your deal</div>
      {rows}
    </div>
  );
}
