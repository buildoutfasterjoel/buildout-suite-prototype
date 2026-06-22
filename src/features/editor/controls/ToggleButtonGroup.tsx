import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export interface ToggleItem<T extends string> {
  value: T;
  icon: IconDefinition;
  label: string;
}

/**
 * Segmented icon toggle group (B/I/U, alignment) matching the Figma. Supports
 * multi-select (e.g. bold + italic) or single-select (alignment).
 */
export function ToggleButtonGroup<T extends string>({
  items,
  active,
  multi = false,
  onToggle,
}: {
  items: ToggleItem<T>[];
  active: T[];
  multi?: boolean;
  onToggle?: (value: T) => void;
}) {
  return (
    <div className="bo-editor-toggle-group" role={multi ? "group" : "radiogroup"}>
      {items.map((item) => {
        const isActive = active.includes(item.value);
        return (
          <button
            key={item.value}
            type="button"
            className={`bo-editor-toggle-btn${isActive ? " is-active" : ""}`}
            aria-label={item.label}
            aria-pressed={isActive}
            onClick={() => onToggle?.(item.value)}
          >
            <FontAwesomeIcon icon={item.icon} />
          </button>
        );
      })}
    </div>
  );
}
