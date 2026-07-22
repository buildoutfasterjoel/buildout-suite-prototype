import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDoNotEnter } from "@fortawesome/pro-regular-svg-icons";
import { SWATCHES } from "../tokens";
import { BRAND_SWATCHES } from "../brand";

/**
 * Color swatch grid. Leads with the brand palette (so on-brand choices are the
 * default path), then a divider, then the general palette. A leading "none"
 * swatch clears the color. The selected color gets a primary outline.
 */
export function SwatchGrid({
  value,
  onChange,
}: {
  value: string | null;
  onChange?: (color: string | null) => void;
}) {
  const swatch = (color: string) => (
    <button
      key={color}
      type="button"
      className={`bo-editor-swatch${value === color ? " is-selected" : ""}`}
      style={{ background: color }}
      aria-label={color}
      onClick={() => onChange?.(color)}
    />
  );
  return (
    <div className="d-flex flex-column gap-2">
      <div className="d-flex flex-wrap" style={{ gap: 2 }}>
        <button
          type="button"
          className={`bo-editor-swatch${value === null ? " is-selected" : ""}`}
          aria-label="No color"
          onClick={() => onChange?.(null)}
        >
          <FontAwesomeIcon icon={faDoNotEnter} style={{ fontSize: 12 }} />
        </button>
        {BRAND_SWATCHES.map(swatch)}
      </div>
      <div style={{ height: 1, background: "#eceef2" }} />
      <div className="d-flex flex-wrap" style={{ gap: 2 }}>
        {SWATCHES.map(swatch)}
      </div>
    </div>
  );
}
