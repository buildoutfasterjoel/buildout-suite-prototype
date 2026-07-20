import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightArrowLeft } from "@fortawesome/pro-regular-svg-icons";
import { useContactUiPrefs } from "#/components/contacts/useContactUiPrefs";

/**
 * A floating design-comparison toggle, docked in the lower-left of the contact
 * detail page. Flips the accordions (and the AI briefing header) between two
 * treatments. Prototype-only affordance for reviewing them side by side.
 *
 * Labels (what the user sees):
 *  - "Legacy" — chevron on the RIGHT, grey body background.
 *  - "New"    — chevron on the LEFT, white body background (the default).
 *
 * The store flag is named `legacyAccordions` for historical reasons (that style
 * predated the deal-rail refresh); `true` renders the "New" treatment above.
 * The labels here are the source of truth for what's shown.
 */
export function ContactAccordionStyleToggle() {
  const newStyle = useContactUiPrefs((s) => s.legacyAccordions);
  const setNewStyle = useContactUiPrefs((s) => s.setLegacyAccordions);

  return (
    <Button
      variant="secondary"
      size="sm"
      className="position-fixed shadow"
      style={{ left: 16, bottom: 16, zIndex: 1050 }}
      aria-pressed={newStyle}
      onClick={() => setNewStyle(!newStyle)}
    >
      <FontAwesomeIcon icon={faArrowRightArrowLeft} />
      Accordions: {newStyle ? "New" : "Legacy"}
    </Button>
  );
}
