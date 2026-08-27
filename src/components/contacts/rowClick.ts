import type { MouseEvent } from "react";

/**
 * Selectors for the overlays a row can *own* but never contains: a modal, a
 * dropdown, a popover, a tooltip. React portals them to the end of `<body>`,
 * but a portal's events still bubble through the REACT tree — so a click on a
 * modal's header, rendered from a component inside a clickable card, arrives at
 * that card's `onClick` as though the broker had clicked the card itself.
 *
 * That is not hypothetical: the underwriting setup dialog is opened from a
 * contact's deal card, and clicking anywhere in it that wasn't a control
 * navigated to the deal out from under the dialog.
 */
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], .modal, .popover';

/**
 * True when a table-row click should NOT trigger row navigation — i.e. it's a
 * modified/non-primary click (so the browser/link can open a new tab, etc.), it
 * came from an interactive control inside the row (checkbox, link, button, ⋮
 * menu), or it came from an overlay the row merely rendered. Lets those behave
 * normally while the rest of the row acts as a click target.
 */
export function shouldIgnoreRowClick(e: MouseEvent<HTMLElement>): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return true;
  }
  return !!(e.target as HTMLElement).closest(
    `a, button, input, label, [role="checkbox"], [role="menuitem"], ${OVERLAY}`,
  );
}
