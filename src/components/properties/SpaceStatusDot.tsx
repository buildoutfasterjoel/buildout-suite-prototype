import type { SpaceStatus } from "#/data/propertySpaces";
import { SPACE_STATUS_COLORS } from "./propertySpaceDisplay";

/**
 * Dot + text for a space's status — the Contacts table convention, not the
 * deal-stage `StatusPill`. This column is deliberately *not* a stage: the pill's
 * tinted fill is the mark of a deal sitting on the ladder, and a space's
 * availability is an asset fact that may or may not have a deal behind it.
 */
export function SpaceStatusDot({
  status,
  className,
  children,
}: {
  status: SpaceStatus;
  className?: string;
  /** Overrides the label; defaults to the status itself. */
  children?: React.ReactNode;
}) {
  return (
    <span className={`d-inline-flex align-items-center gap-2 text-nowrap ${className ?? ""}`}>
      <span
        className="rounded-circle d-inline-block flex-shrink-0"
        style={{ width: 8, height: 8, backgroundColor: SPACE_STATUS_COLORS[status] }}
        aria-hidden="true"
      />
      {children ?? status}
    </span>
  );
}
