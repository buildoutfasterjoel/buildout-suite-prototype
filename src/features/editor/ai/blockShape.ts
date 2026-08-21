import type { Block, BlockType, ContentBlock } from "../types";

/**
 * One block, flattened for the agent — ids, types, and editable content.
 *
 * There is exactly one of these shapes on purpose. Both the context snapshot
 * (`documentContext.ts`, the whole active page folded into the system prompt)
 * and the `readPage` tool (`editorTools.ts`, any other page on demand) describe
 * blocks with this function, so a model that reads one page from context and
 * another from a tool call sees the same structure twice rather than two
 * near-identical dialects. They started as separate serializers and drifted
 * three ways within one branch — container children, list bindings, and column
 * count all disagreed — which is why they are now one.
 */
export interface EditorAgentBlock {
  id: string;
  type: BlockType;
  /** heading/text — the STORED form, inline `{{tokens}}` intact. */
  text?: string;
  /** table */
  title?: string;
  rows?: Array<Array<{ id: string; value: string; dynamicKey?: string }>>;
  /** list */
  items?: string[];
  /**
   * A live data binding. On a list, its items come from the deal's copy and
   * `setListItems` refuses; on a cell (see `rows`), its value is resolved at
   * render time and `setTableCells` refuses. Present only when bound.
   */
  dynamicKey?: string;
  /** image */
  alt?: string;
  /**
   * How many columns a `columns` block has. Emitted even when some of them are
   * empty — otherwise an empty column is invisible to the agent, which would
   * then have its `columnIndex` refused for being out of a range it couldn't
   * see.
   */
  columnCount?: number;
  /** Which column this block sits in — set only on a `columns` child. */
  columnIndex?: number;
  /**
   * columns/section children, one level deep. Same per-type shape as a
   * top-level block (a nested table still carries `rows` with cell ids, a
   * nested image still carries `alt`) — a container child is a real block,
   * not a lighter-weight label.
   */
  children?: EditorAgentBlock[];
}

/**
 * Serialize one block.
 *
 * Heading/text keep their stored form rather than a rendered preview — the
 * agent writes back into the same field, so it has to see the `{{tokens}}` it
 * must preserve. `dynamicKey` is emitted only where it exists, so its presence
 * always means "bound, don't overwrite".
 */
export function describeBlock(block: Block): EditorAgentBlock {
  switch (block.type) {
    case "heading":
    case "text":
      return { id: block.id, type: block.type, text: block.text };
    case "table":
      return {
        id: block.id,
        type: "table",
        title: block.title,
        rows: block.rows.map((row) =>
          row.map((c) => ({
            id: c.id,
            value: c.value,
            ...(c.dynamicKey ? { dynamicKey: c.dynamicKey } : {}),
          })),
        ),
      };
    case "list":
      return {
        id: block.id,
        type: "list",
        items: block.items,
        ...(block.dynamicKey ? { dynamicKey: block.dynamicKey } : {}),
      };
    case "image":
      return { id: block.id, type: "image", alt: block.alt };
    case "section":
      return {
        id: block.id,
        type: "section",
        children: block.blocks.map((child) => describeChild(child)),
      };
    case "columns":
      return {
        id: block.id,
        type: "columns",
        columnCount: block.columnCount,
        children: block.columns.flatMap((col, columnIndex) =>
          col.map((child) => describeChild(child, columnIndex)),
        ),
      };
    default:
      return { id: block.id, type: block.type };
  }
}

/**
 * Describe a container's child, one level deep. `ContentBlock` never contains
 * a further container (the model's one-level nesting rule), so this delegates
 * straight to `describeBlock` for the per-type shape rather than keeping a
 * second, lighter-weight summary that can drift out of sync with it — that
 * drift is exactly how a nested table's cell ids went missing before. Only
 * `columnIndex` is added on top, since a section child doesn't carry one.
 */
function describeChild(block: ContentBlock, columnIndex?: number): EditorAgentBlock {
  const described = describeBlock(block);
  return columnIndex === undefined ? described : { ...described, columnIndex };
}
