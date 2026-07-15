import type { CSSProperties } from "react";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import type { RelationshipStage } from "#/data/types";
import { RELATIONSHIP_DISPLAY } from "#/components/contacts/contactDisplay";

/**
 * The contact-stage pill used in the People table, extracted so the contact
 * detail hero can render the identical badge. Colors come from the scoped
 * `.contact-stage-badge` classes in main.scss (filled soft pill per stage).
 * `className`/`style` let a caller layer on extra sizing (e.g. the hero sizes
 * it up to match the deal-card badges) without affecting the table instance.
 */
export function ContactStageBadge({
  relationship,
  className = "",
  style,
}: {
  relationship: RelationshipStage;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Badge
      variant="outline"
      className={`border-0 text-nowrap fw-semibold contact-stage-badge contact-stage-badge--${relationship} ${className}`}
      style={style}
    >
      {RELATIONSHIP_DISPLAY[relationship].label}
    </Badge>
  );
}
