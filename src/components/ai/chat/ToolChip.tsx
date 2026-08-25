import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faScrewdriverWrench, faCircleNotch, faCheck } from "@fortawesome/pro-regular-svg-icons";
import { toolLabel } from "./toolLabel";
import { useToolPhase } from "#/ai/toolPhase";

/**
 * How long a call has to run before it explains itself. Below this a tool is
 * fast enough that a status line would flash on and straight back off, which
 * reads as a glitch rather than as reassurance.
 */
const EXPLAIN_AFTER_MS = 1200;

/**
 * A running (or finished) tool call, as a gradient pill (Figma node 102:3967).
 * The design specifies the in-flight state; a settled call keeps the pill and
 * swaps the spinner for a check, so the chip reads as a completed step rather
 * than one still spinning forever.
 *
 * Under a *slow* call the chip grows a second line saying what the tool is
 * doing and how long it's been at it. A spinner alone only says "running", and
 * the generative tools take long enough — `draft_email` is a whole model call —
 * that a broker reasonably reads a still pill as a hang. Both halves of that
 * line are real: the phase comes from the tool itself (see `toolPhase.ts`) and
 * the seconds are counted, so neither can claim progress that isn't happening.
 * A tool that reports no phase still shows its timer.
 *
 * `labels` is the calling surface's own tool vocabulary — see `toolLabel`.
 */
export function ToolChip({
  name,
  running,
  labels,
}: {
  name: string;
  running: boolean;
  labels?: Record<string, string>;
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

  const explaining = running && elapsedMs >= EXPLAIN_AFTER_MS;

  return (
    <span className="assistant-tool-chip__stack">
      <span className="assistant-tool-chip">
        <FontAwesomeIcon icon={faScrewdriverWrench} className="assistant-tool-chip__icon" />
        {toolLabel(name, labels)}
        <FontAwesomeIcon
          icon={running ? faCircleNotch : faCheck}
          spin={running}
          className="assistant-tool-chip__spinner"
        />
      </span>
      {explaining && (
        <span className="assistant-tool-chip__progress">
          {phase ? `${phase} · ` : ""}
          {Math.floor(elapsedMs / 1000)}s
        </span>
      )}
    </span>
  );
}
