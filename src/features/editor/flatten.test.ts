import { describe, expect, it } from "vitest";
import { flattenForFree } from "./frames";
import type { ColumnsBlock, Page, Rect, SectionBlock } from "./types";

const box = (x: number, y: number): Rect => ({ x, y, w: 200, h: 100 });

const heading = (id: string) =>
  ({ id, type: "heading", text: "H", style: {} }) as unknown as Page["blocks"][number];

function pageWith(blocks: Page["blocks"]): Page {
  return { id: "page-1", name: "Test", locked: true, blocks };
}

describe("flattenForFree", () => {
  it("promotes a columns block's children and drops the container", () => {
    const columns = {
      id: "cols",
      type: "columns",
      columnCount: 2,
      columns: [[heading("a")], [heading("b")]],
    } as unknown as ColumnsBlock;

    const { blocks, frames } = flattenForFree(pageWith([columns]), {
      a: box(40, 40),
      b: box(440, 40),
    });

    expect(blocks.map((b) => b.id)).toEqual(["a", "b"]);
    expect(frames.cols).toBeUndefined();
    expect(frames.a).toEqual(box(40, 40));
    expect(frames.b).toEqual(box(440, 40));
  });

  it("keeps a section as a background box behind its promoted children", () => {
    const section = {
      id: "band",
      type: "section",
      padding: 32,
      background: "#12263f",
      blocks: [heading("title")],
    } as unknown as SectionBlock;

    const { blocks, frames } = flattenForFree(pageWith([section]), {
      band: box(0, 600),
      title: box(40, 640),
    });

    // The band is first, so it paints behind the title it used to contain.
    expect(blocks.map((b) => b.id)).toEqual(["band", "title"]);
    expect((blocks[0] as SectionBlock).blocks).toEqual([]);
    expect(frames.band).toEqual(box(0, 600));
  });

  it("keeps top-level blocks in their original order", () => {
    const { blocks } = flattenForFree(pageWith([heading("a"), heading("b"), heading("c")]), {
      a: box(0, 0),
      b: box(0, 120),
      c: box(0, 240),
    });
    expect(blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("never loses a block that could not be measured", () => {
    const { blocks, frames } = flattenForFree(pageWith([heading("ghost")]), {});
    expect(blocks.map((b) => b.id)).toEqual(["ghost"]);
    expect(frames.ghost).toBeDefined();
  });
});
