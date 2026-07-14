import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass } from "@fortawesome/pro-regular-svg-icons";
import { Modal } from "@buildoutinc/blueprint-react/ui/Modal";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { Input } from "@buildoutinc/blueprint-react/ui/Input";
import { InputGroup } from "@buildoutinc/blueprint-react/ui/InputGroup";
import { RadioGroup } from "@buildoutinc/blueprint-react/ui/RadioGroup";
import { Empty } from "@buildoutinc/blueprint-react/ui/Empty";
import type { CallList } from "#/data/contactLists";

interface AddToListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Static lists the selected contacts can be added to. */
  lists: CallList[];
  contactCount: number;
  onAdd: (listId: string) => void;
}

export function AddToListModal({
  open,
  onOpenChange,
  lists,
  contactCount,
  onAdd,
}: AddToListModalProps) {
  const [query, setQuery] = useState("");
  const [listId, setListId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setListId(null);
    }
  }, [open]);

  const visibleLists = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? lists.filter((l) => l.label.toLowerCase().includes(q))
      : lists;
  }, [lists, query]);

  const canAdd = listId !== null;

  const handleAdd = () => {
    if (!listId) return;
    onAdd(listId);
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
          <Modal.Title>Add to list</Modal.Title>
        </Modal.Header>

        <Modal.Body className="d-flex flex-column gap-2">
          <InputGroup>
            <InputGroup.Addon>
              <FontAwesomeIcon icon={faMagnifyingGlass} />
            </InputGroup.Addon>
            <Input
              type="search"
              placeholder="Search lists..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>

          {visibleLists.length === 0 ? (
            <Empty className="py-4">
              <Empty.Content>
                {lists.length === 0
                  ? "No static lists yet — create one from a selection."
                  : "No lists match your search."}
              </Empty.Content>
            </Empty>
          ) : (
            <RadioGroup
              value={listId ?? ""}
              onValueChange={(v) => setListId(v as string)}
              className="d-flex flex-column"
            >
              {visibleLists.map((list) => (
                <label
                  key={list.id}
                  className="add-to-list__row d-flex align-items-center gap-2 mb-0 p-3 rounded-3"
                >
                  <RadioGroup.Item value={list.id} />
                  <span className="fw-semibold flex-grow-1">{list.label}</span>
                  <span className="text-muted">
                    {list.contactIds.length} contacts
                  </span>
                </label>
              ))}
            </RadioGroup>
          )}
        </Modal.Body>

        <Modal.Footer className="d-flex align-items-center">
          <span className="text-muted flex-grow-1">
            <span className="fw-bold text-body">{contactCount}</span> contacts
            will be added
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAdd} disabled={!canAdd}>
            Add to list
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
