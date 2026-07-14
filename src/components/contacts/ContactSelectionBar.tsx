import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTag,
  faListUl,
  faCirclePlus,
  faCircleMinus,
  faDownload,
  faCodeMerge,
  faTrash,
  faEnvelope,
  faPhone,
  faChevronDown,
  faXmark,
} from "@fortawesome/pro-regular-svg-icons";
import { Button } from "@buildoutinc/blueprint-react/ui/Button";
import { DropdownMenu } from "@buildoutinc/blueprint-react/ui/DropdownMenu";

interface ContactSelectionBarProps {
  selectedCount: number;
  totalCount: number;
  allFilteredSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onNewList: () => void;
  onAddToList: () => void;
  /** Only shown while viewing a static list (removes from that list). */
  canRemoveFromList: boolean;
  onRemoveFromList: () => void;
}

/**
 * Bulk-actions bar shown when contacts are selected in the People table. Only
 * "New List" is wired; the other menu items are visual placeholders for now.
 */
export function ContactSelectionBar({
  selectedCount,
  totalCount,
  allFilteredSelected,
  onSelectAll,
  onClear,
  onNewList,
  onAddToList,
  canRemoveFromList,
  onRemoveFromList,
}: ContactSelectionBarProps) {
  return (
    <div className="contact-selection-bar d-flex align-items-center justify-content-between gap-3">
      <div className="d-flex align-items-center gap-3">
        <span>
          <span className="fw-semibold">{selectedCount} selected</span> of{" "}
          {totalCount}
        </span>
        {!allFilteredSelected && (
          <button
            type="button"
            className="contact-selection-bar__link btn btn-link p-0 text-decoration-none fw-semibold"
            onClick={onSelectAll}
          >
            Select all {totalCount} contacts
          </button>
        )}
      </div>

      <div className="d-flex align-items-center gap-2">
        <Button variant="outline" size="sm">
          <FontAwesomeIcon icon={faEnvelope} />
          Email
        </Button>
        <Button variant="outline" size="sm">
          <FontAwesomeIcon icon={faPhone} />
          Call
        </Button>
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button variant="outline" size="sm">
                More
                <FontAwesomeIcon icon={faChevronDown} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item>
              <FontAwesomeIcon icon={faTag} className="me-2" />
              Add Tags
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={onNewList}>
              <FontAwesomeIcon icon={faListUl} className="me-2" />
              New List
            </DropdownMenu.Item>
            <DropdownMenu.Item onClick={onAddToList}>
              <FontAwesomeIcon icon={faCirclePlus} className="me-2" />
              Add to a List
            </DropdownMenu.Item>
            {canRemoveFromList && (
              <DropdownMenu.Item onClick={onRemoveFromList}>
                <FontAwesomeIcon icon={faCircleMinus} className="me-2" />
                Remove From List
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item>
              <FontAwesomeIcon icon={faDownload} className="me-2" />
              Export to CSV
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item>
              <FontAwesomeIcon icon={faCodeMerge} className="me-2" />
              Merge Contacts
            </DropdownMenu.Item>
            <DropdownMenu.Item className="text-destructive">
              <FontAwesomeIcon icon={faTrash} className="me-2" />
              Delete Contacts
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <FontAwesomeIcon icon={faXmark} />
        </Button>
      </div>
    </div>
  );
}
