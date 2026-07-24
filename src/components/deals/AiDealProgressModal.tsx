import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faFileMagnifyingGlass,
  faHandshake,
  faSparkle,
  faSpinnerThird,
  faWandMagicSparkles,
} from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

interface AiDealStep {
  icon: IconDefinition;
  label: string;
  /** Muted context line under the label (e.g. the documents being scanned). */
  detail: string;
}

/** How long each step "runs" before completing, in order. */
const STEP_MS = [1900, 1900, 1400];
/** Beat after the last check lands, before the modal closes. */
const DONE_PAUSE_MS = 600;

/**
 * The AI deal-creation progress modal: three sequential steps — scan the
 * attached documents, map what was found to deal fields, create the deal.
 * Purely presentational theater (the real work happens in `onComplete`);
 * not dismissable — it runs ~5s and closes itself.
 */
export function AiDealProgressModal({
  open,
  documents,
  dealLabel,
  onComplete,
}: {
  open: boolean;
  /** The attachment names being "scanned" — shown under the first step. */
  documents: string[];
  /** What's being created — shown under the last step (e.g. "The Delgado Building · Pitching"). */
  dealLabel: string;
  /** Fired once, after the last step completes. The caller creates the deal and closes. */
  onComplete: () => void;
}) {
  // Index of the step currently running; steps below it are done.
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let at = 0;
    STEP_MS.forEach((ms, i) => {
      at += ms;
      timers.push(setTimeout(() => setStep(i + 1), at));
    });
    timers.push(setTimeout(onComplete, at + DONE_PAUSE_MS));
    return () => timers.forEach(clearTimeout);
    // Restart only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const steps: AiDealStep[] = [
    {
      icon: faFileMagnifyingGlass,
      label: "Scanning documents",
      detail: documents.join(" · "),
    },
    {
      icon: faWandMagicSparkles,
      label: "Mapping details to fields",
      detail: "Price, size, income, and property facts",
    },
    {
      icon: faHandshake,
      label: "Creating deal",
      detail: dealLabel,
    },
  ];

  return (
    // Controlled + no-op onOpenChange blocks Escape; disablePointerDismissal
    // blocks outside-click — the modal closes itself when the run finishes.
    <Modal open={open} onOpenChange={() => {}} disablePointerDismissal>
      <Modal.Content centered style={{ maxWidth: "26rem" }}>
        <div className="modal-header">
          <Modal.Title className="d-flex align-items-center gap-2">
            <FontAwesomeIcon
              icon={faSparkle}
              className="ai-deal-progress__title-icon"
            />
            Starting your deal
          </Modal.Title>
        </div>
        <Modal.Body className="d-flex flex-column gap-3 pb-5">
          {steps.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "pending";
            return (
              <div key={s.label} className={`ai-deal-progress__step is-${state}`}>
                <span className="ai-deal-progress__status">
                  {state === "done" ? (
                    <FontAwesomeIcon icon={faCircleCheck} />
                  ) : state === "active" ? (
                    <FontAwesomeIcon icon={faSpinnerThird} spin />
                  ) : (
                    <FontAwesomeIcon icon={s.icon} />
                  )}
                </span>
                <span className="d-flex flex-column">
                  <span className="ai-deal-progress__label">{s.label}</span>
                  <span className="ai-deal-progress__detail">{s.detail}</span>
                </span>
              </div>
            );
          })}
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
}
