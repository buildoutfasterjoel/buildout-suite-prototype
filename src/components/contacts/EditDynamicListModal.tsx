import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import {
  DEFAULT_LIST_COLOR,
  ListColorPicker,
} from "#/components/contacts/ListColorPicker";
import type { CallList } from "#/data/contactLists";
import { ContactFilterFields } from "#/components/contacts/ContactFilterFields";
import {
  countActiveContactFilters,
  deserializeContactFilters,
  emptyContactFilters,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

interface EditDynamicListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: CallList;
  assignees: string[];
  allTags: string[];
  onSave: (input: {
    name: string;
    color: string;
    description: string;
    filters: ContactFilterState;
  }) => void;
}

const DEFAULT_COLOR = DEFAULT_LIST_COLOR;

export function EditDynamicListModal({
  open,
  onOpenChange,
  list,
  assignees,
  allTags,
  onSave,
}: EditDynamicListModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<ContactFilterState>(
    emptyContactFilters(),
  );

  // Seed from the list each time the modal opens.
  useEffect(() => {
    if (open) {
      setName(list.label);
      setColor(list.color ?? DEFAULT_COLOR);
      setDescription(list.description);
      setFilters(
        list.filters
          ? deserializeContactFilters(list.filters)
          : emptyContactFilters(),
      );
    }
  }, [open, list]);

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), color, description: description.trim(), filters });
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Modal.Content
        size="lg"
        scrollable
        centered
        style={{ maxWidth: "34.375rem" }}
      >
        <Modal.Header>
          <Modal.Title>Edit Dynamic List</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>List Name</Field.Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>

          <Field>
            <Field.Label>List Icon Color</Field.Label>
            <Field.Description>
              Sets the color of this list's icon in the list menu for easier
              navigation.
            </Field.Description>
            <ListColorPicker value={color} onChange={setColor} />
          </Field>

          <Field>
            <Field.Label className="d-flex align-items-center gap-2">
              Description
              <span className="text-muted fw-normal fs-small">Optional</span>
            </Field.Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <ContactFilterFields
            filters={filters}
            onChange={setFilters}
            assignees={assignees}
            allTags={allTags}
          />
        </Modal.Body>

        <Modal.Footer className="d-flex align-items-center">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">
              {countActiveContactFilters(filters)}
            </span>{" "}
            filters selected
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>
            Done
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
