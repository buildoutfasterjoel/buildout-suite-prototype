import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "../store";
import { findBlock } from "../tree";
import {
  readPage,
  editBlockText,
  setTableCells,
  addTableRow,
  removeTableRow,
  setListItems,
  addBlock,
  removeBlock,
  moveBlock,
  addPage,
  removePage,
  renamePage,
  goToPage,
  setPageLocked,
} from "./editorTools";
import { TEMPLATES } from "../templates";
import {
  EDITOR_TOOL_DEFS,
  EDITOR_TOOL_LABELS,
  EDITOR_TOOL_LABELS_DONE,
} from "./editorToolDefs";
import { createBlock } from "../blocks/blockFactory";
import type { Property } from "#/data/types";
import type { ColumnsBlock, ListBlock, SectionBlock, TableBlock } from "../types";

// buildingSqFt and propertyType are required by the cover template's
// coverMetaLine (designer.ts), which initDocument builds unconditionally —
// mirrors the fixture in documentContext.test.ts.
const property = {
  id: "p1",
  name: "Rowan Center",
  city: "Austin",
  propertyType: "Office",
  buildingSqFt: 24000,
} as unknown as Property;

beforeEach(() => {
  useEditorStore.getState().initDocument(property, undefined, undefined);
});

const doc = () => useEditorStore.getState().document;
const firstPage = () => doc().pages[0];

/**
 * Add a fresh block of `type` to page 1 and return it, for tools to act on.
 *
 * Goes through the store's `insertBlock` rather than the `addBlock` tool: page 1
 * is a locked template page, and this helper is about seeding a target, not
 * about exercising the lock.
 */
function seed(type: "heading" | "text" | "table" | "list") {
  const block = createBlock(type);
  useEditorStore
    .getState()
    .insertBlock({ kind: "page", pageId: firstPage().id, index: 0 }, block);
  return block;
}

describe("readPage", () => {
  it("returns the page's blocks with ids and types", () => {
    const result = readPage({ pageId: firstPage().id }) as { blocks: Array<{ id: string }> };
    expect(result.blocks.map((b) => b.id)).toEqual(firstPage().blocks.map((b) => b.id));
  });

  it("returns a table's cell ids, not just the block's id", () => {
    // "Make page 4 match page 2" is the whole reason this tool exists, and it
    // is unanswerable without cellIds — a `{ id, type }` summary would keep
    // every other assertion in this file green.
    const table = seed("table") as TableBlock;
    const result = readPage({ pageId: firstPage().id }) as {
      blocks: Array<{ id: string; rows?: Array<Array<{ id: string; value: string }>> }>;
    };
    const described = result.blocks.find((b) => b.id === table.id);
    expect(described?.rows?.[0]?.[0]?.id).toBe(table.rows[0][0].id);
  });

  it("describes a container's children in one shape with the context snapshot", () => {
    // `documentContext` folds the ACTIVE page into the prompt and `readPage`
    // answers for every other one, so the two must agree: flat `children`
    // carrying `columnIndex`, plus `columnCount` so an empty column is
    // visible rather than an out-of-range surprise.
    const pageId = blankPageId();
    const columns = addBlock({ pageId, type: "columns" }) as { blockId: string };
    const child = addBlock({
      pageId,
      type: "heading",
      containerBlockId: columns.blockId,
      columnIndex: 1,
    }) as { blockId: string };

    const result = readPage({ pageId }) as {
      blocks: Array<{
        id: string;
        columnCount?: number;
        children?: Array<{ id: string; columnIndex?: number }>;
      }>;
    };
    const described = result.blocks.find((b) => b.id === columns.blockId);
    const live = findBlock(doc(), columns.blockId) as ColumnsBlock;
    expect(described?.columnCount).toBe(live.columnCount);
    expect(described?.children?.map((c) => c.id)).toEqual([child.blockId]);
    expect(described?.children?.[0]?.columnIndex).toBe(1);
  });

  it("reports a list's dynamic binding, so a doomed setListItems is never tried", () => {
    const list = seed("list");
    useEditorStore.setState((s) => ({
      document: {
        ...s.document,
        pages: s.document.pages.map((p) =>
          p.id === firstPage().id
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === list.id ? { ...b, dynamicKey: "marketing.saleBullets" } : b,
                ),
              }
            : p,
        ),
      },
    }));

    const result = readPage({ pageId: firstPage().id }) as {
      blocks: Array<{ id: string; dynamicKey?: string }>;
    };
    expect(result.blocks.find((b) => b.id === list.id)?.dynamicKey).toBe(
      "marketing.saleBullets",
    );
  });

  it("errors for an unknown page id", () => {
    expect(readPage({ pageId: "nope" })).toEqual({ error: expect.stringContaining("nope") });
  });
});

