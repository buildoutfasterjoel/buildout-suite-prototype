import { Select } from "@buildoutinc/blueprint-react/ui/Select";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHandshake, faCheck, faSparkle } from "@fortawesome/pro-regular-svg-icons";
import type { DealSummary } from "#/data/types";

/**
 * The building blocks of the "log a call" form, shared by the compose module's
 * Call tab and the post-call LogCallModal so the two stay in lockstep.
 */

export const CALL_OUTCOMES = ["Connected", "No Answer", "Left Voicemail", "Bad Number"];

/** An AI ghost button (sparkle) pinned to the top-right of a textarea. */
export function SparkleButton() {
  return (
    <button
      type="button"
      className="compose-sparkle"
      aria-label="Draft with AI"
      onClick={(e) => e.preventDefault()}
    >
      <FontAwesomeIcon icon={faSparkle} />
    </button>
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
