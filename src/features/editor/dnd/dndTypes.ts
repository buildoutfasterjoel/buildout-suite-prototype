import type { Block, DropTarget } from "../types";
import type { BlockVariant } from "../blocks/blockFactory";

/** Which sibling list a draggable item or drop zone belongs to. */
export type ListLocation =
  | { kind: "page"; pageId: string }
  | { kind: "section"; blockId: string }
  | { kind: "column"; blockId: string; columnIndex: number };

/**
 * Data attached to draggables/droppables. A canvas block is both (via
 * useSortable), so its data carries every field; the palette source and the
 * list-level drop zone each carry only their relevant half.
 */
export type DragOverData = {
  /** Drag source — present on draggables. */
  source?: "palette" | "block";
  blockType?: Block["type"];
  variant?: BlockVariant;
  blockId?: string;
  label?: string;
  /** Drop target — present on droppables. */
  dropKind?: "item" | "list";
  list?: ListLocation;
  index?: number;
  length?: number;
};

/** Stable droppable id for a list (empty container / end-of-list zone). */
export function listDroppableId(list: ListLocation): string {
  switch (list.kind) {
    case "page":
      return `list:page:${list.pageId}`;
    case "section":
      return `list:section:${list.blockId}`;
    case "column":
      return `list:column:${list.blockId}:${list.columnIndex}`;
  }
}

/** Resolve a hovered list + index into a store DropTarget. */
export function toDropTarget(list: ListLocation, index: number): DropTarget {
  switch (list.kind) {
    case "page":
      return { kind: "page", pageId: list.pageId, index };
    case "section":
      return { kind: "section", blockId: list.blockId, index };
    case "column":
      return {
        kind: "column",
        blockId: list.blockId,
        columnIndex: list.columnIndex,
        index,
      };
  }
}