describe("editBlockText", () => {
  it("replaces a text block's content", () => {
    const block = seed("text");
    editBlockText({ blockId: block.id, text: "A rare infill asset." });
    expect((findBlock(doc(), block.id) as { text: string }).text).toBe("A rare infill asset.");
  });

  it("round-trips an inline liquid token unchanged", () => {
    const block = seed("text");
    const withToken = "Located in {{property.city}} with <b>24,000 SF</b>";
    editBlockText({ blockId: block.id, text: withToken });
    expect((findBlock(doc(), block.id) as { text: string }).text).toBe(withToken);
  });

  it("errors on a block that carries no text", () => {
    const block = seed("table");
    expect(editBlockText({ blockId: block.id, text: "x" })).toEqual({
      error: expect.stringContaining("table"),
    });
  });

  it("errors for an unknown block id", () => {
    expect(editBlockText({ blockId: "nope", text: "x" })).toEqual({
      error: expect.stringContaining("nope"),
    });
  });

  it("is allowed on a locked page", () => {
    // Page 1 of the sample Proposal ships locked, which is exactly the case
    // under test — content editable, layout frozen. No setup needed.
    expect(firstPage().locked).toBe(true);
    const block = seed("text");
    expect(editBlockText({ blockId: block.id, text: "Still editable" })).not.toHaveProperty(
      "error",
    );
    expect((findBlock(doc(), block.id) as { text: string }).text).toBe("Still editable");
  });
});

describe("setTableCells", () => {
  it("applies a batch of cell values", () => {
    const block = seed("table") as TableBlock;
    const [a, b] = [block.rows[0][0].id, block.rows[0][1].id];

    setTableCells({
      blockId: block.id,
      cells: [
        { cellId: a, value: "Asking Price" },
        { cellId: b, value: "$5,400,000" },
      ],
    });

    const table = findBlock(doc(), block.id) as TableBlock;
    expect(table.rows[0][0].value).toBe("Asking Price");
    expect(table.rows[0][1].value).toBe("$5,400,000");
  });

  it("errors on an unknown cellId without applying any of the batch", () => {
    const block = seed("table") as TableBlock;
    const good = block.rows[0][0].id;
    const before = (findBlock(doc(), block.id) as TableBlock).rows[0][0].value;

    const result = setTableCells({
      blockId: block.id,
      cells: [
        { cellId: good, value: "Changed" },
        { cellId: "no-such-cell", value: "Nope" },
      ],
    });

    expect(result).toEqual({ error: expect.stringContaining("no-such-cell") });
    expect((findBlock(doc(), block.id) as TableBlock).rows[0][0].value).toBe(before);
  });

  it("refuses a data-bound cell instead of writing a value nothing renders", () => {
    // A bound cell renders `resolveDynamic`, so a `value` written here would
    // never appear on the canvas — and the canvas is the broker's only way to
    // verify what Otto claims it did. The refusal names the cell and its key
    // so the model can explain itself, and the unbound cell in the same batch
    // must be left alone.
    const block = seed("table") as TableBlock;
    const bound = block.rows[0][0].id;
    const free = block.rows[0][1].id;
    useEditorStore.setState((s) => ({
      document: {
        ...s.document,
        pages: s.document.pages.map((p) =>
          p.id === firstPage().id
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === block.id
                    ? {
                        ...b,
                        rows: (b as TableBlock).rows.map((row) =>
                          row.map((c) =>
                            c.id === bound ? { ...c, dynamicKey: "askingPrice" as const } : c,
                          ),
                        ),
                      }
                    : b,
                ),
              }
            : p,
        ),
      },
    }));

    const result = setTableCells({
      blockId: block.id,
      cells: [
        { cellId: bound, value: "$9,000,000" },
        { cellId: free, value: "Changed" },
      ],
    });

    expect(result).toEqual({ error: expect.stringContaining("askingPrice") });
    const table = findBlock(doc(), block.id) as TableBlock;
    expect(table.rows[0][0].value).not.toBe("$9,000,000");
    expect(table.rows[0][1].value).not.toBe("Changed");
  });

  it("errors when the block is not a table", () => {
    const block = seed("text");
    expect(setTableCells({ blockId: block.id, cells: [] })).toEqual({
      error: expect.stringContaining("text"),
    });
  });
});

