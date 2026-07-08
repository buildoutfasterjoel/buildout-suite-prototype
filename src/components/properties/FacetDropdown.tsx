import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Popover } from "@buildoutinc/blueprint-react/ui/Popover";
import type { Facet } from "./PropertyFilters";

/** A single facet rendered as a toolbar dropdown of checkable options. */
export function FacetDropdown({
  facet,
  counts,
}: {
  facet: Facet;
  counts?: Record<string, number>;
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
            {facet.title}
            {count > 0 && <Badge variant="primary">{count}</Badge>}
            <FontAwesomeIcon icon={faChevronDown} className="fs-small" />
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
