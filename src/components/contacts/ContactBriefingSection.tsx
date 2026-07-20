import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/pro-regular-svg-icons";
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";

/**
 * The AI briefing, a collapsible section that floats above the Tasks section in
 * the right column. The header mirrors the overview-column accordion sections
 * (20/26 semibold heading + a right-side chevron) with the AI sparkle marking
 * it, and a "Last touch" summary on the line below. Collapsed shows just the
 * header.
 */
export function ContactBriefingSection({
  briefing,
  lastTouch,
  open,
  onToggle,
}: {
  briefing: string;
  lastTouch: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="contact-panel-card overflow-hidden contact-briefing">
      <button
        type="button"
        className="contact-briefing__header"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="contact-briefing__heading-row">
          <span className="d-flex align-items-center gap-2 min-w-0">
            <FontAwesomeIcon
              icon={faSparkles}
              style={{ color: "#9f55f7", fontSize: 16 }}
            />
            <span
              className="fw-semibold"
              style={{ fontSize: 20, lineHeight: "26px" }}
            >
              Briefing
            </span>
          </span>
          <FontAwesomeIcon
            icon={open ? faChevronUp : faChevronDown}
            className="text-muted"
            style={{ fontSize: 14, opacity: 0.55 }}
          />
        </span>
        <span className="text-muted fs-small">
          Last touch: <span className="fw-bold">{lastTouch}</span>
        </span>
      </button>

      {open && (
        <div className="contact-briefing__body">
          <p className="mb-0">{briefing}</p>
        </div>
      )}
    </Card>
  );
}