describe("addTableRow / removeTableRow", () => {
  it("appends a row and fills it with the given values", () => {
    const block = seed("table") as TableBlock;
    const before = (findBlock(doc(), block.id) as TableBlock).rows.length;

    addTableRow({ blockId: block.id, values: ["Cap Rate", "6.5%"] });

    const table = findBlock(doc(), block.id) as TableBlock;
    expect(table.rows.length).toBe(before + 1);
    expect(table.rows[before].map((c) => c.value)).toEqual(["Cap Rate", "6.5%"]);
  });

  it("removes the row at the given index", () => {
    const block = seed("table") as TableBlock;
    const before = (findBlock(doc(), block.id) as TableBlock).rows.length;

    removeTableRow({ blockId: block.id, index: 0 });

    expect((findBlock(doc(), block.id) as TableBlock).rows.length).toBe(before - 1);
  });

  it("reports how many cells the values filled", () => {
    const block = seed("table") as TableBlock;
    const result = addTableRow({ blockId: block.id, values: ["Cap Rate"] });
    expect(result).toMatchObject({ ok: true, filled: 1 });
  });

  it("errors on a non-integer row index rather than throwing", () => {
    // `clampIndex` passes 1.5 through and `splice` truncates it, so the fill
    // step would read `rows[1.5]` — undefined — and throw. No tool may throw.
    const block = seed("table");
    expect(() => addTableRow({ blockId: block.id, index: 1.5, values: ["x"] })).not.toThrow();
    expect(addTableRow({ blockId: block.id, index: 1.5, values: ["x"] })).toEqual({
      error: expect.stringContaining("1.5"),
    });
  });

  it("refuses more values than the table has columns, adding no row", () => {
    const block = seed("table") as TableBlock;
    const columns = block.rows[0].length;
    const before = (findBlock(doc(), block.id) as TableBlock).rows.length;

    const result = addTableRow({
      blockId: block.id,
      values: Array.from({ length: columns + 1 }, (_, i) => `v${i}`),
    });

    expect(result).toEqual({ error: expect.stringContaining(String(columns)) });
    expect((findBlock(doc(), block.id) as TableBlock).rows.length).toBe(before);
  });

  it("errors for an out-of-range row index", () => {
    const block = seed("table");
    expect(removeTableRow({ blockId: block.id, index: 99 })).toEqual({
      error: expect.stringContaining("99"),
    });
  });
});

describe("setListItems", () => {
  it("grows a list to the target length", () => {
    const block = seed("list");
    setListItems({ blockId: block.id, items: ["One", "Two", "Three", "Four"] });
    expect((findBlock(doc(), block.id) as ListBlock).items).toEqual([
      "One",
      "Two",
      "Three",
      "Four",
    ]);
  });

  it("shrinks a list to the target length", () => {
    const block = seed("list");
    setListItems({ blockId: block.id, items: ["Only one"] });
    expect((findBlock(doc(), block.id) as ListBlock).items).toEqual(["Only one"]);
  });

  it("errors on an empty item list", () => {
    const block = seed("list");
    expect(setListItems({ blockId: block.id, items: [] })).toEqual({
      error: expect.stringContaining("empty"),
    });
  });

  it("errors when the list is bound to a dynamic field", () => {
    const block = seed("list");
    useEditorStore.setState((s) => ({
      document: {
        ...s.document,
        pages: s.document.pages.map((p) =>
          p.id === firstPage().id
            ? {
                ...p,
                blocks: p.blocks.map((b) =>
                  b.id === block.id ? { ...b, dynamicKey: "marketing.saleBullets" } : b,
                ),
              }
            : p,
        ),
      },
    }));
    expect(setListItems({ blockId: block.id, items: ["x"] })).toEqual({
      error: expect.stringContaining("bound"),
    });
  });
});

