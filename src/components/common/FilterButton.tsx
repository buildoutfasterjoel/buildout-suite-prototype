import type { ComponentProps, ReactNode } from "react";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/pro-regular-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

/**
 * The one filter trigger every index toolbar uses — Properties, Deals,
 * Contacts, Tasks, Back Office — transcribed from Figma (My Sandbox
 * 1575:52305 / 1575:52306).
 *
 * Two states and nothing else:
 *
 * - **Default** — Blueprint's outline button with a lighter stroke
 *   (storm-grey-200) so a row of six dropdowns reads as a quiet band of
 *   controls rather than a row competing with the results.
 * - **Applied** — the stroke goes dark purple (purple-heart-950, the outline
 *   ink) and the count joins the label: `Filter (2)`. No badge; the count is
 *   part of the words, so the button still reads as one thing.
 *
 * `active` defaults to `count > 0`. Pass it explicitly for a trigger whose
 * "applied" isn't a count — a date window that's been narrowed, say.
 *
 * Works as a Base UI `render` target (Popover / DropdownMenu triggers): every
 * extra prop and the ref go straight to the Button.
 */
export function FilterButton({
  label,
  count = 0,
  active,
  icon,
  caret = true,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant"> & {
  label: ReactNode;
  /** Applied-filter count; joins the label as ` (N)` when above zero. */
  count?: number;
  /** Overrides the applied state; defaults to `count > 0`. */
  active?: boolean;
  /** Optional leading glyph — the funnel on a flyout toggle, say. */
  icon?: IconDefinition;
  /** The trailing caret; off for a toggle that opens a flyout rather than a menu. */
  caret?: boolean;
}) {
  const applied = active ?? count > 0;
  return (
    <Button
      variant="outline"
      className={`filter-btn${applied ? " filter-btn--active" : ""}${className ? ` ${className}` : ""}`}
      {...props}
    >
      {icon && <FontAwesomeIcon icon={icon} />}
      <span className="text-nowrap">
        {label}
        {count > 0 && ` (${count})`}
      </span>
      {children}
      {caret && <FontAwesomeIcon icon={faCaretDown} />}
    </Button>
  );
}
