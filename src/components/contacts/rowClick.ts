import type { MouseEvent } from "react";

/**
 * True when a table-row click should NOT trigger row navigation — i.e. it's a
 * modified/non-primary click (so the browser/link can open a new tab, etc.) or
 * it originated from an interactive control inside the row (checkbox, link,
 * button, ⋮ menu). Lets those controls behave normally while the rest of the
 * row acts as a click target.
 */
export function shouldIgnoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return true;
  }
  return !!(e.target as HTMLElement).closest(
    'a, button, input, label, [role="checkbox"], [role="menuitem"]',
  );
}
