import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { TaskFilterFields } from "#/components/tasks/TaskFilterFields";
import {
  countActiveTaskFilters,
  emptyTaskFilters,
  type TaskFilterState,
} from "#/components/tasks/taskFilterModel";

interface TaskFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
}

/** The Tasks page Filters flyout — mirrors the Contacts Offcanvas pattern. */
export function TaskFilters({
  open,
  onOpenChange,
  filters,
  onChange,
}: TaskFiltersProps) {
  const [query, setQuery] = useState("");
  const selectedCount = countActiveTaskFilters(filters);

  return (
    <Offcanvas open={open} onOpenChange={onOpenChange}>
      <Offcanvas.Content side="left" className="contact-filters">
        <Offcanvas.Header className="contact-filters__header d-flex flex-column align-items-stretch gap-3">
          <Offcanvas.Title className="fs-5 fw-bold mb-0">Filters</Offcanvas.Title>
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search Filters"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
        </Offcanvas.Header>

        <Offcanvas.Body>
          <TaskFilterFields filters={filters} onChange={onChange} query={query} />
        </Offcanvas.Body>

        <Offcanvas.Footer className="d-flex align-items-center gap-2">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{selectedCount}</span> selected
          </span>
          <Button variant="ghost" onClick={() => onChange(emptyTaskFilters())}>
            Clear All
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </Offcanvas.Footer>
      </Offcanvas.Content>
    </Offcanvas>
  );
}