/** A freeform page to exercise structural edits that shouldn't hit the lock. */
function blankPageId(): string {
  const result = addPage({ template: "blank" }) as { pageId: string };
  return result.pageId;
}

describe("addBlock", () => {
  it("inserts a block at the requested index", () => {
    const pageId = blankPageId();
    const page = () => doc().pages.find((p) => p.id === pageId)!;
    const before = page().blocks.length;
    const result = addBlock({ pageId, index: 0, type: "heading" }) as { blockId: string };

    expect(page().blocks.length).toBe(before + 1);
    expect(page().blocks[0].id).toBe(result.blockId);
  });

  it("appends when no index is given", () => {
    const pageId = blankPageId();
    const page = () => doc().pages.find((p) => p.id === pageId)!;
    const result = addBlock({ pageId, type: "text" }) as { blockId: string };
    expect(page().blocks[page().blocks.length - 1].id).toBe(result.blockId);
  });

  it("builds a table with its rows already populated", () => {
    const result = addBlock({
      pageId: blankPageId(),
      type: "table",
      content: {
        title: "Rent Roll",
        headerRow: true,
        rows: [
          ["Suite", "Tenant", "SF"],
          ["100", "Acme Co", "4,200"],
          ["200", "Vacant", "3,800"],
        ],
      },
    }) as { blockId: string };

    const table = findBlock(doc(), result.blockId) as TableBlock;
    expect(table.title).toBe("Rent Roll");
    expect(table.rows.length).toBe(3);
    expect(table.rows[1].map((c) => c.value)).toEqual(["100", "Acme Co", "4,200"]);
    expect(table.rows[0][0].header).toBe(true);
    expect(table.rows[1][0].header).toBe(false);
  });

  it("pads a ragged rows array to the widest row", () => {
    // The renderer derives its column count from `rows[0]` alone, so a short
    // totals row would give the table the wrong geometry and a misaligned
    // edit overlay — permanently, since there is no undo.
    const result = addBlock({
      pageId: blankPageId(),
      type: "table",
      content: {
        headerRow: true,
        rows: [
          ["Suite", "Tenant", "SF"],
          ["Total", "9,000"],
        ],
      },
    }) as { blockId: string };

    const table = findBlock(doc(), result.blockId) as TableBlock;
    expect(table.rows.map((row) => row.length)).toEqual([3, 3]);
    expect(table.rows[1].map((c) => c.value)).toEqual(["Total", "9,000", ""]);
  });

  it("builds a heading with its text", () => {
    const result = addBlock({
      pageId: blankPageId(),
      type: "heading",
      content: { text: "Investment Highlights" },
    }) as { blockId: string };
    expect((findBlock(doc(), result.blockId) as { text: string }).text).toBe(
      "Investment Highlights",
    );
  });

  it("builds a list with its items and marker", () => {
    const result = addBlock({
      pageId: blankPageId(),
      type: "list",
      content: { items: ["Rare infill site", "Below-market rents"], marker: "bullet" },
    }) as { blockId: string };
    expect((findBlock(doc(), result.blockId) as ListBlock).items).toEqual([
      "Rare infill site",
      "Below-market rents",
    ]);
  });

  it("unlocks a locked page and reports it, rather than refusing", () => {
    // Page 1 of the sample Proposal ships locked, like every template page.
    expect(firstPage().locked).toBe(true);
    const before = firstPage().blocks.length;

    const result = addBlock({ pageId: firstPage().id, type: "text" }) as {
      blockId: string;
      unlockedPages?: string[];
    };

    expect(result).not.toHaveProperty("error");
    expect(firstPage().blocks.length).toBe(before + 1);
    expect(firstPage().locked).toBe(false);
    // Reported so the prompt can require Otto to mention it.
    expect(result.unlockedPages).toEqual([firstPage().name]);
  });

  it("does not report an unlock on a page that was already freeform", () => {
    const result = addBlock({ pageId: blankPageId(), type: "text" }) as {
      unlockedPages?: string[];
    };
    expect(result.unlockedPages).toBeUndefined();
  });

  it("refuses a container inside a container", () => {
    const pageId = blankPageId();
    const section = addBlock({ pageId, type: "section" }) as { blockId: string };
    const result = addBlock({
      pageId,
      type: "columns",
      containerBlockId: section.blockId,
    });
    expect(result).toEqual({ error: expect.stringContaining("container") });
  });

  it("errors for an unknown page id", () => {
    expect(addBlock({ pageId: "nope", type: "text" })).toEqual({
      error: expect.stringContaining("nope"),
    });
  });

  it("does not unlock the page when the call is refused", () => {
    // A bogus containerBlockId on a locked page: the call fails, and the
    // page's lock must be untouched — not silently unfrozen along the way.
    expect(firstPage().locked).toBe(true);

    const result = addBlock({ pageId: firstPage().id, type: "text", containerBlockId: "nope" });

    expect(result).toEqual({ error: expect.stringContaining("nope") });
    expect(firstPage().locked).toBe(true);
  });
});

