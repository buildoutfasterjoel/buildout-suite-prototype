import { cloneElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";

export interface ToggleItem<T extends string> {
  value: T;
  /** Omit for a text item — the label renders in place of an icon. */
  icon?: IconDefinition;
  label: string;
}

/**
 * Segmented icon toggle group (B/I/U/S, alignment) matching the Figma. Supports
 * multi-select (e.g. bold + italic) or single-select (alignment). Each item is
 * a ghost Button; the `active` class shows the pressed state. Pass `tooltips`
 * to surface each item's label on hover (used by the floating toolbar, where
 * there are no adjacent text labels). An item with no `icon` renders its label
 * as text instead — for value sets that have no glyph (map size S/M/L/Full).
 */
export function ToggleButtonGroup<T extends string>({
  items,
  active,
  multi = false,
  onToggle,
  tooltips = false,
}: {
  items: ToggleItem<T>[];
  active: T[];
  multi?: boolean;
  onToggle?: (value: T) => void;
  tooltips?: boolean;
}) {
  return (
    <div
      className="bo-editor-toggle-group"
      role={multi ? "group" : "radiogroup"}
    >
      {items.map((item) => {
        const isActive = active.includes(item.value);
        const button = (
          <Button
            type="button"
            variant="ghost"
            size={item.icon ? "icon" : "sm"}
            className={isActive ? "active" : undefined}
            aria-label={item.label}
            aria-pressed={isActive}
            onClick={() => onToggle?.(item.value)}
          >
            {item.icon ? <FontAwesomeIcon icon={item.icon} /> : item.label}
          </Button>
        );

        if (!tooltips) return cloneElement(button, { key: item.value });

        return (
          <Tooltip key={item.value}>
            <Tooltip.Trigger render={button} />
            <Tooltip.Content side="top">{item.label}</Tooltip.Content>
          </Tooltip>
        );
      })}
    </div>
  );
}
