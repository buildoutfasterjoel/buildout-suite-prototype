import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faHeading,
  faParagraph,
  faTable,
  faImage,
  faDatabase,
  faTableColumns,
  faSquareDashed,
  faArrowsUpDown,
  faGripLines,
  faListUl,
} from "@fortawesome/pro-regular-svg-icons";
import { DYNAMIC_FIELD_LABELS } from "../dynamic";
import type { Block, BlockType } from "../types";

export const BLOCK_ICONS: Record<BlockType, IconDefinition> = {
  heading: faHeading,
  text: faParagraph,
  table: faTable,
  image: faImage,
  dynamic: faDatabase,
  list: faListUl,
  columns: faTableColumns,
  section: faSquareDashed,
  spacer: faArrowsUpDown,
  divider: faGripLines,
};

/** Short human label for a block — used in layers, breadcrumb, drag preview. */
export function blockLabel(block: Block): string {
  switch (block.type) {
    case "heading":
      return block.text || "Heading";
    case "text":
      return block.text || "Text";
    case "table":
      return block.title || "Table";
    case "image":
      return block.alt || "Image";
    case "dynamic":
      return DYNAMIC_FIELD_LABELS[block.dynamicKey] ?? "Dynamic Field";
    case "list":
      return "List";
    case "columns":
      return `${block.columnCount} Columns`;
    case "section":
      return "Section";
    case "spacer":
      return "Spacer";
    case "divider":
      return "Divider";
  }
}
