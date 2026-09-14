import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "./store";
import { createBlock } from "./blocks/blockFactory";
import type { Property } from "#/data/types";
import type { TableBlock } from "./types";

const property = { id: "p1", name: "Test Asset", buildingSqFt: 1000 } as unknown as Property;

let blockId = "";

beforeEach(() => {
  const store = useEditorStore.getState();
  store.initDocument(property, undefined, undefined);
  const table = createBlock("table") as TableBlock;
  blockId = table.id;
  // Label each cell "r<row>c<col>" so a move is readable in the assertion.
  table.rows = table.rows.map((row, ri) =>
    row.map((cell, ci) => ({ ...cell, value: `r${ri}c${ci}` })),
  );
  const pageId = useEditorStore.getState().document.pages[0].id;
  store.insertBlock({ kind: "page", pageId, index: 0 }, table);
});

const grid = (): string[][] => {
  const page = useEditorStore.getState().document.pages[0];
  const table = page.blocks.find((b) => b.id === blockId) as TableBlock;
  return table.rows.map((row) => row.map((c) => c.value));
};

describe("moveRow / moveColumn", () => {
  it("moves a row down and back up", () => {
    const start = grid();
    useEditorStore.getState().moveRow(blockId, 0, 1);
    expect(grid()).toEqual([start[1], start[0], ...start.slice(2)]);

    useEditorStore.getState().moveRow(blockId, 1, 0);
    expect(grid()).toEqual(start);
  });

  it("moves a column right and back left", () => {
    const start = grid();
    useEditorStore.getState().moveColumn(blockId, 0, 1);
    expect(grid()).toEqual(start.map((row) => [row[1], row[0], ...row.slice(2)]));

    useEditorStore.getState().moveColumn(blockId, 1, 0);
    expect(grid()).toEqual(start);
  });

  it("is a no-op past either end", () => {
    const start = grid();
    useEditorStore.getState().moveRow(blockId, 0, -1);
    useEditorStore.getState().moveRow(blockId, 0, start.length);
    useEditorStore.getState().moveColumn(blockId, 0, -1);
    useEditorStore.getState().moveColumn(blockId, 0, start[0].length);
    expect(grid()).toEqual(start);
  });
});
