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

interface CreateStaticListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactCount: number;
  onCreate: (input: {
    name: string;
    color: string;
    description: string;
  }) => void;
}

const DEFAULT_COLOR = DEFAULT_LIST_COLOR;

export function CreateStaticListModal({
  open,
  onOpenChange,
  contactCount,
  onCreate,
}: CreateStaticListModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");

  // Re-seed the form each time the modal opens.
  useEffect(() => {
    if (open) {
      setName("New Static List");
      setColor(DEFAULT_COLOR);
      setDescription("");
    }
  }, [open]);

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
          <Modal.Title>New Static List</Modal.Title>
          <Modal.Description>Create a fixed set of contacts</Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-4">
          <Field>
            <Field.Label>List Name</Field.Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New Static List"
            />
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
              placeholder="Describe who belongs in this list"
            />
          </Field>
        </Modal.Body>

        <Modal.Footer className="d-flex align-items-center">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{contactCount}</span> contacts
            selected
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>
            Create Static List
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
