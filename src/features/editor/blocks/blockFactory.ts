import { getPhotoUrl } from "#/components/properties/propertyDisplay";
import type {
  Block,
  Cell,
  CellStyle,
  ContentBlock,
  TextStyle,
} from "../types";

/* ---- Shared font + style defaults (also used to seed the sample doc) ---- */
export const SERIF = "'PT Serif', Georgia, serif";
export const SANS = "'proxima-nova', system-ui, sans-serif";

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: SANS,
  fontSize: 14,
  bold: false,
  italic: false,
  underline: false,
  letterSpacing: 0,
  lineHeight: 0,
  align: "left",
  transform: "none",
  color: null,
  background: null,
};

export const DEFAULT_CELL_STYLE: CellStyle = {
  ...DEFAULT_TEXT_STYLE,
  fontSize: 11,
  borderBottomWidth: 0,
  borderBottomStyle: "none",
  borderBottomColor: null,
};

/* ---- Unique ids ---- */
let seq = 0;
export const uid = (prefix: string) => `${prefix}-${(seq += 1)}`;

function cell(value: string, header: boolean): Cell {
  return {
    id: uid("cell"),
    value,
    header,
    align: header ? "left" : "right",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

/** A fresh, empty table cell — used when inserting new rows/columns. */
export function createCell(opts?: { header?: boolean }): Cell {
  const header = opts?.header ?? false;
  return {
    id: uid("cell"),
    value: "",
    header,
    align: header ? "left" : "right",
    style: { ...DEFAULT_CELL_STYLE },
  };
}

/** A palette variant — currently only used to pick a Columns count. */
export interface BlockVariant {
  columnCount?: 2 | 3;
}

/**
 * Create a fresh block of the given type with sensible defaults and a unique
 * id. Containers are created empty so the user can drag content into them.
 */
export function createBlock(type: Block["type"], variant?: BlockVariant): Block {
  switch (type) {
    case "heading":
      return {
        id: uid("block"),
        type: "heading",
        text: "Heading",
        style: { ...DEFAULT_TEXT_STYLE, fontFamily: SERIF, fontSize: 24 },
      };
    case "text":
      return {
        id: uid("block"),
        type: "text",
        text: "Add your text here.",
        style: { ...DEFAULT_TEXT_STYLE, fontSize: 13, lineHeight: 22 },
      };
    case "table":
      return {
        id: uid("block"),
        type: "table",
        title: "Table",
        style: { borderWidth: 1, borderStyle: "solid", borderColor: "#d5dae2" },
        rows: [
          [cell("Label", true), cell("Value", false)],
          [cell("Label", true), cell("Value", false)],
        ],
      };
    case "image":
      return {
        id: uid("block"),
        type: "image",
        src: getPhotoUrl("editor-block", 640, 360),
        alt: "Image",
      };
    case "dynamic":
      return {
        id: uid("block"),
        type: "dynamic",
        dynamicKey: "name",
        format: "text",
        style: { ...DEFAULT_TEXT_STYLE, fontSize: 14 },
      };
    case "spacer":
      return { id: uid("block"), type: "spacer", height: 24 };
    case "divider":
      return {
        id: uid("block"),
        type: "divider",
        thickness: 1,
        color: "#d5dae2",
        style: "solid",
      };
    case "columns": {
      const columnCount = variant?.columnCount ?? 2;
      const columns: ContentBlock[][] = Array.from({ length: columnCount }, () => []);
      return { id: uid("block"), type: "columns", columnCount, columns };
    }
    case "section":
      return {
        id: uid("block"),
        type: "section",
        padding: 24,
        background: null,
        blocks: [],
      };
  }
}
