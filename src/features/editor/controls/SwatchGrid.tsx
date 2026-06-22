import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoNotEnter } from "@fortawesome/pro-regular-svg-icons";
import { SWATCHES } from "../tokens";

/**
 * Color swatch grid with a leading "none" swatch, matching the Figma. The
 * selected color gets a primary outline.
 */
export function SwatchGrid({
  value,
  onChange,
}: {
  value: string | null;
  onChange?: (color: string | null) => void;
}) {
  return (
    <div className="d-flex flex-wrap" style={{ gap: 2 }}>
      <button
        type="button"
        className={`bo-editor-swatch${value === null ? " is-selected" : ""}`}
        aria-label="No color"
        onClick={() => onChange?.(null)}
      >
        <FontAwesomeIcon icon={faDoNotEnter} style={{ fontSize: 12 }} />
      </button>
      {SWATCHES.map((color) => (
        <button
          key={color}
          type="button"
          className={`bo-editor-swatch${value === color ? " is-selected" : ""}`}
          style={{ background: color }}
          aria-label={color}
          onClick={() => onChange?.(color)}
        />
      ))}
    </div>
  );
}
