import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/pro-regular-svg-icons";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Field } from "@buildoutinc/blueprint-react/ui/Field";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Textarea } from "@buildoutinc/blueprint-react/ui/Textarea";
import { Combobox } from "@buildoutinc/blueprint-react/ui/Combobox";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import {
  DEFAULT_LIST_COLOR,
  ListColorPicker,
} from "#/components/contacts/ListColorPicker";
import type { CallList } from "#/data/contactLists";
import type { Contact } from "#/data/types";
import {
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";

interface EditStaticListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  list: CallList;
  contacts: Contact[];
  onSave: (input: {
    name: string;
    color: string;
    description: string;
    contactIds: string[];
  }) => void;
}

interface ContactOption {
  value: string;
  label: string;
}

const DEFAULT_COLOR = DEFAULT_LIST_COLOR;

export function EditStaticListModal({
  open,
  onOpenChange,
  list,
  contacts,
  onSave,
}: EditStaticListModalProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (open) {
      setName(list.label);
      setColor(list.color ?? DEFAULT_COLOR);
      setDescription(list.description);
      setMemberIds(new Set(list.contactIds));
      setInputValue("");
    }
  }, [open, list]);

  const byId = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts],
  );

  // Members shown in the list, in the order they were added.
  const members = useMemo(
    () => [...memberIds].map((id) => byId.get(id)).filter(Boolean) as Contact[],
    [memberIds, byId],
  );

  // Addable contacts (not already members), as combobox options.
  const options = useMemo<ContactOption[]>(
    () =>
      contacts
        .filter((c) => !memberIds.has(c.id))
        .map((c) => ({
          value: c.id,
          label: c.company
            ? `${contactFullName(c)} · ${c.company}`
            : contactFullName(c),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [contacts, memberIds],
  );

  const addMember = (id: string) =>
    setMemberIds((prev) => new Set(prev).add(id));
  const removeMember = (id: string) =>
    setMemberIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const canSave = name.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      color,
      description: description.trim(),
      contactIds: [...memberIds],
    });
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
          <Modal.Title>Edit Static List</Modal.Title>
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

          <div className="d-flex flex-column gap-2">
            <span className="fw-bold">Add Contacts</span>
            <Combobox
              items={options}
              value={null}
              inputValue={inputValue}
              onInputValueChange={(v: string) => setInputValue(v)}
              onValueChange={(v) => {
                const opt = v as ContactOption | null;
                if (opt) {
                  addMember(opt.value);
                  setInputValue("");
                }
              }}
            >
              <Combobox.InputGroup>
                <InputGroup.Addon>
                  <FontAwesomeIcon icon={faMagnifyingGlass} />
                </InputGroup.Addon>
                <Combobox.Input placeholder="Search contacts to add..." />
              </Combobox.InputGroup>
              <Combobox.Content>
                <Combobox.Empty className="text-muted">
                  No matching contacts
                </Combobox.Empty>
                <Combobox.List>
                  {(item: ContactOption) => (
                    <Combobox.Item key={item.value} value={item}>
                      {item.label}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Content>
            </Combobox>

            {members.length === 0 ? (
              <Empty className="py-3">
                <Empty.Content>No contacts on this list yet.</Empty.Content>
              </Empty>
            ) : (
              <div className="d-flex flex-column">
                {members.map((c) => (
                  <div
                    key={c.id}
                    className="d-flex align-items-center gap-2 p-2 rounded-3"
                  >
                    <Avatar size="sm">
                      <Avatar.Fallback className="fw-semibold">
                        {contactInitials(c)}
                      </Avatar.Fallback>
                    </Avatar>
                    <span className="fw-semibold flex-grow-1 text-truncate">
                      {contactFullName(c)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${contactFullName(c)}`}
                      onClick={() => removeMember(c.id)}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer className="d-flex align-items-center">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{memberIds.size}</span> contacts
            selected
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