describe("removeBlock", () => {
  it("removes the block", () => {
    const added = addBlock({ pageId: blankPageId(), type: "text" }) as { blockId: string };
    const result = removeBlock({ blockId: added.blockId });
    expect(result).not.toHaveProperty("error");
    expect(findBlock(doc(), added.blockId)).toBeNull();
  });

  it("unlocks a locked page to remove a block from it", () => {
    const target = firstPage().blocks[0];
    const pageName = firstPage().name;
    expect(firstPage().locked).toBe(true);

    const result = removeBlock({ blockId: target.id }) as { unlockedPages?: string[] };

    expect(result).not.toHaveProperty("error");
    expect(findBlock(doc(), target.id)).toBeNull();
    expect(result.unlockedPages).toEqual([pageName]);
  });

  it("reports how many children went with a container", () => {
    // Removing a section takes its whole subtree. With no undo, a bare
    // `{ ok: true }` would let Otto confirm a deletion far larger than the
    // one the broker asked for.
    const pageId = blankPageId();
    const section = addBlock({ pageId, type: "section" }) as { blockId: string };
    addBlock({ pageId, type: "text", containerBlockId: section.blockId });
    addBlock({ pageId, type: "heading", containerBlockId: section.blockId });

    const result = removeBlock({ blockId: section.blockId });

    expect(result).toMatchObject({ ok: true, removedChildren: 2 });
  });

  it("reports no children for a plain content block", () => {
    const added = addBlock({ pageId: blankPageId(), type: "text" }) as { blockId: string };
    expect(removeBlock({ blockId: added.blockId })).not.toHaveProperty("removedChildren");
  });

  it("errors for an unknown block id", () => {
    expect(removeBlock({ blockId: "nope" })).toEqual({ error: expect.stringContaining("nope") });
  });
});

