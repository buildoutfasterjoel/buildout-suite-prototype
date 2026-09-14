import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./store";
import { buildBlankPage } from "./templates";
import { createBlock } from "./blocks/blockFactory";
import { PAGE_WIDTH } from "./types";
import type { Property } from "#/data/types";

const property = { id: "p1", name: "Test Asset", buildingSqFt: 1000 } as unknown as Property;

beforeEach(() => {
  useEditorStore.getState().initDocument(property, undefined, undefined);
});

const doc = () => useEditorStore.getState().document;
const pageById = (id: string) => doc().pages.find((p) => p.id === id)!;

/** A fresh blank page appended to the document, returned by id. */
function addBlankPage(): string {
  const page = buildBlankPage();
  useEditorStore.getState().insertPage(page);
  return page.id;
}

describe("blank pages", () => {
  it("are free canvases from birth", () => {
    expect(buildBlankPage().frames).toEqual({});
  });
});

describe("setFrame", () => {
  it("stores a clamped rect for the block", () => {
    const pageId = addBlankPage();
    const block = createBlock("text");
    useEditorStore.getState().insertBlock({ kind: "page", pageId, index: 0 }, block);

    useEditorStore.getState().setFrame(pageId, block.id, { x: -40, y: 80, w: 300, h: 120 });

    expect(pageById(pageId).frames?.[block.id]).toEqual({ x: 0, y: 80, w: 300, h: 120 });
  });
});

describe("adding a block to a free page", () => {
  it("gives it the frame it was dropped at", () => {
    const pageId = addBlankPage();
    useEditorStore
      .getState()
      .addBlock({ kind: "page", pageId, index: 0 }, "image", undefined, {
        x: 100, y: 200, w: 320, h: 220,
      });

    const page = pageById(pageId);
    const id = page.blocks[0].id;
    expect(page.frames?.[id]).toEqual({ x: 100, y: 200, w: 320, h: 220 });
  });

  it("stacks a block added without one below what is already there", () => {
    const pageId = addBlankPage();
    useEditorStore.getState().addBlock({ kind: "page", pageId, index: 0 }, "heading", undefined, {
      x: 40, y: 40, w: 400, h: 60,
    });
    useEditorStore.getState().addBlock({ kind: "page", pageId, index: 1 }, "text");

    const page = pageById(pageId);
    const second = page.frames![page.blocks[1].id];
    expect(second.y).toBeGreaterThanOrEqual(100);
    expect(second.x).toBe(40);
  });
});

describe("removeBlock", () => {
  it("takes the block's frame with it", () => {
    const pageId = addBlankPage();
    const block = createBlock("text");
    useEditorStore.getState().insertBlock({ kind: "page", pageId, index: 0 }, block);
    expect(pageById(pageId).frames?.[block.id]).toBeDefined();

    useEditorStore.getState().removeBlock(block.id);

    expect(pageById(pageId).frames?.[block.id]).toBeUndefined();
  });
});

describe("setBlockDepth", () => {
  it("moves a block to the front and back of the paint order", () => {
    const pageId = addBlankPage();
    const a = createBlock("text");
    const b = createBlock("text");
    useEditorStore.getState().insertBlock({ kind: "page", pageId, index: 0 }, a);
    useEditorStore.getState().insertBlock({ kind: "page", pageId, index: 1 }, b);

    useEditorStore.getState().setBlockDepth(a.id, "front");
    expect(pageById(pageId).blocks.map((x) => x.id)).toEqual([b.id, a.id]);

    useEditorStore.getState().setBlockDepth(a.id, "back");
    expect(pageById(pageId).blocks.map((x) => x.id)).toEqual([a.id, b.id]);
  });
});

describe("freePage", () => {
  it("converts a stacked page using the measured rects, and unlocks it", () => {
    const page = doc().pages[0];
    const ids = page.blocks.map((b) => b.id);
    const measured = Object.fromEntries(
      ids.map((id, i) => [id, { x: 40, y: 40 + i * 120, w: PAGE_WIDTH - 80, h: 100 }]),
    );

    useEditorStore.getState().freePage(page.id, measured);

    const converted = pageById(page.id);
    expect(converted.frames).toBeDefined();
    expect(converted.locked).toBe(false);
    expect(Object.keys(converted.frames!).length).toBe(converted.blocks.length);
  });

  it("leaves an already-free page alone", () => {
    const pageId = addBlankPage();
    const before = pageById(pageId);
    useEditorStore.getState().freePage(pageId, {});
    expect(pageById(pageId)).toBe(before);
  });
});
