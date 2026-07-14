import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateLeft,
  faCaretDown,
  faFloppyDisk,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import {
  contactFilterChips,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

/** Which list is active, which drives the available save actions. */
export type FilterBarContext = "all" | "dynamic" | "other";

interface ContactFilterBarProps {
  filters: ContactFilterState;
  onChange: (next: ContactFilterState) => void;
  context: FilterBarContext;
  /** True when a dynamic list's current filters differ from its saved set. */
  dirty: boolean;
  filteredCount: number;
  onSaveDynamic: () => void;
  onSaveFilters: () => void;
  onSaveAsNew: () => void;
  onRevert: () => void;
  onClear: () => void;
}

export function ContactFilterBar({
  filters,
  onChange,
  context,
  dirty,
  filteredCount,
  onSaveDynamic,
  onSaveFilters,
  onSaveAsNew,
  onRevert,
  onClear,
}: ContactFilterBarProps) {
  const chips = contactFilterChips(filters);

  // Nothing to show: no active filters, and not an edited dynamic list.
  if (chips.length === 0 && !(context === "dynamic" && dirty)) return null;

  return (
    <div className="contact-filter-bar d-flex align-items-center gap-2 flex-wrap">
      {chips.map((chip) => (
        <span key={chip.key} className="contact-chip">
          <span className="contact-chip__label">
            {chip.group}: {chip.value}
          </span>
          <button
            type="button"
            className="contact-chip__remove"
            aria-label={`Remove ${chip.group}: ${chip.value}`}
            onClick={() => onChange(chip.clear(filters))}
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </span>
      ))}

      {/* All Contacts + active filters → save the set as a new dynamic list. */}
      {context === "all" && chips.length > 0 && (
        <div className="d-flex align-items-center gap-2 ms-1">
          <Button variant="primary" size="sm" onClick={onSaveDynamic}>
            <FontAwesomeIcon icon={faFloppyDisk} />
            Save Dynamic List ({filteredCount})
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <FontAwesomeIcon icon={faXmark} />
            Clear Filters
          </Button>
        </div>
      )}

      {/* Dynamic list with edited filters → update saved set, save-as-new, or revert. */}
      {context === "dynamic" && dirty && (
        <div className="d-flex align-items-center gap-2 ms-1">
          <div className="d-inline-flex">
            <Button
              variant="primary"
              size="sm"
              onClick={onSaveFilters}
              className="rounded-end-0"
            >
              <FontAwesomeIcon icon={faFloppyDisk} />
              Save Filters
            </Button>
            <DropdownMenu>
              <DropdownMenu.Trigger
                render={
                  <Button
                    variant="primary"
                    size="icon-sm"
                    aria-label="More save options"
                    className="rounded-start-0 border-start-0"
                  >
                    <FontAwesomeIcon icon={faCaretDown} />
                  </Button>
                }
              />
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item onClick={onSaveAsNew}>
                  Save as New
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </div>
          <Tooltip>
            <Tooltip.Trigger
              render={
                <Button variant="ghost" size="sm" onClick={onRevert}>
                  <FontAwesomeIcon icon={faArrowRotateLeft} />
                  Revert
                </Button>
              }
            />
            <Tooltip.Content>Reverts to list's saved filters</Tooltip.Content>
          </Tooltip>
        </div>
      )}

      {/* Built-in/static list with ad-hoc filters → clear only. */}
      {context === "other" && chips.length > 0 && (
        <Button variant="ghost" size="sm" onClick={onClear} className="ms-1">
          <FontAwesomeIcon icon={faXmark} />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
