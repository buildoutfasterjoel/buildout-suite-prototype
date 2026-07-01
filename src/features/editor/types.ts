import type { Property } from "#/data/types";

/**
 * Document model for the editor prototype.
 *
 * A Document is a stack of Pages; each Page is a vertical stack of Blocks
 * (heading, text, table, image). A table Cell may carry a `dynamicKey` that
 * resolves to a live value from the bound listing (e.g. `askingPrice`).
 *
 * Phase 1 only reads this model — selection + display. Mutation, add/remove,
 * and undo/redo land in later phases.
 */

export type TextAlign = "left" | "center" | "right" | "justify";
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";
export type BorderStyle = "none" | "solid" | "dashed" | "dotted";

/** Style shared by text-bearing content (headings, text blocks, table cells). */
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  letterSpacing: number;
  lineHeight: number;
  align: TextAlign;
  transform: TextTransform;
  color: string | null;
  background: string | null;
}

export interface TableStyle {
  borderWidth: number;
  borderStyle: BorderStyle;
  borderColor: string | null;
}

export interface CellStyle extends TextStyle {
  borderBottomWidth: number;
  borderBottomStyle: BorderStyle;
  borderBottomColor: string | null;
}

/** Keys of Property that can be surfaced as dynamic data tokens. */
export type DynamicKey = keyof Property;

export interface Cell {
  id: string;
  /** Static label/value; ignored when `dynamicKey` is set. */
  value: string;
  /** When set, the cell renders the listing's live value for this field. */
  dynamicKey?: DynamicKey;
  /** Optional currency/number formatting hint for dynamic values. */
  format?: "currency" | "currencyPerSf" | "percent" | "text";
  align?: TextAlign;
  header?: boolean;
  style: CellStyle;
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  text: string;
  style: TextStyle;
}

export interface TextBlock {
  id: string;
  type: "text";
  text: string;
  style: TextStyle;
}

export interface TableBlock {
  id: string;
  type: "table";
  title?: string;
  rows: Cell[][];
  style: TableStyle;
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string;
  alt: string;
}

/** A text-like block bound to a live listing field. */
export interface DynamicBlock {
  id: string;
  type: "dynamic";
  dynamicKey: DynamicKey;
  format?: Cell["format"];
  style: TextStyle;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  thickness: number;
  color: string;
  style: BorderStyle;
}

/**
 * Content (leaf) blocks may live at the top level of a page OR nested inside a
 * container. They never hold other blocks.
 */
export type ContentBlock =
  | HeadingBlock
  | TextBlock
  | TableBlock
  | ImageBlock
  | DynamicBlock
  | SpacerBlock
  | DividerBlock;

/** A horizontal split of 2 or 3 columns; each column holds content blocks. */
export interface ColumnsBlock {
  id: string;
  type: "columns";
  columnCount: 2 | 3;
  columns: ContentBlock[][];
}

/** A padded box grouping a vertical stack of content blocks. */
export interface SectionBlock {
  id: string;
  type: "section";
  padding: number;
  background: string | null;
  blocks: ContentBlock[];
}

/**
 * Container (layout) blocks live only at the top level. The one-level nesting
 * rule is enforced by their children being `ContentBlock[]` — never `Block[]`.
 */
export type ContainerBlock = ColumnsBlock | SectionBlock;

export type Block = ContentBlock | ContainerBlock;

export type BlockType = Block["type"];

/** Block types that can contain other (content) blocks. */
export type ContainerBlockType = ContainerBlock["type"];

/** An insertion point among a list of sibling blocks. */
export type DropTarget =
  | { kind: "page"; pageId: string; index: number }
  | { kind: "section"; blockId: string; index: number }
  | { kind: "column"; blockId: string; columnIndex: number; index: number };

export interface Page {
  id: string;
  name: string;
  /** Optional header logo shown at the top of the page. */
  logoSrc?: string;
  /**
   * Preset (template) pages: the layout is fixed — blocks can't be added,
   * moved, or deleted — but their content (text, headings, table cells, images)
   * stays editable. Absent/false = fully freeform.
   */
  locked?: boolean;
  blocks: Block[];
}

export interface EditorDocument {
  id: string;
  name: string;
  pages: Page[];
}

/** Which left-rail panel is active. */
export type NavPanel = "settings" | "pages" | "images" | "layers" | "blocks";

/** A selection points at a page, optionally a block, optionally a cell. */
export interface Selection {
  pageId: string;
  blockId?: string;
  cellId?: string;
}

/** US Letter at 96dpi — the fixed page size for the prototype. */
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;
