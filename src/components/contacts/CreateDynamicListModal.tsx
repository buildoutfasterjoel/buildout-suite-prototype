import { useEffect, useState } from "react";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { SWATCHES } from "#/features/editor/tokens";
import {
  autoDynamicListName,
  countActiveContactFilters,
  type ContactFilterState,
} from "#/components/contacts/contactFilterModel";

interface CreateDynamicListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ContactFilterState;
  onCreate: (input: {
    name: string;
    color: string;
    description: string;
  }) => void;
}

const DEFAULT_COLOR = SWATCHES[0];

export function CreateDynamicListModal({
  open,
  onOpenChange,
  filters,
  onCreate,
}: CreateDynamicListModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");

  const filterCount = countActiveContactFilters(filters);

  // Re-seed the form each time the modal opens (auto-name from the filters).
  useEffect(() => {
    if (open) {
      setName(autoDynamicListName(filters));
      setColor(DEFAULT_COLOR);
      setDescription("");
    }
  }, [open, filters]);

  const canCreate = name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate({ name: name.trim(), color, description: description.trim() });
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
          <Modal.Title>New Dynamic List</Modal.Title>
          <Modal.Description>
            Create a new dynamic list from selected filters
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>List Name</Field.Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-populated name based on filters"
            />
          </Field>

          <Field>
            <Field.Label>List Icon Color</Field.Label>
            <Field.Description>
              Sets the color of this list's icon in the list menu for easier
              navigation.
            </Field.Description>
            <div className="d-flex flex-wrap gap-2 mt-1">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={swatch}
                  aria-pressed={color === swatch}
                  onClick={() => setColor(swatch)}
                  className="border-0 p-0 rounded-circle"
                  style={{
                    width: 24,
                    height: 24,
                    background: swatch,
                    cursor: "pointer",
                    outline:
                      color === swatch
                        ? "2px solid var(--bs-body-color)"
                        : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
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
        </Modal.Body>

        <Modal.Footer className="d-flex align-items-center">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{filterCount}</span> filters
            selected
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>
            Create Dynamic List
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
