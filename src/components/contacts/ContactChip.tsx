import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/pro-regular-svg-icons";

/**
 * The purple filter/tag chip — a removable pill used for active filters on the
 * People index and for contact tags on the detail page. Styles live in the
 * scoped `.contact-chip` classes in main.scss.
 */
export function ContactChip({
  label,
  onRemove,
  removeLabel,
}: {
  label: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="contact-chip">
      <span className="contact-chip__label">{label}</span>
      {onRemove && (
        <button
          type="button"
          className="contact-chip__remove"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}
    </span>
  );
}
