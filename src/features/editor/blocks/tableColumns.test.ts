import { describe, expect, it } from "vitest";
import { MIN_COL_PX, columnPercents, columnWeights, resizeColumns } from "./tableColumns";
import type { TableBlock } from "../types";

const table = (cols: number, colWidths?: number[]): TableBlock =>
  ({
    id: "t1",
    type: "table",
    rows: [Array.from({ length: cols }, (_, i) => ({ id: `c${i}` }))],
    colWidths,
    style: { borderWidth: 1, borderStyle: "solid", borderColor: null },
  }) as unknown as TableBlock;

describe("columnWeights", () => {
  it("is null until a column has been resized", () => {
    expect(columnWeights(table(3))).toBeNull();
  });

  it("falls back to auto layout when the widths don't match the columns", () => {
    expect(columnWeights(table(3, [100, 100]))).toBeNull();
  });

  it("reads the weights when they line up", () => {
    expect(columnWeights(table(2, [120, 80]))).toEqual([120, 80]);
  });
});

describe("columnPercents", () => {
  it("normalizes any weights to percentages of the total", () => {
    expect(columnPercents([120, 80])).toEqual([60, 40]);
    expect(columnPercents([3, 1])).toEqual([75, 25]);
  });
});

describe("resizeColumns", () => {
  it("trades width between the two columns at the boundary", () => {
    expect(resizeColumns([100, 100, 100], 1, 20)).toEqual([120, 80, 100]);
    expect(resizeColumns([100, 100, 100], 1, -20)).toEqual([80, 120, 100]);
  });

  it("stops at the minimum column width instead of collapsing a column", () => {
    expect(resizeColumns([100, 100], 1, 500)).toEqual([200 - MIN_COL_PX, MIN_COL_PX]);
    expect(resizeColumns([100, 100], 1, -500)).toEqual([MIN_COL_PX, 200 - MIN_COL_PX]);
  });

  it("leaves the outer edges and unknown boundaries alone", () => {
    expect(resizeColumns([100, 100], 0, 20)).toEqual([100, 100]);
    expect(resizeColumns([100, 100], 2, 20)).toEqual([100, 100]);
  });

  it("never moves a boundary when both neighbours are already too narrow", () => {
    const tiny = [10, 10];
    expect(resizeColumns(tiny, 1, 5)).toEqual(tiny);
  });
});
