import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { IconTone } from "#/components/contacts/timeline";

/**
 * Circular channel glyph for a timeline row. Six tones map to channels; `filled`
 * marks connected/positive, outline marks attempted/system. Tone + fill come
 * from the type config (and per-row `attempted` overrides), so the mapping is
 * deterministic.
 */
export function IconBadge({
  icon,
  tone,
  filled,
}: {
  icon: IconDefinition;
  tone: IconTone;
  filled: boolean;
}) {
  return (
    <span
      className={`tl-icon tl-icon--${tone} ${filled ? "is-filled" : "is-outline"}`}
    >
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}
