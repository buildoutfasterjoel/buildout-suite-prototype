import { describe, expect, it, beforeEach } from "vitest";
import { useEditorStore } from "../store";
import { createBlock } from "../blocks/blockFactory";
import { buildEditorContext, serializeEditorContext } from "./documentContext";
import type { DealMarketing, Property } from "#/data/types";

const property = {
  id: "p1",
  name: "Rowan Center",
  street: "120 Rowan Ave",
  city: "Austin",
  state: "TX",
  propertyType: "Office",
  buildingSqFt: 24000,
  askingPrice: 5400000,
  capRate: 6.5,
  yearBuilt: 1998,
} as unknown as Property;

// Sale and lease copy both present, as they are on a real deal — the snapshot
// must carry both rather than guess which one the document is about.
const marketing = {
  saleTitle: "Rowan Center — For Sale",
  saleDescription: "A 24,000 SF office asset in central Austin.",
  saleBullets: ["Below-market rents", "Rare infill site"],
  leaseTitle: "Space available at Rowan Center",
  leaseDescription: "Suites from 2,000 SF.",
  leaseBullets: [],
  locationDescription: "",
} as unknown as DealMarketing;

beforeEach(() => {
  useEditorStore.getState().initDocument(property, undefined, undefined);
});

describe("buildEditorContext", () => {
  it("lists every page in the outline with its index and name", () => {
    const ctx = buildEditorContext();
    const pages = useEditorStore.getState().document.pages;

    expect(ctx.pages.length).toBe(pages.length);
    expect(ctx.document.pageCount).toBe(pages.length);
    ctx.pages.forEach((p, i) => {
      expect(p.id).toBe(pages[i].id);
      expect(p.name).toBe(pages[i].name);
      expect(p.index).toBe(i);
    });
  });

  it("serializes the active page's blocks with their ids and types", () => {
    const ctx = buildEditorContext();
    const active = useEditorStore.getState().document.pages[0];

    expect(ctx.activePage?.id).toBe(active.id);
    expect(ctx.activePage?.blocks.length).toBe(active.blocks.length);
    expect(ctx.activePage?.blocks.map((b) => b.id)).toEqual(active.blocks.map((b) => b.id));
  });

  it("includes table cell ids so the agent can address a cell", () => {
    const active = useEditorStore.getState().document.pages[0];
    const table = createBlock("table");
    useEditorStore.getState().insertBlock({ kind: "page", pageId: active.id, index: 0 }, table);

    const ctx = buildEditorContext();
    const ctxTable = ctx.activePage?.blocks.find((b) => b.id === table.id);
    expect(ctxTable?.rows).toBeTruthy();
    expect(ctxTable?.rows?.[0]?.[0]?.id).toBeTruthy();
  });

  it("includes a container-nested table's cell ids, not just its title", () => {
    const active = useEditorStore.getState().document.pages[0];
    const store = useEditorStore.getState();
    const section = createBlock("section");
    store.insertBlock({ kind: "page", pageId: active.id, index: 0 }, section);
    const table = createBlock("table");
    store.insertBlock({ kind: "section", blockId: section.id, index: 0 }, table);

    const ctx = buildEditorContext();
    const ctxSection = ctx.activePage?.blocks.find((b) => b.id === section.id);
    const ctxTable = ctxSection?.children?.find((c) => c.id === table.id);
    expect(ctxTable?.rows).toBeTruthy();
    expect(ctxTable?.rows?.[0]?.[0]?.id).toBeTruthy();
  });

  it("resolves the selected block's type", () => {
    const active = useEditorStore.getState().document.pages[0];
    const block = active.blocks[0];
    useEditorStore.getState().select({ pageId: active.id, blockId: block.id });

    const ctx = buildEditorContext();
    expect(ctx.selection).toMatchObject({
      pageId: active.id,
      blockId: block.id,
      blockType: block.type,
    });
  });

  it("resolves the selected block's type when nested inside a container", () => {
    const active = useEditorStore.getState().document.pages[0];
    const store = useEditorStore.getState();
    const section = createBlock("section");
    store.insertBlock({ kind: "page", pageId: active.id, index: 0 }, section);
    const child = createBlock("heading");
    store.insertBlock({ kind: "section", blockId: section.id, index: 0 }, child);
    store.select({ pageId: active.id, blockId: child.id });

    const ctx = buildEditorContext();
    // A top-level-only lookup would leave this without a `blockType` — the
    // very regression `findBlock` (over a bare `.find`) exists to prevent.
    expect(ctx.selection).toMatchObject({
      pageId: active.id,
      blockId: child.id,
      blockType: "heading",
    });
  });

  it("reports null selection when nothing is selected", () => {
    useEditorStore.getState().clearSelection();
    expect(buildEditorContext().selection).toBeNull();
  });

  it("names a columns block's column count and its children's columns", () => {
    const active = useEditorStore.getState().document.pages[0];
    const store = useEditorStore.getState();
    const columns = createBlock("columns");
    store.insertBlock({ kind: "page", pageId: active.id, index: 0 }, columns);
    const child = createBlock("heading");
    store.insertBlock({ kind: "column", blockId: columns.id, columnIndex: 1, index: 0 }, child);

    const ctx = buildEditorContext();
    const described = ctx.activePage?.blocks.find((b) => b.id === columns.id);
    // Without `columnCount` an empty column is invisible to the agent, which
    // then has its `columnIndex` refused for being outside a range it had no
    // way to see. `readPage` emits the same shape — see editorTools.test.ts.
    expect(described?.columnCount).toBe(2);
    expect(described?.children?.[0]?.id).toBe(child.id);
    expect(described?.children?.[0]?.columnIndex).toBe(1);
  });

  it("marks a list's dynamic binding, so the agent doesn't try to rewrite it", () => {
    const active = useEditorStore.getState().document.pages[0];
    const list = createBlock("list");
    useEditorStore.getState().insertBlock({ kind: "page", pageId: active.id, index: 0 }, list);
    useEditorStore.setState((s) => ({
      document: {
        ...s.document,
        pages: s.document.pages.map((p) =>
          p.id === active.id
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

    const ctx = buildEditorContext();
    expect(ctx.activePage?.blocks.find((b) => b.id === list.id)?.dynamicKey).toBe(
      "marketing.saleBullets",
    );
  });

  it("carries the bound listing's facts", () => {
    const ctx = buildEditorContext();
    expect(ctx.listing).toMatchObject({
      name: "Rowan Center",
      city: "Austin",
      state: "TX",
      propertyType: "Office",
      askingPrice: 5400000,
    });
  });

  it("emits marketing copy under the field names the agent can write", () => {
    useEditorStore.getState().initDocument(property, undefined, marketing);
    const ctx = buildEditorContext();
    // Real field names, so what Otto reads matches the
    // `{{marketing.saleTitle}}` token it can write and the field every
    // designer template binds. No sale-vs-lease guess is made here — the store
    // holds no dealType to make one from.
    expect(ctx.listing?.marketing).toEqual({
      saleTitle: marketing.saleTitle,
      saleDescription: marketing.saleDescription,
      saleBullets: marketing.saleBullets,
      leaseTitle: marketing.leaseTitle,
      leaseDescription: marketing.leaseDescription,
    });
  });

  it("omits marketing fields the broker hasn't written", () => {
    useEditorStore.getState().initDocument(property, undefined, marketing);
    const copy = buildEditorContext().listing?.marketing;
    // An absent key is a shorter, truer "nothing here yet" than an empty
    // string the agent might quote back into the document.
    expect(copy).not.toHaveProperty("leaseBullets");
    expect(copy).not.toHaveProperty("locationDescription");
  });

  it("reports an empty marketing object when no copy is bound", () => {
    expect(buildEditorContext().listing?.marketing).toEqual({});
  });

  it("reports a null listing when no document is bound", () => {
    useEditorStore.getState().initDocument(undefined, undefined, undefined);
    expect(buildEditorContext().listing).toBeNull();
  });
});

describe("serializeEditorContext", () => {
  it("produces parseable JSON under the cap", () => {
    const out = serializeEditorContext(buildEditorContext());
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("respects a tight byte cap", () => {
    // 900 bytes sits below the sample document's own page-outline floor (14
    // pages, ~1.3KB+), which is never dropped — see the next test — so no
    // cap that tight is achievable. 2000 sits above that floor, so the cap
    // itself is honored for real rather than by a vacuous "smaller than
    // untrimmed" comparison.
    const out = serializeEditorContext(buildEditorContext(), 2000);
    expect(out.length).toBeLessThanOrEqual(2000);
  });

  it("never drops the page outline, however tight the cap", () => {
    const pageCount = useEditorStore.getState().document.pages.length;
    const parsed = JSON.parse(serializeEditorContext(buildEditorContext(), 400));
    // The agent cannot act at all without page ids — the outline is the floor.
    expect(parsed.pages.length).toBe(pageCount);
  });
});
