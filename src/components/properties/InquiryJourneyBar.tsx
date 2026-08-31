import { Collapsible } from "@buildoutinc/blueprint-react/ui/Collapsible";
import { Progress } from "@buildoutinc/blueprint-react/ui/Progress";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faCircle,
  faChevronDown,
} from "@fortawesome/pro-regular-svg-icons";
import type { Inquiry } from "./inquiryRow";
import { JOURNEY_STAGES, journeyProgress } from "./inquiryJourney";

/**
 * How far a lead has got on their own, outside the app.
 *
 * Compact on purpose: the panel is ~32rem, where the six stages laid out
 * side by side would each get about five characters. The bar carries the
 * summary — how far, where now, what next — and the stage-by-stage list stays
 * one disclosure away for when someone wants it.
 */
export function InquiryJourneyBar({ inquiry }: { inquiry: Inquiry }) {
  const { reach, complete, total, pct, current, next } =
    journeyProgress(inquiry);

  return (
    <div className="inquiry-journey rounded border p-3">
      <Progress
        value={pct}
        label={`${complete} of ${total} complete`}
        aria-label="Lead journey progress"
      />

      <div className="d-flex flex-wrap gap-3 mt-2">
        <div>
          <div className="text-muted fs-small">Now</div>
          <div className="fw-semibold">{current}</div>
        </div>
        <div>
          <div className="text-muted fs-small">Next</div>
          <div className={next ? "fw-semibold" : "fw-semibold text-muted"}>
            {next ?? "Journey complete"}
          </div>
        </div>
      </div>

      <Collapsible>
        <Collapsible.Trigger className="inquiry-journey__toggle btn btn-link btn-sm px-0 mt-2 text-decoration-none">
          <FontAwesomeIcon icon={faChevronDown} />
          All stages
        </Collapsible.Trigger>
        <Collapsible.Content>
          <ol className="list-unstyled mb-0 mt-2">
            {JOURNEY_STAGES.map((stage, i) => {
              const done = i <= reach;
              return (
                <li
                  key={stage}
                  className="d-flex align-items-center gap-2 border-top py-2"
                >
                  <FontAwesomeIcon
                    icon={done ? faCircleCheck : faCircle}
                    className={done ? "text-success" : "text-muted"}
                  />
                  <span className={done ? "fw-semibold" : "text-muted"}>
                    {stage}
                  </span>
                  {i === reach && (
                    <span className="text-muted fs-small ms-auto">current</span>
                  )}
                </li>
              );
            })}
          </ol>
        </Collapsible.Content>
      </Collapsible>
    </div>
  );
}