describe("moveBlock", () => {
  it("moves a block to a new index on the same page", () => {
    const pageId = blankPageId();
    const page = () => doc().pages.find((p) => p.id === pageId)!;
    const added = addBlock({ pageId, type: "text" }) as { blockId: string };

    moveBlock({ blockId: added.blockId, pageId, index: 0 });

    expect(page().blocks[0].id).toBe(added.blockId);
  });

  it("unlocks both the source and the destination page as needed", () => {
    const source = firstPage();
    const target = source.blocks[0];
    const destination = doc().pages[1];
    expect(source.locked).toBe(true);
    expect(destination.locked).toBe(true);

    const result = moveBlock({ blockId: target.id, pageId: destination.id, index: 0 }) as {
      unlockedPages?: string[];
    };

    expect(result).not.toHaveProperty("error");
    expect(doc().pages[0].locked).toBe(false);
    expect(doc().pages[1].locked).toBe(false);
    expect(doc().pages[1].blocks[0].id).toBe(target.id);
    // Both names, in source-then-destination order. The lock flags alone would
    // still pass if the report collapsed to one page — and this report is the
    // branch's central safety contract: it is the only way the broker hears
    // that a template's layout was unfrozen on their behalf.
    expect(result.unlockedPages).toEqual([source.name, destination.name]);
  });

  it("errors for an unknown destination page", () => {
    const added = addBlock({ pageId: blankPageId(), type: "text" }) as { blockId: string };
    expect(moveBlock({ blockId: added.blockId, pageId: "nope", index: 0 })).toEqual({
      error: expect.stringContaining("nope"),
    });
  });

  it("moves a block into a section block", () => {
    const pageId = blankPageId();
    const page = () => doc().pages.find((p) => p.id === pageId)!;
    const section = addBlock({ pageId, type: "section" }) as { blockId: string };
    const text = addBlock({ pageId, type: "text" }) as { blockId: string };

    const result = moveBlock({
      blockId: text.blockId,
      pageId,
      index: 0,
      containerBlockId: section.blockId,
    });

    expect(result).not.toHaveProperty("error");
    expect(page().blocks.some((b) => b.id === text.blockId)).toBe(false);
    const sectionBlock = page().blocks.find((b) => b.id === section.blockId) as SectionBlock;
    expect(sectionBlock.blocks[0]?.id).toBe(text.blockId);
  });

  it("refuses a bogus containerBlockId, leaving the block in place", () => {
    const pageId = blankPageId();
    const added = addBlock({ pageId, type: "text" }) as { blockId: string };

    const result = moveBlock({
      blockId: added.blockId,
      pageId,
      index: 0,
      containerBlockId: "nope",
    });

    expect(result).toEqual({ error: expect.stringContaining("nope") });
    expect(findBlock(doc(), added.blockId)).not.toBeNull();
  });

  it("refuses an out-of-range columnIndex, leaving the block in place", () => {
    const pageId = blankPageId();
    const columns = addBlock({ pageId, type: "columns" }) as { blockId: string };
    const added = addBlock({ pageId, type: "text" }) as { blockId: string };

    const result = moveBlock({
      blockId: added.blockId,
      pageId,
      index: 0,
      containerBlockId: columns.blockId,
      columnIndex: 5,
    });

    expect(result).toEqual({ error: expect.stringContaining("5") });
    expect(findBlock(doc(), added.blockId)).not.toBeNull();
  });

  it("refuses a non-integer columnIndex, leaving the block in place", () => {
    // The live data-loss path: the store's moveBlock removes the block from
    // its old spot unconditionally, then reinserts by `ci === columnIndex`,
    // which a fractional index never matches — the block would vanish rather
    // than error if this weren't caught first.
    const pageId = blankPageId();
    const columns = addBlock({ pageId, type: "columns" }) as { blockId: string };
    const added = addBlock({ pageId, type: "text" }) as { blockId: string };

    const result = moveBlock({
      blockId: added.blockId,
      pageId,
      index: 0,
      containerBlockId: columns.blockId,
      columnIndex: 1.5,
    });

    expect(result).toEqual({ error: expect.stringContaining("1.5") });
    expect(findBlock(doc(), added.blockId)).not.toBeNull();
  });

  it("refuses moving a container block into another container", () => {
    const pageId = blankPageId();
    const outer = addBlock({ pageId, type: "section" }) as { blockId: string };
    const inner = addBlock({ pageId, type: "columns" }) as { blockId: string };

    const result = moveBlock({
      blockId: inner.blockId,
      pageId,
      index: 0,
      containerBlockId: outer.blockId,
    });

    expect(result).toEqual({ error: expect.stringContaining("container") });
    expect(findBlock(doc(), inner.blockId)).not.toBeNull();
  });
});

describe("setPageLocked", () => {
  it("freezes a page on request", () => {
    const pageId = blankPageId();
    expect(setPageLocked({ pageId, locked: true })).not.toHaveProperty("error");
    expect(doc().pages.find((p) => p.id === pageId)?.locked).toBe(true);
  });

  it("unfreezes a template page on request", () => {
    setPageLocked({ pageId: firstPage().id, locked: false });
    expect(firstPage().locked).toBe(false);
  });

  it("errors for an unknown page id", () => {
    expect(setPageLocked({ pageId: "nope", locked: false })).toEqual({
      error: expect.stringContaining("nope"),
    });
  });
});

