import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faHeading,
  faParagraph,
  faTable,
  faImage,
  faTableColumns,
  faSquareDashed,
  faArrowsUpDown,
  faGripLines,
  faListUl,
  faListOl,
  faMapLocationDot,
} from "@fortawesome/pro-regular-svg-icons";
import { plainTextPreview } from "../inlineTokens";
import type { Block, BlockType } from "../types";

export const BLOCK_ICONS: Record<BlockType, IconDefinition> = {
  heading: faHeading,
  text: faParagraph,
  table: faTable,
  image: faImage,
  list: faListUl,
  contents: faListOl,
  map: faMapLocationDot,
  columns: faTableColumns,
  section: faSquareDashed,
  spacer: faArrowsUpDown,
  divider: faGripLines,
};

/**
 * Short human label for a block — used in layers, breadcrumb, drag preview.
 *
 * Heading and text carry rich-text HTML with inline field tokens, so they go
 * through `plainTextPreview`: a bolded heading should read as its words, and a
 * heading that is entirely one token should read as that field's name, not as
 * `{{property.name}}`.
 */
export function blockLabel(block: Block): string {
  switch (block.type) {
    case "heading":
      return plainTextPreview(block.text) || "Heading";
    case "text":
      return plainTextPreview(block.text) || "Text";
    case "table":
      return block.title || "Table";
    case "image":
      return block.alt || "Image";
    case "list":
      return "List";
    case "contents":
      return "Table of Contents";
    case "map":
      return "Map";
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
