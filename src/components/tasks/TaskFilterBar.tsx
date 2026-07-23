import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { ContactChip } from "#/components/contacts/ContactChip";
import {
  taskFilterChips,
  type TaskFilterState,
} from "#/components/tasks/taskFilterModel";

/**
 * The active-filter pills row for the Tasks page: one removable pill per active
 * filter plus a Clear Filters action. Reuses the Contacts chip component.
 */
export function TaskFilterBar({
  filters,
  onChange,
  onClear,
}: {
  filters: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  onClear: () => void;
}) {
  const chips = taskFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className="contact-filter-bar d-flex align-items-center gap-2 flex-wrap">
      {chips.map((chip) => (
        <ContactChip
          key={chip.key}
          label={chip.label}
          removeLabel={`Remove ${chip.label}`}
          onRemove={() => onChange(chip.clear(filters))}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={onClear} className="ms-1">
        <FontAwesomeIcon icon={faXmark} />
        Clear Filters
      </Button>
    </div>
  );
}
