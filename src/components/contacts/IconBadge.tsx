import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * The 36px channel bubble on a timeline row's rail. Resting rows are a soft grey
 * fill with a grey-blue glyph — quiet enough that a long feed reads as one
 * surface; a row that still needs attention (missed call, unreplied email,
 * un-followed-up inquiry) fills purple with a white glyph, so the color means
 * exactly one thing: act on this. Resolving the row returns it to grey.
 *
 * The glyph is the only per-channel signal here — the fill carries attention
 * state and nothing else, so there is no per-channel color to configure.
 */
export function IconBadge({
  icon,
  attention,
}: {
  icon: IconDefinition;
  attention: boolean;
}) {
  return (
    <span
      className={`tl-icon ${attention ? "tl-icon--attention" : "tl-icon--resting"}`}
    >
      <FontAwesomeIcon icon={icon} />
    </span>
  );
}
