import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { Checkbox } from "@buildoutinc/blueprint-react/ui/Checkbox";
import { Avatar } from "@buildoutinc/blueprint-react/ui/Avatar";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import type { Contact } from "#/data/types";
import {
  contactFullName,
  contactInitials,
} from "#/components/contacts/contactDisplay";

interface AddContactsToListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listLabel: string;
  contacts: Contact[];
  /** Contacts already on the list — excluded from the picker. */
  existingIds: Set<string>;
  onAdd: (ids: string[]) => void;
}

export function AddContactsToListModal({
  open,
  onOpenChange,
  listLabel,
  contacts,
  existingIds,
  onAdd,
}: AddContactsToListModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(new Set());
    }
  }, [open]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c) => !existingIds.has(c.id))
      .filter((c) => {
        if (!q) return true;
        return `${contactFullName(c)} ${c.email} ${c.company}`
          .toLowerCase()
          .includes(q);
      });
  }, [contacts, existingIds, query]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleAdd = () => {
    if (selected.size === 0) return;
    onAdd([...selected]);
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
          <Modal.Title>Add contacts</Modal.Title>
          <Modal.Description>
            Search and add contacts to “{listLabel}”.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-2">
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search by name, email, and company"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>

          {candidates.length === 0 ? (
            <Empty className="py-4">
              <Empty.Content>No contacts match your search.</Empty.Content>
            </Empty>
          ) : (
            <div
              className="d-flex flex-column"
              style={{ maxHeight: 340, overflowY: "auto" }}
            >
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className="add-to-list__row d-flex align-items-center gap-2 mb-0 p-2 rounded-3"
                >
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    aria-label={`Select ${contactFullName(c)}`}
                  />
                  <Avatar size="sm">
                    <Avatar.Fallback className="fw-semibold">
                      {contactInitials(c)}
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="d-flex flex-column lh-sm flex-grow-1 min-w-0">
                    <span className="fw-semibold text-truncate">
                      {contactFullName(c)}
                    </span>
                    <span className="fs-small text-muted text-truncate">
                      {c.email}
                      {c.company ? ` · ${c.company}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="d-flex align-items-center">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{selected.size}</span> selected
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={selected.size === 0}
          >
            Add to list
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
