import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faRotateExclamation,
} from "@fortawesome/pro-regular-svg-icons";
import {
  QUICKBOOKS_SYNCED_LABEL,
  QUICKBOOKS_UNSYNCED_LABEL,
} from "#/data/quickbooks";

/**
 * The chip that says whether a record has a counterpart in QuickBooks — green
 * and rotating when it does, amber with an exclamation when it does not.
 *
 * Both states show, and the amber one is the reason the badge exists at all. A
 * broker can put a payer on a voucher who is not a QuickBooks customer, and
 * nothing about the voucher looks wrong until the bill fails to go out. This is
 * where that gets said, at the record it is true of, instead of as a banner
 * over a page that would then need one banner per problem.
 *
 * Amber, not red: the record is not broken, it is not there yet. And the icon
 * changes with the colour rather than only the colour changing, so the two
 * states are still two states in a screenshot, in print, or to someone who does
 * not separate green from amber.
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
  /**
   * Undefined counts as not synced. A record created inside the app has not
   * been pushed anywhere yet, and saying so is the honest default — which is
   * why the field is optional on the types that carry it.
   */
  synced: boolean | undefined;
  /** Edge length in px. 16 over an avatar, 18 standing alone in a table cell. */
  size?: number;
  className?: string;
}) {
  const isSynced = synced === true;
  const label = isSynced ? QUICKBOOKS_SYNCED_LABEL : QUICKBOOKS_UNSYNCED_LABEL;

  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <span
            className={`d-inline-flex align-items-center justify-content-center rounded-circle text-white ${
              isSynced ? "bg-mountain-meadow-500" : "bg-harvest-gold-500"
            }${className ? ` ${className}` : ""}`}
            style={{
              width: size,
              height: size,
              // The glyph, not the box, is what has to stay legible at 16px.
              fontSize: Math.round(size * 0.55),
              boxShadow: "0 0 0 2px var(--bp-card-bg)",
            }}
            // The tooltip is the sighted affordance; this is the same fact for
            // a screen reader, which cannot hover.
            aria-label={label}
          >
            <FontAwesomeIcon
              icon={isSynced ? faArrowsRotate : faRotateExclamation}
            />
          </span>
        }
      />
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
