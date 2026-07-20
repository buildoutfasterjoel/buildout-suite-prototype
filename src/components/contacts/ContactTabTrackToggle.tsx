import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/**
 * A floating design-comparison toggle, docked in the lower-left of the contact
 * detail page (above the accordion-style toggle). Flips the middle-column tab
 * tracks (Log Activity + Timeline) between the "System" treatment (Blueprint
 * pill variant — grey track, white active pill + shadow) and the "Ghost Track"
 * treatment (transparent track, purple-accent active pill, no shadow).
 * Prototype-only affordance for reviewing the two treatments.
 */
export function ContactTabTrackToggle() {
  const tabTrack = useContactUiPrefs((s) => s.tabTrack);
  const setTabTrack = useContactUiPrefs((s) => s.setTabTrack);

  return (
    <Button
      variant="secondary"
      size="sm"
      className="position-fixed shadow"
      style={{ left: 16, bottom: 56, zIndex: 1050 }}
      aria-pressed={tabTrack === "ghost"}
      onClick={() => setTabTrack(tabTrack === "system" ? "ghost" : "system")}
    >
      <FontAwesomeIcon icon={faArrowRightArrowLeft} />
      Tabs: {tabTrack === "system" ? "System" : "Ghost Track"}
    </Button>
  );
}
