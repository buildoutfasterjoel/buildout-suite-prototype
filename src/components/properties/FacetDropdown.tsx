import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretDown } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { Facet } from "./PropertyFilters";

/**
 * The parts of a facet this dropdown renders. `Facet.getValue` is deliberately
 * absent: reading a value off a record is the caller's business (it is how the
 * caller filters and counts), and requiring it here would limit the dropdown to
 * facets over `Listing`. The voucher toolbar filters rows, not listings.
 */
export type FacetDropdownFacet = Pick<
  Facet,
  "title" | "options" | "selected" | "toggle" | "clear"
>;

/** A single facet rendered as a toolbar dropdown of checkable options. */
export function FacetDropdown({
  facet,
  counts,
  icon,
}: {
  facet: FacetDropdownFacet;
  counts?: Record<string, number>;
  /** Optional leading glyph, for a facet whose options are names rather than a
   *  fixed vocabulary (e.g. Brokers) and benefits from the extra cue. */
  icon?: IconDefinition;
}) {
  const count = facet.selected.size;

  const clear = () => {
    if (facet.clear) facet.clear();
    else facet.options.forEach((o) => facet.selected.has(o.value) && facet.toggle(o.value));
  };

  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            className={`d-inline-flex align-items-center gap-2 ${count ? "active" : ""}`}
          >
            {icon && <FontAwesomeIcon icon={icon} />}
            {facet.title}
            {count > 0 && <Badge variant="primary">{count}</Badge>}
            {/* caret-down at default size — matches Blueprint's Select.Trigger,
                so the facet dropdowns read the same as Sort By beside them. */}
            <FontAwesomeIcon icon={faCaretDown} />
          </Button>
        }
      />
      <Popover.Content
        side="bottom"
        align="start"
        sideOffset={6}
        style={{ minWidth: 220 }}
      >
        <Popover.Header className="d-flex align-items-center justify-content-between">
          {facet.title}
          {count > 0 && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none fs-small"
              onClick={clear}
            >
              Clear
            </button>
          )}
        </Popover.Header>
        <Popover.Body className="d-flex flex-column gap-2">
          {facet.options.map((opt) => {
            const active = facet.selected.has(opt.value);
            return (
              <label
                key={opt.value}
                className="d-flex align-items-center gap-2 mb-0"
                style={{ cursor: "pointer" }}
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={() => facet.toggle(opt.value)}
                  aria-label={opt.label}
                />
                <span className="flex-grow-1">{opt.label}</span>
                {counts && (
                  <span className="text-muted small">
                    {counts[opt.value] ?? 0}
                  </span>
                )}
              </label>
            );
          })}
        </Popover.Body>
      </Popover.Content>
    </Popover>
  );
}
