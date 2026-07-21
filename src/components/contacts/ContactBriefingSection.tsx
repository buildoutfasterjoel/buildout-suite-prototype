import { Card } from "@buildoutinc/blueprint-react/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/pro-regular-svg-icons";
import { faSparkles } from "@fortawesome/pro-solid-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/**
 * The AI briefing, a collapsible section that floats above the Tasks section in
 * the right column. It mirrors the overview-column accordion headers: the
 * current style puts the chevron on the right with a "Last touch" line beneath
 * the heading; the legacy style (design-comparison toggle) puts the chevron on
 * the left with "Last touch" on the same row. Collapsed shows just the header.
 */
export function ContactBriefingSection({
  briefing,
  open,
  onToggle,
}: {
  briefing: string;
  open: boolean;
  onToggle: () => void;
}) {
  const legacy = useContactUiPrefs((s) => s.legacyAccordions);

  const heading = (
    <span className="d-flex align-items-center gap-2 min-w-0">
      {legacy && (
        /* Single down chevron, rotated right when collapsed — the rotation
           (not an icon swap) is what lets the transition animate. */
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`text-muted contact-briefing__chevron${
            open ? " contact-briefing__chevron--open" : ""
          }`}
          style={{ width: 12, opacity: 0.55 }}
        />
      )}
      <FontAwesomeIcon
        icon={faSparkles}
        style={{ color: "#9f55f7", fontSize: 16 }}
      />
      <span className="fw-semibold" style={{ fontSize: 20, lineHeight: "26px" }}>
        Briefing
      </span>
    </span>
  );

  return (
    <Card className="contact-panel-card overflow-hidden contact-briefing">
      <button
        type="button"
        className={`contact-briefing__header${
          legacy ? " contact-briefing__header--legacy" : ""
        }`}
        aria-expanded={open}
        onClick={onToggle}
      >
        {legacy ? (
          heading
        ) : (
          <span className="contact-briefing__heading-row">
            {heading}
            <FontAwesomeIcon
              icon={open ? faChevronUp : faChevronDown}
              className="text-muted"
              style={{ fontSize: 14, opacity: 0.55 }}
            />
          </span>
        )}
      </button>

      {open && (
        <div className="contact-briefing__body">
          <p className="mb-0">{briefing}</p>
        </div>
      )}
    </Card>
  );
}
