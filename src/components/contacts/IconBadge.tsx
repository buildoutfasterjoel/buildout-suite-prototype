import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { IconTone } from "#/components/contacts/timeline";

/**
 * Circular channel glyph for a timeline row. By default the bubble is a neutral
 * grey (white glyph) so the feed stays calm; when a row still needs attention —
 * a missed call, an unreplied email, an un-followed-up inquiry — it takes its
 * channel tone so the color actually means "act on this". Resolving the row
 * flips `attention` off and the bubble returns to grey.
 */
export function IconBadge({
  icon,
  tone,
  attention,
}: {
  icon: IconDefinition;
  tone: IconTone;
  attention: boolean;
}) {
  return (
    <span className={`tl-icon ${attention ? `tl-icon--${tone}` : "tl-icon--resting"}`}>
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}
