import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpRightFromSquare } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * A full-width, link-styled row for the contact overview column: a leading icon,
 * a label, an optional count badge, and a trailing "open" icon that stays hidden
 * until the row is hovered/focused. Shared by the deal cards' Documents/Leads
 * links and the Lists section, so they read and behave identically.
 */
export function ContactLinkButton({
  icon,
  iconColor,
  iconClassName = "text-muted",
  label,
  count,
  onClick,
}: {
  icon: IconDefinition;
  /** Inline hex for the leading icon (e.g. a list's chosen color). Wins over iconClassName. */
  iconColor?: string;
  /** Utility class for the leading icon color; defaults to muted. */
  iconClassName?: string;
  label: string;
  /** Optional trailing count badge (omit to hide). */
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="contact-link-btn btn btn-link text-reset text-decoration-none d-flex align-items-center gap-2 w-100 px-2 py-0"
      style={{ height: 36 }}
      onClick={onClick}
    >
      <FontAwesomeIcon
        icon={icon}
        className={iconColor ? undefined : iconClassName}
        style={iconColor ? { color: iconColor } : undefined}
      />
      <span className="fw-semibold text-truncate" style={{ minWidth: 0 }}>
        {label}
      </span>
      {count !== undefined && (
        <Badge variant="secondary" appearance="muted">
          {count}
        </Badge>
      )}
      <FontAwesomeIcon
        icon={faUpRightFromSquare}
        className="contact-link-btn__open text-muted ms-auto"
      />
    </button>
  );
}
