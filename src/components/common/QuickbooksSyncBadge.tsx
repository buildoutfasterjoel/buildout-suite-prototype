import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate } from "@fortawesome/pro-regular-svg-icons";
import { QUICKBOOKS_SYNCED_LABEL } from "#/data/quickbooks";

/**
 * The green sync chip that says a record has a counterpart in QuickBooks.
 *
 * Renders nothing when the record is not connected. That is the whole visual
 * language: the badge means connected, and its absence means not — a second
 * greyed-out state would put two things on screen where one carries the
 * message, and would read as "sync failed" rather than "never synced".
 *
 * Blueprint's `Avatar` has no indicator slot, which is why this is a hand-rolled
 * chip rather than a component prop. The ring is drawn with the card background
 * token rather than white, so the badge still separates from the avatar
 * underneath it when the theme changes.
 *
 * Positioning is the caller's: over an avatar it is hung off the corner by an
 * absolutely positioned wrapper, and in a table cell it just sits in the flow.
 * Keeping that out of here is what lets one chip serve both.
 */
export function QuickbooksSyncBadge({
  synced,
  size = 16,
  className,
}: {
  synced: boolean | undefined;
  /** Edge length in px. 16 over an avatar, 18 standing alone in a table cell. */
  size?: number;
  className?: string;
}) {
  if (!synced) return null;

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <span
            className={`d-inline-flex align-items-center justify-content-center rounded-circle bg-mountain-meadow-500 text-white${
              className ? ` ${className}` : ""
            }`}
            style={{
              width: size,
              height: size,
              // The glyph, not the box, is what has to stay legible at 16px.
              fontSize: Math.round(size * 0.55),
              boxShadow: "0 0 0 2px var(--bp-card-bg)",
            }}
            // The tooltip is the sighted affordance; this is the same fact for
            // a screen reader, which cannot hover.
            aria-label={QUICKBOOKS_SYNCED_LABEL}
          >
            <FontAwesomeIcon icon={faArrowsRotate} />
          </span>
        }
      />
      <Tooltip.Content>{QUICKBOOKS_SYNCED_LABEL}</Tooltip.Content>
    </Tooltip>
  );
}
