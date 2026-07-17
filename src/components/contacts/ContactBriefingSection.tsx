import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronRight } from "@fortawesome/pro-regular-svg-icons";
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";

/**
 * The AI briefing, promoted to its own collapsible section at the top of the
 * middle column. The header mirrors the overview-column accordion sections
 * (left chevron + 20/26 semibold heading) with the AI sparkle marking it, and a
 * "Last touch" summary on the right. Collapsed shows just the header.
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
    <Card className="shadow-sm overflow-hidden contact-briefing">
      <button
        type="button"
        className="contact-briefing__header"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="d-flex align-items-center gap-2 min-w-0">
          <FontAwesomeIcon
            icon={open ? faChevronDown : faChevronRight}
            className="text-muted"
            style={{ width: 12 }}
          />
          <FontAwesomeIcon
            icon={faSparkles}
            style={{ color: "#9f55f7", fontSize: 16 }}
          />
          <span className="fw-semibold" style={{ fontSize: 20, lineHeight: "26px" }}>
            Briefing
          </span>
        </span>
        <span className="text-muted fs-small text-nowrap">
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
