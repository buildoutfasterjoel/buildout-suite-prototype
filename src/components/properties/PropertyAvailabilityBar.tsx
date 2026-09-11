import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import {
  formatAvailabilityBreakdown,
  SPACE_STATUS_PRECEDENCE,
  type PropertyAvailability,
} from "#/data/propertySpaces";
import { SPACE_STATUS_COLORS } from "./propertySpaceDisplay";

/**
 * The composition of a property's spaces as a segmented bar, in precedence
 * order, with the full breakdown in a tooltip. This is how "mixed" is shown —
 * there is deliberately no Mixed status value (see `propertyAvailability`).
 *
 * Hand-built because Blueprint's `Progress` is single-valued. Tokens only.
 * Renders nothing for a single space: a one-segment bar says nothing the
 * headline does not.
 */
export function PropertyAvailabilityBar({
  availability,
  width = 120,
}: {
  availability: PropertyAvailability;
  width?: number;
}) {
  if (availability.spaceCount <= 1) return null;
  const breakdown = formatAvailabilityBreakdown(availability);
  return (
    <Tooltip>
      <Tooltip.Trigger
        render={
          <div
            role="img"
            aria-label={breakdown}
            className="d-inline-flex flex-shrink-0"
            style={{ width, height: 6, gap: 2 }}
          />
        }
      >
        {SPACE_STATUS_PRECEDENCE.filter((s) => availability.counts[s] > 0).map((s) => (
          <span
            key={s}
            style={{
              flex: availability.counts[s],
              backgroundColor: SPACE_STATUS_COLORS[s],
              borderRadius: 4,
            }}
          />
        ))}
      </Tooltip.Trigger>
      <Tooltip.Content>{breakdown}</Tooltip.Content>
    </Tooltip>
  );
}
