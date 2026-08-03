import type { ReactNode } from "react";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * The small badges shared by the redesigned deal and property cards. All share
 * one shape — 20px tall, 4px padding, 6px radius, a 10px leading glyph and a
 * 12px semibold label — and differ only in fill (see newCardTokens).
 */

/**
 * A filled 20px badge with a leading glyph, optionally wrapped in a tooltip.
 * Omitting `label` gives the square icon-only form — used where the badges ride
 * inline with a card's meta text and the words would crowd it out; the tooltip
 * then carries the meaning, so pass one.
 */
export function CardBadge({
  icon,
  label,
  bg,
  color,
  tooltip,
  iconColor,
}: {
  icon?: IconDefinition;
  label?: ReactNode;
  bg: string;
  color: string;
  tooltip?: string;
  /** Overrides the glyph color; defaults to the label color. */
  iconColor?: string;
}) {
  const badge = (
    <span
      className={`deal-tile__badge${
        label === undefined ? " deal-tile__badge--icon-only" : ""
      }`}
      style={{ backgroundColor: bg, color }}
    >
      {icon && (
        <FontAwesomeIcon
          icon={icon}
          className="deal-tile__badge-icon"
          style={iconColor ? { color: iconColor } : undefined}
        />
      )}
      {label}
    </span>
  );
  if (!tooltip) return badge;
  return (
    <Tooltip>
      <Tooltip.Trigger render={badge} />
      <Tooltip.Content>{tooltip}</Tooltip.Content>
    </Tooltip>
  );
}

/**
 * The hairline between the relationship badge and the side badge — those two
 * answer different questions ("why is this card here" vs "who do we represent"),
 * so the rule keeps them from reading as one run of badges.
 */
export function BadgeDivider() {
  return <span className="deal-tile__divider" aria-hidden="true" />;
}
