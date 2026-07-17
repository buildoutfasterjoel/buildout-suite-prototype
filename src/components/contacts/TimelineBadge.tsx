import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import type { TimelineBadgeData } from "#/components/contacts/timeline";

/**
 * A delivery / engagement / status pill. Wraps the Blueprint Badge with a
 * scoped tone class (the DS Badge only ships primary/secondary/outline, so the
 * seven timeline tones are layered on top and can move into the DS later).
 * Renders an optional trailing meta ("2h after send") without truncating.
 */
export function TimelineBadge({ badge }: { badge: TimelineBadgeData }) {
  return (
    <Badge
      variant="secondary"
      className={`tl-badge tl-badge--${badge.tone}`}
    >
      <span>{badge.label}</span>
      {badge.meta && <span className="tl-badge__meta">· {badge.meta}</span>}
    </Badge>
  );
}
