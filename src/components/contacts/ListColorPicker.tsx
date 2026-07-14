/**
 * List icon color options — the hex values of Blueprint design-system color
 * tokens (the token CSS custom properties aren't loaded globally in this app,
 * so we use their values). Ordered by family to match the Figma "List Icon
 * Color" picker; comments name the source token.
 */
export const LIST_ICON_COLORS: string[] = [
  "#22262f", // storm-grey-950
  "#521c87", // purple-heart-900
  "#7422ce", // purple-heart-700
  "#9f55f7", // purple-heart-500
  "#d4b4fe", // purple-heart-300
  "#95c7fb", // buildout-blue-300
  "#3f86f2", // buildout-blue-500
  "#2153d4", // buildout-blue-700
  "#203d88", // buildout-blue-900
  "#144e65", // seagull-900
  "#0a7494", // seagull-700
  "#00b8d8", // seagull-500
  "#62748e", // storm-grey-500
  "#00553e", // mountain-meadow-900
  "#00835c", // mountain-meadow-700
  "#00bc7d", // mountain-meadow-500
  "#63f2b8", // mountain-meadow-300
  "#ffd346", // harvest-gold-300
  "#fd9a00", // harvest-gold-500
  "#bb4e02", // harvest-gold-700
  "#7c320b", // harvest-gold-900
  "#900c12", // solid-pink-900
  "#e7000b", // solid-pink-700
  "#ff2630", // solid-pink-500
];

export const DEFAULT_LIST_COLOR = LIST_ICON_COLORS[3]; // purple-heart-500

/** Swatch grid for choosing a list's icon color; selected gets an offset ring. */
export function ListColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="d-flex flex-wrap gap-2 mt-1">
      {LIST_ICON_COLORS.map((color) => {
        const selected = value === color;
        return (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={selected}
            onClick={() => onChange(color)}
            className="border-0 p-0 rounded-circle"
            style={{
              width: 24,
              height: 24,
              background: color,
              cursor: "pointer",
              // Offset ring around the selected swatch (per Figma): a
              // background-colored gap then a dark ring. box-shadow is used
              // instead of outline so a global focus reset can't clobber it.
              boxShadow: selected
                ? "0 0 0 2px var(--bs-body-bg, #fff), 0 0 0 4px var(--bs-body-color, #22262f)"
                : "none",
            }}
          />
        );
      })}
    </div>
  );
}
