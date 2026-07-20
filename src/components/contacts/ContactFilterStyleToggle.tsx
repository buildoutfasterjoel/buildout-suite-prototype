import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/**
 * A floating design-comparison toggle, docked in the lower-left of the contact
 * detail page (above the tab-track + accordion toggles). Flips the timeline
 * filter control between the "Dropdown" treatment (a type Select plus a "Needs
 * Reply" checkbox) and the original "Tabs" pill track. Prototype-only.
 */
export function ContactFilterStyleToggle() {
  const timelineFilter = useContactUiPrefs((s) => s.timelineFilter);
  const setTimelineFilter = useContactUiPrefs((s) => s.setTimelineFilter);

  return (
    <Button
      variant="secondary"
      size="sm"
      className="position-fixed shadow"
      style={{ left: 16, bottom: 96, zIndex: 1050 }}
      aria-pressed={timelineFilter === "dropdown"}
      onClick={() =>
        setTimelineFilter(timelineFilter === "dropdown" ? "tabs" : "dropdown")
      }
    >
      <FontAwesomeIcon icon={faArrowRightArrowLeft} />
      Filter: {timelineFilter === "dropdown" ? "Dropdown" : "Tabs"}
    </Button>
  );
}
