import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/**
 * A floating design-comparison toggle, docked in the lower-left of the contact
 * detail page. Flips the accordions (and the AI briefing header) between the
 * current style — chevrons on the right, tinted content backgrounds — and the
 * legacy style — chevrons on the left, white content. Prototype-only affordance
 * for reviewing the two treatments side by side.
 */
export function ContactAccordionStyleToggle() {
  const legacy = useContactUiPrefs((s) => s.legacyAccordions);
  const setLegacy = useContactUiPrefs((s) => s.setLegacyAccordions);

  return (
    <Button
      variant="secondary"
      size="sm"
      className="position-fixed shadow"
      style={{ left: 16, bottom: 16, zIndex: 1050 }}
      aria-pressed={legacy}
      onClick={() => setLegacy(!legacy)}
    >
      <FontAwesomeIcon icon={faArrowRightArrowLeft} />
      Accordions: {legacy ? "Legacy" : "Current"}
    </Button>
  );
}
