import type { RefObject } from "react";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowUp,
  faBriefcase,
  faEllipsisVertical,
  faFaceSmile,
  faScissors,
  faStop,
} from "@fortawesome/pro-regular-svg-icons";
// Solid, deliberately: at 14px the regular sparkles thin out to a scatter of
// hairlines, and the bar's one purple mark should read at a glance.
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import {
  QUICK_EDITS,
  instructionPlaceholder,
  type FieldTextPhase,
  type QuickEdit,
} from "#/ai/fieldText";

/** Menu glyphs (Figma node 558:15213): a briefcase, a smile, scissors. */
const QUICK_EDIT_ICON: Record<QuickEdit["label"], typeof faBriefcase> = {
  "More Formal": faBriefcase,
  Friendlier: faFaceSmile,
  Shorten: faScissors,
};

/**
 * The instruction bar a field's sparkle reveals beneath it (Figma nodes
 * 557:14534 → 557:14831). One line, one send: what the broker types here is
 * sent once and the answer streams into the field above, so the rail's
 * conversation never learns about it.
 *
 * The end slot holds one control at a time, decided by state rather than by
 * mounting several and hiding some:
 *
 *   - a value in the input → the arrow-up send (557:14550);
 *   - a run in flight → Stop, and the placeholder reads "Generating..." (557:14566);
 *   - the field above has text → the ellipsis of one-click revisions (557:14831),
 *     whether that text was generated or typed by hand — a hand-written note
 *     can be made friendlier just the same.
 *
 * Send and the ellipsis can coexist (a typed instruction over a filled field);
 * Stop always stands alone, so a click meant for it can't land on a revision.
 */
export function FieldInstructionBar({
  inputRef,
  value,
  onChange,
  onSubmit,
  phase,
  onStop,
  hasFieldValue,
  onQuickEdit,
  onClose,
  error,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (value: string) => void;
  /** Send the typed instruction. Only called with a non-blank value while idle. */
  onSubmit: () => void;
  phase: FieldTextPhase;
  /** Cancel the run in flight; whatever has streamed so far stays in the field. */
  onStop: () => void;
  /** Whether the field above holds text — what gates the ellipsis. */
  hasFieldValue: boolean;
  /** A one-click revision from the ellipsis; sent immediately as-is. */
  onQuickEdit: (prompt: string) => void;
  /** Escape: hide the bar and hand focus back to the field. */
  onClose: () => void;
  error?: string | null;
}) {
  const generating = phase === "generating";
  const canSend = !generating && value.trim() !== "";

  return (
    <div className="d-flex flex-column gap-1">
      <div
        className={`field-instruct${generating ? " field-instruct--generating" : ""}`}
        role="group"
        aria-label="AI instruction"
      >
        <FontAwesomeIcon icon={faSparkles} className="field-instruct__icon" />
        <input
          ref={inputRef}
          className="field-instruct__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canSend) onSubmit();
            } else if (e.key === "Escape" && !generating) {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder={instructionPlaceholder(phase, hasFieldValue)}
          aria-label="Describe what the AI should write"
          // Read-only rather than disabled while generating: the placeholder is
          // the status line, and a disabled input greys it out. Typing resumes
          // the moment the run ends.
          readOnly={generating}
          autoComplete="off"
        />
        <div className="field-instruct__end">
          {generating ? (
            <button
              type="button"
              className="field-instruct__btn field-instruct__stop"
              aria-label="Stop generating"
              onClick={onStop}
            >
              <FontAwesomeIcon icon={faStop} />
            </button>
          ) : (
            <>
              {canSend && (
                <button
                  type="button"
                  className="field-instruct__btn field-instruct__send"
                  aria-label="Send instruction"
                  onClick={onSubmit}
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </button>
              )}
              {hasFieldValue && (
                <DropdownMenu>
                  <DropdownMenu.Trigger
                    render={
                      <button
                        type="button"
                        className="field-instruct__btn field-instruct__more"
                        aria-label="Quick edits"
                      >
                        <FontAwesomeIcon icon={faEllipsisVertical} />
                      </button>
                    }
                  />
                  {/* No focus return on close: the trigger is about to be
                      replaced by Stop, and the composer moves focus to the
                      field itself the moment the run starts. */}
                  <DropdownMenu.Content
                    align="end"
                    side="top"
                    sideOffset={6}
                    finalFocus={false}
                  >
                    {QUICK_EDITS.map((q) => (
                      <DropdownMenu.Item key={q.label} onClick={() => onQuickEdit(q.prompt)}>
                        <FontAwesomeIcon icon={QUICK_EDIT_ICON[q.label]} />
                        {q.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu>
              )}
            </>
          )}
        </div>
      </div>
      {error && (
        <div className="fs-small text-danger" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
