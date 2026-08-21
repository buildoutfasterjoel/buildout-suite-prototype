import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faScrewdriverWrench, faCircleNotch, faCheck } from "@fortawesome/pro-regular-svg-icons";
import { toolLabel } from "./toolLabel";

/**
 * A running (or finished) tool call, as a gradient pill (Figma node 102:3967).
 * The design specifies the in-flight state; a settled call keeps the pill and
 * swaps the spinner for a check, so the chip reads as a completed step rather
 * than one still spinning forever.
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
  return (
    <span className="assistant-tool-chip">
      <FontAwesomeIcon icon={faScrewdriverWrench} className="assistant-tool-chip__icon" />
      {toolLabel(name, labels)}
      <FontAwesomeIcon
        icon={running ? faCircleNotch : faCheck}
        spin={running}
        className="assistant-tool-chip__spinner"
      />
    </span>
  );
}
