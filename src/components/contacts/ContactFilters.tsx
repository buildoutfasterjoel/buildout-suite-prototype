import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Offcanvas } from "@buildoutinc/blueprint-react/ui/Offcanvas";
import { ContactFilterFields } from "#/components/contacts/ContactFilterFields";
import {
  countActiveContactFilters,
  emptyContactFilters,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

interface ContactFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ContactFilterState;
  onChange: (next: ContactFilterState) => void;
  assignees: string[];
  allTags: string[];
}

export function ContactFilters({
  open,
  onOpenChange,
  filters,
  onChange,
  assignees,
  allTags,
}: ContactFiltersProps) {
  const [query, setQuery] = useState("");
  const selectedCount = countActiveContactFilters(filters);

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
          <ContactFilterFields
            filters={filters}
            onChange={onChange}
            assignees={assignees}
            allTags={allTags}
            query={query}
          />
        </Offcanvas.Body>

        <Offcanvas.Footer className="d-flex align-items-center gap-2">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{selectedCount}</span> selected
          </span>
          <Button variant="ghost" onClick={() => onChange(emptyContactFilters())}>
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
