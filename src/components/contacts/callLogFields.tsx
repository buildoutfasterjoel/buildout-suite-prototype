import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake, faCheck, faSparkle } from "@fortawesome/pro-regular-svg-icons";
import type { DealSummary } from "#/data/types";

/**
 * The building blocks of the "log a call" form, used by the compose module's
 * Call tab.
 */

export const CALL_OUTCOMES = ["Connected", "No Answer", "Left Voicemail", "Bad Number"];

/**
 * An AI ghost button (sparkle) pinned to the top-right of a textarea — the one
 * per-field entrance in the "ask at the rail, review at the field" grammar.
 *
 * The label is the whole affordance: an unlabelled sparkle asks the broker to
 * guess whether clicking it writes something, replaces something, or opens a
 * menu. Named on hover ("Generate Note" on an empty field, "Revise" once there
 * is a value) it says what the click does before the click happens.
 *
 * Unwired without `onClick` — the sparkle exists on several composer tabs and
 * only the Note field is hooked up so far, and a tooltip promising "Generate"
 * over a button that does nothing is worse than a quiet icon.
 */
export function SparkleButton({
  label,
  onClick,
}: {
  /** Hover/focus label. Omit to leave the button unlabelled and inert. */
  label?: string;
  onClick?: () => void;
}) {
  const button = (
    <button
      type="button"
      className="compose-sparkle"
      aria-label={label ?? "Draft with AI"}
      onClick={(e) => {
        // The composer is inside a form on some surfaces; this is never a submit.
        e.preventDefault();
        onClick?.();
      }}
    >
      <FontAwesomeIcon icon={faSparkle} />
    </button>
  );

  if (!label) return button;

  return (
    <Tooltip.Provider delay={150}>
      <Tooltip>
        <Tooltip.Trigger render={button} />
        <Tooltip.Content>{label}</Tooltip.Content>
      </Tooltip>
    </Tooltip.Provider>
  );
}

/** The call-outcome chip row (Connected / No Answer / …), single-select. */
export function OutcomeChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="d-flex flex-wrap gap-2">
      {CALL_OUTCOMES.map((o) => (
        <button
          key={o}
          type="button"
          className={`compose-outcome-chip ${value === o ? "is-active" : ""}`}
          onClick={() => onChange(o)}
        >
          {value === o && <FontAwesomeIcon icon={faCheck} />}
          {o}
        </button>
      ))}
    </div>
  );
}

/** The "Select a related Deal" control — hugs its label rather than stretching. */
export function RelatedDealSelect({
  deals,
  value,
  onChange,
}: {
  deals: DealSummary[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <Select.Trigger className="compose-deal-select" aria-label="Related deal">
        <FontAwesomeIcon icon={faHandshake} className="text-muted" />
        <Select.Value placeholder="Select a related Deal" />
      </Select.Trigger>
      <Select.Content>
        {deals.length === 0 ? (
          <Select.Item value="" disabled>
            No related deals
          </Select.Item>
        ) : (
          deals.map((d) => (
            <Select.Item key={d.id} value={d.name}>
              {d.name}
            </Select.Item>
          ))
        )}
      </Select.Content>
    </Select>
  );
}