describe("addPage", () => {
  it("resolves every designer template key", () => {
    for (const template of TEMPLATES) {
      useEditorStore.getState().initDocument(property, undefined, undefined);
      const before = doc().pages.length;
      const result = addPage({ template: template.key });
      expect(result).not.toHaveProperty("error");
      expect(doc().pages.length).toBe(before + 1);
    }
  });

  it("adds a blank page", () => {
    const before = doc().pages.length;
    addPage({ template: "blank" });
    expect(doc().pages.length).toBe(before + 1);
  });

  it("uses the given name and index", () => {
    addPage({ template: "blank", name: "Executive Summary", atIndex: 1 });
    expect(doc().pages[1].name).toBe("Executive Summary");
  });

  it("asks the canvas to scroll to the new page, not just mark it active", () => {
    // `activePageId` alone proves nothing: with a Canvas mounted its
    // viewport-tracking effect recomputes that field the moment the page list
    // changes, so this test used to pass in jsdom precisely because the
    // feature it names was broken in the browser. `pendingScrollPageId` is the
    // request the Canvas acts on, so asserting it fails if the scroll
    // mechanism is removed.
    const result = addPage({ template: "blank" }) as { pageId: string };
    expect(useEditorStore.getState().activePageId).toBe(result.pageId);
    expect(useEditorStore.getState().pendingScrollPageId).toBe(result.pageId);
  });

  it("errors on an unknown template key rather than silently falling back", () => {
    const before = doc().pages.length;
    expect(addPage({ template: "not-a-template" })).toEqual({
      error: expect.stringContaining("not-a-template"),
    });
    expect(doc().pages.length).toBe(before);
  });
});

describe("removePage / renamePage", () => {
  it("removes a page", () => {
    const target = doc().pages[1].id;
    removePage({ pageId: target });
    expect(doc().pages.some((p) => p.id === target)).toBe(false);
  });

  it("refuses to remove the last remaining page", () => {
    while (doc().pages.length > 1) removePage({ pageId: doc().pages[doc().pages.length - 1].id });
    expect(removePage({ pageId: firstPage().id })).toEqual({
      error: expect.stringContaining("only page"),
    });
  });

  it("renames a page", () => {
    renamePage({ pageId: firstPage().id, name: "Cover" });
    expect(firstPage().name).toBe("Cover");
  });

  it("errors renaming an unknown page", () => {
    expect(renamePage({ pageId: "nope", name: "x" })).toEqual({
      error: expect.stringContaining("nope"),
    });
  });
});

describe("goToPage", () => {
  it("requests the scroll that actually moves the canvas", () => {
    const target = doc().pages[1].id;
    expect(goToPage({ pageId: target })).not.toHaveProperty("error");
    expect(useEditorStore.getState().activePageId).toBe(target);
    // The tool's description promises a scroll. Setting `activePageId` alone
    // doesn't scroll anything and the Canvas overwrites it from the viewport,
    // so the pending request is what makes the promise true.
    expect(useEditorStore.getState().pendingScrollPageId).toBe(target);
  });

  it("errors for an unknown page id", () => {
    expect(goToPage({ pageId: "nope" })).toEqual({ error: expect.stringContaining("nope") });
  });
});

describe("EDITOR_TOOL_DEFS", () => {
  it("carries all fourteen tools", () => {
    expect(EDITOR_TOOL_DEFS.length).toBe(14);
  });

  it("has a unique name per tool", () => {
    const names = EDITOR_TOOL_DEFS.map((def) => def.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("has a UI label for every tool", () => {
    // A renamed tool with a stale label falls back to a de-snaked raw name in
    // the chip — "set page locked" instead of prose — which nothing else
    // catches.
    for (const def of EDITOR_TOOL_DEFS) {
      expect(EDITOR_TOOL_LABELS[def.name]).toBeDefined();
    }
  });

  it("has a past-tense label for every tool", () => {
    // The settled line reads in the past tense; a tool missing from this map
    // falls back to the running label and reads as still in flight.
    for (const def of EDITOR_TOOL_DEFS) {
      expect(EDITOR_TOOL_LABELS_DONE[def.name]).toBeDefined();
    }
  });

  it("carries no execute — every call must be a client tool call", () => {
    // No server-side execute is what makes the runtime request a client tool
    // call, which is the whole reason document content never leaves the
    // browser. Protecting that in a test, not just in review.
    for (const def of EDITOR_TOOL_DEFS) {
      expect(def).not.toHaveProperty("execute");
    }
  });
});
