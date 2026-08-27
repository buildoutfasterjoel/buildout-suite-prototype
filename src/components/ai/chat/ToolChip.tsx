import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faScrewdriverWrench,
  faCircleNotch,
  faPencil,
  faListCheck,
  faMagnifyingGlass,
  faFilter,
} from "@fortawesome/pro-regular-svg-icons";
import { toolLabel, toolDoneLabel } from "./toolLabel";
import { useToolPhase } from "#/ai/toolPhase";

/**
 * How long a call has to run before it explains itself. Below this a tool is
 * fast enough that a status line would flash on and straight back off, which
 * reads as a glitch rather than as reassurance.
 */
const EXPLAIN_AFTER_MS = 1200;

/**
 * What the running tool is *doing*, as a glyph — writing, ranking, reading
 * (Figma node 253:18581 uses a pencil for "Writing the draft").
 *
 * Mapped from the tool name here rather than reported alongside the phase, so
 * `toolPhase.ts` stays a store of plain strings and the tool implementations
 * don't have to import FontAwesome to describe themselves.
 */
const PHASE_ICONS: Record<string, IconDefinition> = {
  draft_email: faPencil,
  build_marketing_package: faPencil,
  generate_doc: faPencil,
  build_call_list: faListCheck,
  research_contact: faMagnifyingGlass,
  answer_about_contact: faMagnifyingGlass,
  brief: faMagnifyingGlass,
  analyze_book: faMagnifyingGlass,
  filter_listings: faFilter,
};

/**
 * A running tool call, as a gradient pill (Figma node 102:3967).
 *
 * The moment it lands the pill is gone, replaced by one muted past-tense line —
 * "Retrieved contact details" — in the same voice as a `ChatSection` header
 * (`.assistant-section__label`), minus the caret, because there is nothing
 * folded behind it to open.
 *
 * The pill earns its colour by being *live*: it is the one thing on screen the
 * broker is waiting on. A settled call is bookkeeping, and keeping the gradient
 * and a check on it left a colourful badge drawing the eye to a step that had
 * already finished, over the answer it produced. The line still says what
 * happened; it just stops competing with the reply for attention.
 *
 * Under a *slow* call the chip drops a connector and a status line saying what
 * the tool is doing and how long it's been at it (Figma node 252:18531). A
 * spinner alone only says "running", and the generative tools take long enough —
 * `draft_email` is a whole model call — that a broker reasonably reads a still
 * pill as a hang. Both halves of that line are real: the phase comes from the
 * tool itself (see `toolPhase.ts`) and the seconds are counted, so neither can
 * claim progress that isn't happening. A tool that reports no phase still shows
 * its timer.
 *
 * `labels` is the calling surface's own tool vocabulary — see `toolLabel`.
 */
export function ToolChip({
  name,
  running,
  labels,
  doneLabels,
}: {
  name: string;
  running: boolean;
  labels?: Record<string, string>;
  /** The surface's past-tense vocabulary, for the settled line — see
   *  `toolDoneLabel`. */
  doneLabels?: Record<string, string>;
}) {
  const phase = useToolPhase((s) => s.phases[name]);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now();
    setElapsedMs(0);
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [running]);

  // A landed call is a line of prose, not a control. `<div>`, like the other
  // `.assistant-section__label` users, so a run of them stacks on its own
  // without the chip row having to know which state each child is in.
  if (!running) {
    return <div className="assistant-section__label">{toolDoneLabel(name, doneLabels, labels)}</div>;
  }

  const explaining = elapsedMs >= EXPLAIN_AFTER_MS;

  return (
    <span className="assistant-tool-chip__stack">
      <span className="assistant-tool-chip">
        <FontAwesomeIcon icon={faScrewdriverWrench} className="assistant-tool-chip__icon" />
        {toolLabel(name, labels)}
        <FontAwesomeIcon icon={faCircleNotch} spin className="assistant-tool-chip__spinner" />
      </span>

      {explaining && (
        <>
          {/* Ties the status line back to the chip it belongs to, so a second
              tool starting underneath can't look like it owns this line. */}
          <span className="assistant-tool-chip__connector" aria-hidden="true" />
          <span className="assistant-tool-chip__progress-row">
            <span className="assistant-tool-chip__progress-icon">
              <FontAwesomeIcon icon={PHASE_ICONS[name] ?? faPencil} />
            </span>
            {/* Polite: the phase changes under a broker who may not be looking at
                it, and a running commentary read out on every tick would be
                worse than silence. */}
            <span className="assistant-tool-chip__progress" aria-live="polite">
              {phase ? `${phase} • ` : ""}
              {Math.floor(elapsedMs / 1000)}s
            </span>
          </span>
        </>
      )}
    </span>
  );
}
