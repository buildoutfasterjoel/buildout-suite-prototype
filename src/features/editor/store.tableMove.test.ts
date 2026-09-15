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

const tableBlock = (): TableBlock => {
  const page = useEditorStore.getState().document.pages[0];
  return page.blocks.find((b) => b.id === blockId) as TableBlock;
};

const grid = (): string[][] => tableBlock().rows.map((row) => row.map((c) => c.value));

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

describe("colWidths upkeep", () => {
  it("stays absent on a table nobody resized", () => {
    useEditorStore.getState().addColumn(blockId, 1);
    useEditorStore.getState().removeColumn(blockId, 0);
    expect(tableBlock().colWidths).toBeUndefined();
  });

  it("follows a column being added, removed and moved", () => {
    const store = () => useEditorStore.getState();
    store().setColWidths(blockId, [90, 30, 60]);

    // A new column arrives at the average of the ones already there.
    store().addColumn(blockId, 1);
    expect(tableBlock().colWidths).toEqual([90, 60, 30, 60]);

    store().removeColumn(blockId, 1);
    expect(tableBlock().colWidths).toEqual([90, 30, 60]);

    // A column keeps its width when it moves.
    store().moveColumn(blockId, 0, 2);
    expect(tableBlock().colWidths).toEqual([30, 60, 90]);
  });
});

describe("setCellsFormat", () => {
  it("formats every listed cell and leaves the rest alone", () => {
    const rows = tableBlock().rows;
    const targets = [rows[0][0].id, rows[1][1].id];
    useEditorStore.getState().setCellsFormat(blockId, targets, { bold: true, align: "center" });

    const after = tableBlock().rows;
    expect(after[0][0].style.bold).toBe(true);
    expect(after[0][0].align).toBe("center");
    expect(after[1][1].style.bold).toBe(true);
    expect(after[0][1].style.bold).toBe(false);
    expect(after[0][1].align).toBe(rows[0][1].align);
  });
});
