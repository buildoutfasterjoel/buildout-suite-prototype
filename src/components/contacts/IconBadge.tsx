import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { IconTone } from "#/components/contacts/timeline";

/**
 * Circular channel glyph for a timeline row. By default the bubble is a neutral
 * grey (white glyph) so the feed stays calm; when a row still needs attention —
 * a missed call, an unreplied email, an un-followed-up inquiry — it turns
 * purple so the color actually means "act on this". Resolving the row flips
 * `attention` off and the bubble returns to grey. (`tone` is retained for
 * semantics / future per-channel use but no longer drives the color.)
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
    <span
      className={`tl-icon ${attention ? "tl-icon--attention" : "tl-icon--resting"}`}
      data-tone={tone}
    >
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}
