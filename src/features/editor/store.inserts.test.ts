import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "./store";
import { buildBlankPage } from "./templates";
import { createBlock } from "./blocks/blockFactory";
import type { Property } from "#/data/types";

const property = { id: "p1", name: "Test Asset", buildingSqFt: 1000 } as unknown as Property;

beforeEach(() => {
  useEditorStore.getState().initDocument(property, undefined, undefined);
});

const doc = () => useEditorStore.getState().document;
const firstPage = () => doc().pages[0];

describe("insertBlock", () => {
  it("inserts a pre-built block at the requested index, content intact", () => {
    const block = createBlock("heading");
    (block as { text: string }).text = "Investment Highlights";
    const before = firstPage().blocks.length;

    useEditorStore
      .getState()
      .insertBlock({ kind: "page", pageId: firstPage().id, index: 0 }, block);

    expect(firstPage().blocks.length).toBe(before + 1);
    expect(firstPage().blocks[0].id).toBe(block.id);
    expect(firstPage().blocks[0]).toMatchObject({ type: "heading", text: "Investment Highlights" });
  });

  it("selects the inserted block and marks the document dirty", () => {
    const block = createBlock("text");
    useEditorStore
      .getState()
      .insertBlock({ kind: "page", pageId: firstPage().id, index: 0 }, block);

    expect(useEditorStore.getState().selection).toEqual({
      pageId: firstPage().id,
      blockId: block.id,
    });
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it("refuses a container inside a container", () => {
    const section = createBlock("section");
    useEditorStore
      .getState()
      .insertBlock({ kind: "page", pageId: firstPage().id, index: 0 }, section);
    const before = JSON.stringify(doc());

    useEditorStore
      .getState()
      .insertBlock({ kind: "section", blockId: section.id, index: 0 }, createBlock("columns"));

    expect(JSON.stringify(doc())).toBe(before);
  });
});

describe("insertPage", () => {
  it("appends when no index is given", () => {
    const page = buildBlankPage();
    const before = doc().pages.length;

    useEditorStore.getState().insertPage(page);

    expect(doc().pages.length).toBe(before + 1);
    expect(doc().pages[doc().pages.length - 1].id).toBe(page.id);
  });

  it("inserts at the given index and mirrors into templateDocument", () => {
    const page = buildBlankPage();
    useEditorStore.getState().insertPage(page, 1);

    expect(doc().pages[1].id).toBe(page.id);
    // The mirror is what keeps table reset working on pages added later.
    expect(useEditorStore.getState().templateDocument.pages[1].id).toBe(page.id);
  });

  it("makes the new page the active one", () => {
    const page = buildBlankPage();
    useEditorStore.getState().insertPage(page);

    expect(useEditorStore.getState().activePageId).toBe(page.id);
    expect(useEditorStore.getState().dirty).toBe(true);
  });
});

describe("setPageLocked", () => {
  it("unfreezes a locked page in both documents", () => {
    const id = firstPage().id;
    // Every page in a real document starts locked — that is the point of this action.
    expect(firstPage().locked).toBe(true);

    useEditorStore.getState().setPageLocked(id, false);

    expect(doc().pages[0].locked).toBe(false);
    expect(useEditorStore.getState().templateDocument.pages[0].locked).toBe(false);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it("freezes a page again", () => {
    const id = firstPage().id;
    useEditorStore.getState().setPageLocked(id, false);
    useEditorStore.getState().setPageLocked(id, true);
    expect(doc().pages[0].locked).toBe(true);
  });

  it("leaves the document untouched for an unknown page id", () => {
    const before = JSON.stringify(doc());
    useEditorStore.getState().setPageLocked("no-such-page", false);
    expect(JSON.stringify(doc())).toBe(before);
  });
});

describe("renamePage", () => {
  it("renames the page in both documents", () => {
    const id = firstPage().id;
    useEditorStore.getState().renamePage(id, "Executive Summary");

    expect(doc().pages[0].name).toBe("Executive Summary");
    expect(useEditorStore.getState().templateDocument.pages[0].name).toBe("Executive Summary");
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it("leaves the document untouched for an unknown page id", () => {
    const before = JSON.stringify(doc());
    useEditorStore.getState().renamePage("no-such-page", "Nope");
    expect(JSON.stringify(doc())).toBe(before);
  });
});
