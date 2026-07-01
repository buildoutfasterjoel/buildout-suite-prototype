import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGripDotsVertical, faTrashCan } from "@fortawesome/pro-regular-svg-icons";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
import { useEditorStore } from "../store";
import type { Block } from "../types";
import { listDroppableId, type DragOverData, type ListLocation } from "./dndTypes";

/**
 * Wraps a canvas content block: drag handle (the only drag activator, so clicks
 * still select and table cells stay clickable), a delete affordance when
 * selected, an insertion line when it's the drop target, and sortable transforms.
 */
export function SortableBlock({
  blockId,
  label,
  blockType,
  list,
  index,
  selected,
  located = false,
  children,
}: {
  blockId: string;
  label: string;
  blockType: Block["type"];
  list: ListLocation;
  index: number;
  selected: boolean;
  located?: boolean;
  children: ReactNode;
}) {
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const data: DragOverData = {
    source: "block",
    blockId,
    label,
    dropKind: "item",
    list,
    index,
  };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: blockId, data });

  return (
    <div
      ref={setNodeRef}
      className={`bo-editor-sortable${located ? " is-located" : ""}`}
      data-block-id={blockId}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {isOver && !isDragging && <div className="bo-editor-drop-line" />}

      {/* Tables are fixed in the template — no move handle. */}
      {blockType !== "table" && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="bo-editor-drag-handle"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <FontAwesomeIcon icon={faGripDotsVertical} />
        </button>
      )}

      {/* Tables provide their own delete in the floating toolbar. */}
      {selected && blockType !== "table" && (
        <Tooltip>
          <Tooltip.Trigger
            render={
              <button
                type="button"
                className="bo-editor-block-delete"
                aria-label={`Delete ${blockType}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeBlock(blockId);
                }}
              >
                <FontAwesomeIcon icon={faTrashCan} />
              </button>
            }
          />
          <Tooltip.Content>Delete {blockType}</Tooltip.Content>
        </Tooltip>
      )}

      {children}
    </div>
  );
}

/**
 * Drop zone for a list — the end-of-list catch area and the empty-container
 * placeholder. Accepts drops that append at the end (index = length).
 */
export function ListDropZone({
  list,
  length,
  empty,
}: {
  list: ListLocation;
  length: number;
  empty: boolean;
}) {
  const data: DragOverData = { dropKind: "list", list, length };
  const { setNodeRef, isOver } = useDroppable({ id: listDroppableId(list), data });
  return (
    <div
      ref={setNodeRef}
      className={`bo-editor-dropzone${empty ? " is-empty" : ""}${isOver ? " is-over" : ""}`}
    >
      {empty ? "Drag blocks here" : null}
    </div>
  );
}
