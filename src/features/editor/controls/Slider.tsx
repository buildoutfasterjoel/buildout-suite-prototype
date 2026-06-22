/**
 * Custom slider — Blueprint has no Slider component. Renders the track + thumb
 * styled in editor.scss with a trailing value label, matching the Figma.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "px",
  disabled,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange?: (value: number) => void;
}) {
  return (
    <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 0 }}>
      <input
        type="range"
        className="bo-editor-slider"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange?.(Number(e.target.value))}
      />
      <span className="fs-small flex-shrink-0" style={{ color: "#506079", width: 32 }}>
        {value}
        {unit}
      </span>
    </div>
  );
}
