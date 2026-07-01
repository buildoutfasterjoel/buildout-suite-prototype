import type {
  Block,
  Cell,
  ContentBlock,
  DropTarget,
  EditorDocument,
  Page,
} from "./types";

/** Container block types can hold child content blocks. */
export function isContainer(block: Block): boolean {
  return block.type === "columns" || block.type === "section";
}

/** Find a block anywhere in the document (top level or one level deep). */
export function findBlock(doc: EditorDocument, blockId: string): Block | null {
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      if (block.id === blockId) return block;
      if (block.type === "section") {
        const child = block.blocks.find((b) => b.id === blockId);
        if (child) return child;
      } else if (block.type === "columns") {
        for (const col of block.columns) {
          const child = col.find((b) => b.id === blockId);
          if (child) return child;
        }
      }
    }
  }
  return null;
}

/**
 * Locate a block's current position, expressed as the DropTarget that would
 * re-insert it where it is. Used to correct the reorder off-by-one when a block
 * moves within the same list.
 */
export function findLocation(
  doc: EditorDocument,
  blockId: string,
): DropTarget | null {
  for (const page of doc.pages) {
    const topIndex = page.blocks.findIndex((b) => b.id === blockId);
    if (topIndex !== -1) {
      return { kind: "page", pageId: page.id, index: topIndex };
    }
    for (const block of page.blocks) {
      if (block.type === "section") {
        const i = block.blocks.findIndex((b) => b.id === blockId);
        if (i !== -1) return { kind: "section", blockId: block.id, index: i };
      } else if (block.type === "columns") {
        for (let ci = 0; ci < block.columns.length; ci++) {
          const i = block.columns[ci].findIndex((b) => b.id === blockId);
          if (i !== -1) {
            return { kind: "column", blockId: block.id, columnIndex: ci, index: i };
          }
        }
      }
    }
  }
  return null;
}

/** Whether two drop targets address the same sibling list. */
export function sameList(a: DropTarget, b: DropTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "page" && b.kind === "page") return a.pageId === b.pageId;
  if (a.kind === "section" && b.kind === "section") return a.blockId === b.blockId;
  if (a.kind === "column" && b.kind === "column") {
    return a.blockId === b.blockId && a.columnIndex === b.columnIndex;
  }
  return false;
}

/** Map every block list in a page (top level + container children) immutably. */
function mapPageBlockLists(
  page: Page,
  fn: (list: Block[]) => Block[],
): Page {
  const top = fn(page.blocks).map((block) => {
    if (block.type === "section") {
      return { ...block, blocks: fn(block.blocks) as ContentBlock[] };
    }
    if (block.type === "columns") {
      return {
        ...block,
        columns: block.columns.map((col) => fn(col) as ContentBlock[]),
      };
    }
    return block;
  });
  return { ...page, blocks: top };
}

/** Remove a block by id from anywhere in the document. */
export function removeBlock(
  doc: EditorDocument,
  blockId: string,
): { doc: EditorDocument; removed: Block | null } {
  let removed: Block | null = null;
  const pages = doc.pages.map((page) =>
    mapPageBlockLists(page, (list) =>
      list.filter((b) => {
        if (b.id === blockId) {
          removed = b;
          return false;
        }
        return true;
      }),
    ),
  );
  return { doc: { ...doc, pages }, removed };
}

function spliceInto<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  const i = Math.max(0, Math.min(index, next.length));
  next.splice(i, 0, item);
  return next;
}

/**
 * Rewrite the rows of a table block found anywhere in the document (top level
 * or one level deep), returning a new document. Non-table or unmatched ids are
 * left untouched.
 */
export function updateTableRows(
  doc: EditorDocument,
  blockId: string,
  fn: (rows: Cell[][]) => Cell[][],
): EditorDocument {
  const update = (block: Block): Block =>
    block.id === blockId && block.type === "table"
      ? { ...block, rows: fn(block.rows) }
      : block;

  const pages = doc.pages.map((page) =>
    mapPageBlockLists(page, (list) => list.map(update)),
  );
  return { ...doc, pages };
}

/** Replace a block by id (anywhere in the document) with a new block. */
export function replaceBlock(
  doc: EditorDocument,
  blockId: string,
  replacement: Block,
): EditorDocument {
  const pages = doc.pages.map((page) =>
    mapPageBlockLists(page, (list) =>
      list.map((b) => (b.id === blockId ? replacement : b)),
    ),
  );
  return { ...doc, pages };
}

/** Insert a block at the given drop target, returning a new document. */
export function insertAt(
  doc: EditorDocument,
  target: DropTarget,
  block: Block,
): EditorDocument {
  const pages = doc.pages.map((page) => {
    if (target.kind === "page") {
      if (page.id !== target.pageId) return page;
      return { ...page, blocks: spliceInto(page.blocks, target.index, block) };
    }

    // Container targets: locate the container block by id within this page.
    const blocks = page.blocks.map((b) => {
      if (b.id !== target.blockId) return b;
      if (target.kind === "section" && b.type === "section") {
        return {
          ...b,
          blocks: spliceInto(b.blocks, target.index, block as ContentBlock),
        };
      }
      if (target.kind === "column" && b.type === "columns") {
        return {
          ...b,
          columns: b.columns.map((col, ci) =>
            ci === target.columnIndex
              ? spliceInto(col, target.index, block as ContentBlock)
              : col,
          ),
        };
      }
      return b;
    });
    return { ...page, blocks };
  });
  return { ...doc, pages };
}
