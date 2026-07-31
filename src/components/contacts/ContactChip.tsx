import type { ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/pro-regular-svg-icons";

/**
 * The removable filter/tag pill. Two appearances share one geometry: the purple
 * default for active filters on the People index, and the grey `muted` variant
 * for contact tags on the detail hero — a tag is a label, not a live filter, so
 * it shouldn't carry the accent color. Styles live in the scoped `.contact-chip`
 * classes in main.scss.
 */
export function ContactChip({
  label,
  onRemove,
  removeLabel,
  appearance = "default",
}: {
  label: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  appearance?: "default" | "muted";
}) {
  return (
    <span
      className={`contact-chip${
        appearance === "muted" ? " contact-chip--muted" : ""
      }`}
    >
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
