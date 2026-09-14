# Free-form Block Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a block be dragged anywhere on a page and resized, so the document editor matches production and the Layout palette section can be deleted.

**Architecture:** Geometry lives in one `Page.frames` map keyed by block id. Its presence marks a page as a free canvas: blocks render absolutely positioned and `page.blocks` order becomes paint order. Pages without `frames` keep today's flex-column render untouched, so all 12 locked templates are unaffected until the user presses a new Unfreeze layout button, which measures the rendered page and writes those numbers back.

**Tech Stack:** React 19, TypeScript, Zustand, dnd-kit (kept for palette/panel drags only), Vitest, Blueprint React, FontAwesome Pro.

**Spec:** `docs/superpowers/specs/2026-09-14-free-form-blocks-design.md`

## Global Constraints

- Package manager is Bun. Tests: `bun --bun run test`. Type check: `bunx tsc --noEmit` — `vite build` does **not** type-check.
- Page size is fixed: `PAGE_WIDTH = 816`, `PAGE_HEIGHT = 1056`, `PAGE_PADDING = 40`, all exported from `src/features/editor/types.ts`.
- Free pixels: no grid, no snapping, no alignment guides.
- Overlap is allowed. Array order is paint order — first in `page.blocks` is at the back.
- Minimum block size is 24 × 16.
- Coordinates are page space: origin at the top-left of the sheet, before `PAGE_PADDING`.
- Blueprint React components and FontAwesome `pro-regular` icons only. No `fixedWidth` prop on `FontAwesomeIcon`.
- Documents are rebuilt from code on load. No migration, and `SEED_VERSION` must not move.
- Every commit message body explains *why*, per the repo's convention (rationale lives in commits, not a decisions file).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/features/editor/types.ts` | `Rect` type, `Page.frames` field |
| `src/features/editor/frames.ts` *(new)* | All geometry: clamp, move, resize, default sizes, height rule, flatten, DOM measurement |
| `src/features/editor/frames.test.ts` *(new)* | Tests for the move/resize/clamp math |
| `src/features/editor/flatten.test.ts` *(new)* | Tests for `flattenForFree` |
| `src/features/editor/store.frames.test.ts` *(new)* | Tests for the store's frame actions |
| `src/features/editor/store.ts` | `setFrame`, `freePage`, `setBlockDepth`, frame assignment on insert, frame pruning on remove |
| `src/features/editor/blocks/FreeBlock.tsx` *(new)* | Absolute wrapper, drag/resize handles, per-block chrome |
| `src/features/editor/blocks/PageView.tsx` | Free-layer branch, Unfreeze layout button |
| `src/features/editor/dnd/EditorDndProvider.tsx` | Palette drops onto a free page |
| `src/features/editor/panels/NavPanels.tsx` | Palette sections, Layers panel note |
| `src/features/editor/presets.ts` | The seeded free-form page |
| `src/features/editor/editor.scss` | Free layer, frame outline, resize handles |

---

### Task 1: Geometry model and pure math

**Files:**
- Modify: `src/features/editor/types.ts`
- Create: `src/features/editor/frames.ts`
- Test: `src/features/editor/frames.test.ts`

**Interfaces:**
- Consumes: `PAGE_WIDTH`, `PAGE_HEIGHT`, `Block` from `./types`
- Produces: `Rect`, `Page.frames`, `MIN_W`, `MIN_H`, `ResizeDir`, `clampRect(rect)`, `moveRect(rect, dx, dy)`, `resizeRect(rect, dir, dx, dy)`, `DEFAULT_SIZE`, `frameAt(type, x, y)`, `frameHeightStyle(type, h)`

- [ ] **Step 1: Write the failing test**

Create `src/features/editor/frames.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./types";
import {
  MIN_H,
  MIN_W,
  clampRect,
  frameAt,
  frameHeightStyle,
  moveRect,
  resizeRect,
} from "./frames";

const rect = { x: 100, y: 100, w: 200, h: 100 };

describe("moveRect", () => {
  it("adds the delta", () => {
    expect(moveRect(rect, 40, -25)).toEqual({ x: 140, y: 75, w: 200, h: 100 });
  });

  it("keeps the block on the sheet", () => {
    expect(moveRect(rect, -500, -500)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
    const far = moveRect(rect, 9000, 9000);
    expect(far.x).toBe(PAGE_WIDTH - 200);
    expect(far.y).toBe(PAGE_HEIGHT - 100);
  });
});

describe("resizeRect", () => {
  it("grows from the south-east corner without moving the origin", () => {
    expect(resizeRect(rect, "se", 50, 30)).toEqual({ x: 100, y: 100, w: 250, h: 130 });
  });

  it("moves the origin when pulled from the north-west corner", () => {
    expect(resizeRect(rect, "nw", -20, -10)).toEqual({ x: 80, y: 90, w: 220, h: 110 });
  });

  it("changes one axis only for an edge handle", () => {
    expect(resizeRect(rect, "e", 40, 999)).toEqual({ x: 100, y: 100, w: 240, h: 100 });
    expect(resizeRect(rect, "s", 999, 40)).toEqual({ x: 100, y: 100, w: 200, h: 140 });
  });

  it("stops at the minimum size instead of inverting", () => {
    const squashed = resizeRect(rect, "se", -1000, -1000);
    expect(squashed.w).toBe(MIN_W);
    expect(squashed.h).toBe(MIN_H);
  });

  it("stops the far edge sliding past the minimum on a west pull", () => {
    // Pulling the west edge 1000px right would invert the box; the east edge
    // must stay put, so x lands MIN_W short of it.
    const squashed = resizeRect(rect, "w", 1000, 0);
    expect(squashed.w).toBe(MIN_W);
    expect(squashed.x).toBe(300 - MIN_W);
  });
});

describe("clampRect", () => {
  it("never returns a block wider or taller than the sheet", () => {
    const huge = clampRect({ x: -50, y: -50, w: 9999, h: 9999 });
    expect(huge).toEqual({ x: 0, y: 0, w: PAGE_WIDTH, h: PAGE_HEIGHT });
  });
});

describe("frameAt", () => {
  it("centers a new block on the drop point", () => {
    const frame = frameAt("text", 400, 300);
    expect(frame.x + frame.w / 2).toBe(400);
    expect(frame.y + frame.h / 2).toBe(300);
  });

  it("pulls a block dropped at the page edge back onto the sheet", () => {
    expect(frameAt("image", 0, 0)).toMatchObject({ x: 0, y: 0 });
  });
});

describe("frameHeightStyle", () => {
  it("gives images a hard height so resizing crops", () => {
    expect(frameHeightStyle("image", 220)).toEqual({ height: 220 });
  });

  it("gives text a floor so long bound values grow the box", () => {
    expect(frameHeightStyle("text", 96)).toEqual({ minHeight: 96 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test frames.test.ts`
Expected: FAIL — `Failed to resolve import "./frames"`.

- [ ] **Step 3: Add `Rect` and `Page.frames` to the model**

In `src/features/editor/types.ts`, add after the `Selection` interface:

```ts
/**
 * A block's box on a free page, in page space — origin at the top-left of the
 * sheet, before `PAGE_PADDING`, so a block can sit over the logo header or the
 * footer.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
```

In the `Page` interface, add after `bleed`:

```ts
  /**
   * Geometry for a free-canvas page, keyed by block id. Its presence is what
   * makes the page free: blocks are absolutely positioned and `blocks` order
   * becomes paint order (first = back, last = front) rather than reading order.
   * Absent = the stacked layout every template page still uses.
   *
   * Kept as one map on the page rather than a `rect` on each of the eleven
   * block interfaces, so blocks stay portable between the two layouts and
   * `blockFactory` never has to know where a block will land.
   */
  frames?: Record<string, Rect>;
```

- [ ] **Step 4: Write the geometry module**

Create `src/features/editor/frames.ts`:

```ts
import type { CSSProperties } from "react";
import type { Block, Rect } from "./types";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./types";

/** Smallest a block can be resized to, so one can't be lost to a stray drag. */
export const MIN_W = 24;
export const MIN_H = 16;

/** The eight directions a resize handle can pull. */
export type ResizeDir = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

/** Hold a rect to a sane size and keep it on the sheet. */
export function clampRect(rect: Rect): Rect {
  const w = Math.min(Math.max(rect.w, MIN_W), PAGE_WIDTH);
  const h = Math.min(Math.max(rect.h, MIN_H), PAGE_HEIGHT);
  return {
    w,
    h,
    x: Math.min(Math.max(rect.x, 0), PAGE_WIDTH - w),
    y: Math.min(Math.max(rect.y, 0), PAGE_HEIGHT - h),
  };
}

export function moveRect(rect: Rect, dx: number, dy: number): Rect {
  return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy });
}

/**
 * Resize from one handle. North and west handles move the origin as well as the
 * size, and when either hits the minimum the opposite edge has to stay put —
 * otherwise a hard pull drags the whole block along instead of stopping.
 */
export function resizeRect(rect: Rect, dir: ResizeDir, dx: number, dy: number): Rect {
  let { x, y, w, h } = rect;
  if (dir.includes("e")) w += dx;
  if (dir.includes("s")) h += dy;
  if (dir.includes("w")) {
    w -= dx;
    x += dx;
  }
  if (dir.includes("n")) {
    h -= dy;
    y += dy;
  }
  if (w < MIN_W && dir.includes("w")) x -= MIN_W - w;
  if (h < MIN_H && dir.includes("n")) y -= MIN_H - h;
  return clampRect({ x, y, w, h });
}

/** Size a newly placed block starts at, per type. */
export const DEFAULT_SIZE: Record<Block["type"], { w: number; h: number }> = {
  heading: { w: 480, h: 44 },
  text: { w: 400, h: 96 },
  list: { w: 360, h: 120 },
  table: { w: 600, h: 200 },
  image: { w: 320, h: 220 },
  map: { w: 400, h: 280 },
  contents: { w: 480, h: 240 },
  section: { w: 480, h: 200 },
  columns: { w: 640, h: 200 },
  spacer: { w: 200, h: 40 },
  divider: { w: 480, h: 16 },
};

/** Frame for a block placed at a point, centered on it. */
export function frameAt(type: Block["type"], x: number, y: number): Rect {
  const { w, h } = DEFAULT_SIZE[type];
  return clampRect({ x: x - w / 2, y: y - h / 2, w, h });
}

/**
 * Types whose frame height is a hard box. Everything else treats it as a floor,
 * so a long `{{property.name}}` grows its block downward instead of being cut
 * off — the one thing a fixed-box layout must not do to bound content.
 */
const FIXED_HEIGHT: Block["type"][] = [
  "image",
  "map",
  "divider",
  "spacer",
  "section",
  "columns",
];

export function frameHeightStyle(type: Block["type"], h: number): CSSProperties {
  return FIXED_HEIGHT.includes(type) ? { height: h } : { minHeight: h };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun --bun run test frames.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Type check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/editor/types.ts src/features/editor/frames.ts src/features/editor/frames.test.ts
git commit -m "feat(editor): geometry for free-positioned blocks

A page is a flex column, so a block has no position of its own. Free
positioning needs one, and it lands in a single Page.frames map keyed by block
id rather than a rect field on each of the eleven block interfaces: blocks stay
portable between the two layouts, and blockFactory never has to know where a
block will end up.

The math is pure and lives apart from any component, because the parts worth
testing are exactly the parts a renderer makes hard to reach — the minimum-size
floor that stops a west pull inverting a box, and the clamp that keeps a block
from being dragged off the sheet and lost."
```

---

### Task 2: Flatten a stacked page into a free one

**Files:**
- Modify: `src/features/editor/frames.ts`
- Test: `src/features/editor/flatten.test.ts`

**Interfaces:**
- Consumes: `clampRect`, `frameAt` from Task 1; `Page`, `Block`, `Rect` from `./types`
- Produces: `flattenForFree(page, measured): { blocks: Block[]; frames: Record<string, Rect> }`, `measureFrames(pageEl, zoom): Record<string, Rect>`

- [ ] **Step 1: Write the failing test**

Create `src/features/editor/flatten.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test flatten.test.ts`
Expected: FAIL — `flattenForFree is not a function`.

- [ ] **Step 3: Implement flatten and measurement**

Append to `src/features/editor/frames.ts`:

```ts
/**
 * Turn a stacked page into a free one, given the rects its blocks currently
 * occupy on screen.
 *
 * Containers dissolve, which is what makes them unnecessary once blocks can be
 * positioned: a `columns` block disappears and its children become top-level
 * blocks where they already sat. A `section` survives as a plain background
 * rectangle — its children are promoted to sit *after* it, so they paint in
 * front of the band that used to contain them. That is what keeps the cover
 * page's navy title band intact.
 *
 * A block with no measurement keeps its content and gets a centered default
 * rather than being dropped — losing a block to free a page would be the worst
 * possible trade.
 */
export function flattenForFree(
  page: Page,
  measured: Record<string, Rect>,
): { blocks: Block[]; frames: Record<string, Rect> } {
  const blocks: Block[] = [];
  const frames: Record<string, Rect> = {};

  const push = (block: Block) => {
    blocks.push(block);
    frames[block.id] =
      clampRect(measured[block.id] ?? frameAt(block.type, PAGE_WIDTH / 2, PAGE_HEIGHT / 2));
  };

  for (const block of page.blocks) {
    if (block.type === "columns") {
      for (const column of block.columns) for (const child of column) push(child);
    } else if (block.type === "section") {
      push({ ...block, blocks: [] });
      for (const child of block.blocks) push(child);
    } else {
      push(block);
    }
  }

  return { blocks, frames };
}

/**
 * Read where every block on a page actually sits. The DOM half of unfreezing —
 * no logic worth testing, which is why it is separate from `flattenForFree`.
 *
 * Divides by zoom because `getBoundingClientRect` reports post-transform pixels
 * and the model stores page pixels.
 */
export function measureFrames(pageEl: HTMLElement, zoom: number): Record<string, Rect> {
  const page = pageEl.getBoundingClientRect();
  const out: Record<string, Rect> = {};
  for (const el of pageEl.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const id = el.dataset.blockId;
    if (!id) continue;
    const r = el.getBoundingClientRect();
    out[id] = {
      x: (r.left - page.left) / zoom,
      y: (r.top - page.top) / zoom,
      w: r.width / zoom,
      h: r.height / zoom,
    };
  }
  return out;
}
```

Add `Page` to the type import at the top of the file:

```ts
import type { Block, Page, Rect } from "./types";
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun --bun run test flatten.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/frames.ts src/features/editor/flatten.test.ts
git commit -m "feat(editor): flatten a stacked page into positioned blocks

Unfreezing a template must not redesign it. Measuring what is already on screen
and writing those numbers back means the page is pixel-identical the moment
after — nothing is invented, so no template needs a hand-authored layout.

Containers dissolve here, which is the whole argument for dropping the Layout
palette: a columns block is only a way to put two blocks side by side, and two
positioned blocks do that without it. A section is not purely structural — it
carries a background — so it survives as a rectangle and its children are
promoted in front of it, which is what keeps the cover page's navy title band."
```

---

### Task 3: Store actions for frames

**Files:**
- Modify: `src/features/editor/store.ts`
- Test: `src/features/editor/store.frames.test.ts`

**Interfaces:**
- Consumes: `clampRect`, `frameAt`, `flattenForFree`, `DEFAULT_SIZE` from Tasks 1–2
- Produces: store actions `setFrame(pageId, blockId, rect)`, `freePage(pageId, measured)`, `setBlockDepth(blockId, depth)`; `addBlock` gains an optional 4th parameter `rect?: Rect`

- [ ] **Step 1: Write the failing test**

Create `src/features/editor/store.frames.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./store";
import { buildBlankPage } from "./templates";
import { createBlock } from "./blocks/blockFactory";
import { PAGE_WIDTH } from "./types";
import type { Property } from "#/data/types";

const property = { id: "p1", name: "Test Asset" } as unknown as Property;

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun --bun run test store.frames.test.ts`
Expected: FAIL — `setFrame is not a function`.

- [ ] **Step 3: Make blank pages free**

In `src/features/editor/templates/blankPages.ts`, add `frames: {}` to the returned page and extend the doc comment:

```ts
  return {
    id: uid("page"),
    name: "New Page",
    logoSrc: BRAND.logoSrc,
    locked: false,
    blocks: [],
    // A page built from nothing is a free canvas: blocks are placed, not
    // stacked. Template pages stay stacked until the user unfreezes them.
    frames: {},
  };
```

- [ ] **Step 4: Add the store actions**

In `src/features/editor/store.ts`, extend the imports:

```ts
import { DEFAULT_SIZE, clampRect, flattenForFree, frameAt } from "./frames";
import type { Rect } from "./types";
```

Change the `addBlock` signature in the `EditorState` interface and add the three new actions after `removeBlock`:

```ts
  addBlock: (
    target: DropTarget,
    type: Block["type"],
    variant?: BlockVariant,
    /** Where it landed on a free page. Omitted = placed below what's there. */
    rect?: Rect,
  ) => void;

  /** Set one block's box on a free page. No-op on a stacked page. */
  setFrame: (pageId: string, blockId: string, rect: Rect) => void;
  /**
   * Convert a stacked page into a free canvas from rects measured off the
   * rendered page. No-op if it is already free.
   */
  freePage: (pageId: string, measured: Record<string, Rect>) => void;
  /** Move a block to the front or back of its page's paint order. */
  setBlockDepth: (blockId: string, depth: "front" | "back") => void;
```

Add these module-level helpers next to `pageIdForTarget`:

```ts
/**
 * Give a block a frame when it lands on a free page. Without a drop point it
 * stacks below whatever is already there, so an agent adding three blocks in a
 * row does not pile them on the same spot.
 */
function assignFrame(
  doc: EditorDocument,
  pageId: string,
  block: Block,
  rect?: Rect,
): EditorDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId || !page.frames) return page;
      const bottom = Object.values(page.frames).reduce(
        (max, f) => Math.max(max, f.y + f.h + 16),
        PAGE_PADDING,
      );
      const size = DEFAULT_SIZE[block.type];
      const placed = rect ?? { x: PAGE_PADDING, y: bottom, w: size.w, h: size.h };
      return { ...page, frames: { ...page.frames, [block.id]: clampRect(placed) } };
    }),
  };
}

/** Drop a removed block's frame, so a free page keeps no orphan geometry. */
function pruneFrame(doc: EditorDocument, blockId: string): EditorDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (!page.frames || !(blockId in page.frames)) return page;
      const { [blockId]: _dropped, ...frames } = page.frames;
      return { ...page, frames };
    }),
  };
}
```

Import `PAGE_PADDING` from `./types` alongside the existing type imports:

```ts
import { PAGE_PADDING } from "./types";
```

Rewrite `addBlock` and `insertBlock` to assign a frame, and `removeBlock` to prune one:

```ts
  addBlock: (target, type, variant, rect) =>
    set((s) => {
      // Containers may only be dropped at the top level (one-level nesting).
      if ((type === "columns" || type === "section") && target.kind !== "page") {
        return s;
      }
      const block = createBlock(type, variant);
      const inserted = insertAt(s.document, target, block);
      const pageId = pageIdForTarget(inserted, target);
      return {
        document: assignFrame(inserted, pageId, block, rect),
        selection: { pageId, blockId: block.id },
        activeNavPanel: null,
        dirty: true,
      };
    }),

  insertBlock: (target, block) =>
    set((s) => {
      if (isContainer(block) && target.kind !== "page") return s;
      const inserted = insertAt(s.document, target, block);
      const pageId = pageIdForTarget(inserted, target);
      return {
        document: assignFrame(inserted, pageId, block),
        selection: { pageId, blockId: block.id },
        dirty: true,
      };
    }),

  removeBlock: (blockId) =>
    set((s) => {
      const { doc, removed } = removeBlockFromDoc(s.document, blockId);
      if (!removed) return s;
      const clears = s.selection?.blockId === blockId;
      return {
        document: pruneFrame(doc, blockId),
        selection: clears ? null : s.selection,
        dirty: true,
      };
    }),
```

Add the three new actions after `removeBlock`:

```ts
  setFrame: (pageId, blockId, rect) =>
    set((s) => ({
      document: {
        ...s.document,
        pages: s.document.pages.map((p) =>
          p.id === pageId && p.frames
            ? { ...p, frames: { ...p.frames, [blockId]: clampRect(rect) } }
            : p,
        ),
      },
      dirty: true,
    })),

  freePage: (pageId, measured) =>
    set((s) => {
      const page = s.document.pages.find((p) => p.id === pageId);
      if (!page || page.frames) return s;
      const { blocks, frames } = flattenForFree(page, measured);
      return {
        document: {
          ...s.document,
          pages: s.document.pages.map((p) =>
            p.id === pageId ? { ...p, blocks, frames, locked: false } : p,
          ),
        },
        dirty: true,
      };
    }),

  setBlockDepth: (blockId, depth) =>
    set((s) => ({
      document: {
        ...s.document,
        pages: s.document.pages.map((page) => {
          const index = page.blocks.findIndex((b) => b.id === blockId);
          if (index === -1) return page;
          const blocks = [...page.blocks];
          const [block] = blocks.splice(index, 1);
          if (depth === "front") blocks.push(block);
          else blocks.unshift(block);
          return { ...page, blocks };
        }),
      },
      dirty: true,
    })),
```

- [ ] **Step 5: Run the full test suite**

Run: `bun --bun run test`
Expected: PASS, including the existing `store.inserts.test.ts` and `selection.test.ts`.

- [ ] **Step 6: Type check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/editor/store.ts src/features/editor/store.frames.test.ts src/features/editor/templates/blankPages.ts
git commit -m "feat(editor): store actions for free-page geometry

Frames are assigned inside addBlock and insertBlock rather than by each caller,
so Otto's tools get free-page placement without a single change to their
schemas — a block it adds stacks below what is already there instead of piling
on one spot.

removeBlock prunes the frame with the block. An orphan rect renders nothing, but
it would outlive its block in a saved document and quietly grow every page it
touched.

setBlockDepth is the affordance overlap actually needs. It reorders page.blocks,
which is already the paint order, so bring-to-front costs no new state."
```

---

### Task 4: Render free pages, and seed one

**Files:**
- Create: `src/features/editor/blocks/FreeBlock.tsx`
- Modify: `src/features/editor/blocks/PageView.tsx`, `src/features/editor/presets.ts`, `src/features/editor/editor.scss`

**Interfaces:**
- Consumes: `frameHeightStyle`, `frameAt` from Task 1; `Page.frames` from Task 1
- Produces: `<FreeBlock block pageId frame selection />`

- [ ] **Step 1: Write the free block wrapper**

Create `src/features/editor/blocks/FreeBlock.tsx`:

```tsx
import { useEditorStore } from "../store";
import { frameHeightStyle } from "../frames";
import type { Block, Rect, Selection } from "../types";
import { BlockVisual } from "./BlockViews";

/**
 * One block on a free page: an absolutely positioned box around the same visual
 * a stacked page renders. Selection, editing and every style control keep
 * working, because only the wrapper changed.
 */
export function FreeBlock({
  block,
  pageId,
  frame,
  selection,
}: {
  block: Block;
  pageId: string;
  frame: Rect;
  selection: Selection | null;
}) {
  const select = useEditorStore((s) => s.select);
  const located = useEditorStore(
    (s) => s.highlightedBlockId === block.id && s.selection?.blockId !== block.id,
  );
  const selected = selection?.blockId === block.id && !selection?.cellId;

  return (
    <div
      className={`bo-editor-frame${selected ? " is-selected" : ""}${located ? " is-located" : ""}`}
      data-block-id={block.id}
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.w,
        ...frameHeightStyle(block.type, frame.h),
      }}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageId, blockId: block.id });
      }}
    >
      <BlockVisual
        block={block}
        pageId={pageId}
        selection={selection}
        locked={false}
        index={0}
      />
    </div>
  );
}
```

- [ ] **Step 2: Export `BlockVisual`**

In `src/features/editor/blocks/BlockViews.tsx`, find `function BlockVisual({` (near line 378) and export it:

```tsx
export function BlockVisual({
```

- [ ] **Step 3: Branch `PageView` on `page.frames`**

In `src/features/editor/blocks/PageView.tsx`, import the new pieces:

```tsx
import { useRef } from "react";
import { FreeBlock } from "./FreeBlock";
import { frameAt } from "../frames";
```

Replace the content `<div className="d-flex flex-column">…</div>` with a branch. Add a ref to the page element for Task 7's measurement while you are here:

```tsx
  const pageRef = useRef<HTMLDivElement>(null);
```

```tsx
      <div
        ref={pageRef}
        className={`bo-editor-page${pageSelected ? " is-page-selected" : ""}`}
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT }}
        onClick={() => select({ pageId: page.id })}
      >
        {chrome && page.logoSrc && (
          <div className="p-6" style={{ flexShrink: 0 }}>
            <img src={page.logoSrc} alt="Document logo" style={{ height: 55 }} />
          </div>
        )}

        {page.frames ? (
          // A free page owns the whole sheet: blocks sit in page coordinates,
          // over the chrome if that is where they were put.
          <div className="bo-editor-free-layer">
            {page.blocks.map((block) => (
              <FreeBlock
                key={block.id}
                block={block}
                pageId={page.id}
                frame={page.frames![block.id] ?? frameAt(block.type, PAGE_WIDTH / 2, 120)}
                selection={pageSelection}
              />
            ))}
          </div>
        ) : (
          <div
            className="d-flex flex-column"
            style={{
              gap: bleed ? 0 : 32,
              padding: bleed ? 0 : PAGE_PADDING,
              flex: "1 0 0",
              minHeight: 0,
            }}
          >
            <BlockList
              blocks={page.blocks}
              pageId={page.id}
              list={{ kind: "page", pageId: page.id }}
              selection={pageSelection}
              locked={page.locked ?? false}
            />
          </div>
        )}

        {chrome && <PageFooter pageNumber={pageNumber} />}
      </div>
```

- [ ] **Step 4: Style the free layer**

In `src/features/editor/editor.scss`, add `position: relative;` to `.bo-editor-page` (it currently has none, and the free layer is absolutely positioned inside it), then append after the `.bo-editor-page-footer` rule:

```scss
/* A free page's blocks are placed in page coordinates over the whole sheet,
   including the logo header and footer, so the layer covers the page rather
   than sitting in the flex flow. */
.bo-editor-free-layer {
  position: absolute;
  inset: 0;
}

.bo-editor-frame {
  outline: 1px solid transparent;
  outline-offset: 2px;
  transition: outline-color motion.$short2 ease;
}
.bo-editor-frame:hover {
  outline-color: tokens.$buildout-blue-300;
}
.bo-editor-frame.is-selected,
.bo-editor-frame.is-located {
  outline: 2px solid tokens.$buildout-purple-500;
}
```

Check the exact token names against the existing `.bo-editor-sortable` and `.bo-editor-block.is-selected` rules in the same file and reuse whatever they use — do not invent a token.

- [ ] **Step 5: Seed a free page in the sample document**

In `src/features/editor/presets.ts`, add this builder above `buildDocumentPages`:

```ts
/**
 * The one free-form page in the sample document. Every other page is a locked
 * template, so without this the editor opens with nothing to drag and the
 * feature is invisible.
 *
 * Deliberately an overlapping layout — a title band sitting over the hero photo
 * — because that is the thing the stacked layout could not express at all.
 */
function buildFreeFormPage(property: Property | undefined): Page {
  const photo = heroImage("editor-free-form");
  const band: Block = {
    id: uid("block"),
    type: "section",
    padding: 24,
    background: "rgba(18, 38, 63, 0.85)",
    blocks: [],
  };
  const title: Block = {
    id: uid("block"),
    type: "heading",
    text: "Investment Highlights",
    style: { ...headingStyle, color: "#ffffff" },
  };
  const address: Block = {
    id: uid("block"),
    type: "text",
    text: addressOf(property),
    style: { ...addressStyle, color: "#ffffff" },
  };

  return {
    id: uid("page"),
    name: "Investment Highlights",
    logoSrc: LOGO_SRC,
    locked: false,
    blocks: [photo, band, title, address],
    frames: {
      [photo.id]: { x: 0, y: 0, w: 816, h: 520 },
      [band.id]: { x: 48, y: 360, w: 520, h: 132 },
      [title.id]: { x: 72, y: 384, w: 472, h: 48 },
      [address.id]: { x: 72, y: 436, w: 472, h: 32 },
    },
  };
}
```

Insert it into the page list in `buildDocumentPages`, right after `buildPropertyDescriptionPage(property)`:

```ts
    buildFreeFormPage(property),
```

Remove the now-wrong "Complete Highlights" stub page that followed it, since this page takes its place in the document's section list. Update `buildDocumentPages`' doc comment from "a 14-page CRE offering memorandum" to match the new count.

- [ ] **Step 6: Verify in the browser**

Start the dev server (`bun --bun run dev`), open the editor, and scroll to the **Investment Highlights** page.

Expected: the hero photo fills the top of the page, with a translucent navy band and white title overlapping it. No console errors.

Per CLAUDE.md's Playwright rules: never `waitUntil: "networkidle"`, scope selectors to `main.app-shell__main`, wait for text unique to the destination, and `browser_close` when finished.

- [ ] **Step 7: Run tests and type check**

Run: `bun --bun run test && bunx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/features/editor/blocks/FreeBlock.tsx src/features/editor/blocks/PageView.tsx src/features/editor/blocks/BlockViews.tsx src/features/editor/presets.ts src/features/editor/editor.scss
git commit -m "feat(editor): render free pages as placed blocks

PageView branches on page.frames rather than replacing its renderer, so all
twelve templates keep the flex-column path they render correctly today. The
free branch reuses BlockVisual untouched — only the wrapper differs, which is
why selection, inline editing and every style control keep working with no
second implementation to maintain.

The layer covers the whole sheet, chrome included, because a block placed over
the logo header is a thing production allows and a content-column-only canvas
would quietly forbid.

One seeded page ships free, overlapping a title band with the hero photo. Every
other page is a locked template, so without it the editor opens with nothing to
drag."
```

---

### Task 5: Move and resize

**Files:**
- Modify: `src/features/editor/blocks/FreeBlock.tsx`, `src/features/editor/editor.scss`

**Interfaces:**
- Consumes: `moveRect`, `resizeRect`, `ResizeDir` from Task 1; `setFrame` from Task 3
- Produces: `<FreeBlock>` with a move handle and 8 resize handles

- [ ] **Step 1: Add the drag hook to `FreeBlock.tsx`**

```tsx
import { useState } from "react";
import { moveRect, resizeRect, type ResizeDir } from "../frames";

/**
 * Pointer-driven move and resize.
 *
 * The gesture is held in local state and committed once on pointer-up, so a
 * drag is one store write rather than one per frame — the whole document
 * re-renders on every write, and a live commit made dragging visibly stutter.
 *
 * Deltas divide by zoom because the pointer moves in screen pixels and the
 * model stores page pixels.
 */
function useFrameDrag(pageId: string, blockId: string, frame: Rect) {
  const zoom = useEditorStore((s) => s.zoom);
  const setFrame = useEditorStore((s) => s.setFrame);
  const [draft, setDraft] = useState<Rect | null>(null);

  const start = (e: React.PointerEvent, dir: ResizeDir | "move") => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const base = frame;
    let next = base;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      next = dir === "move" ? moveRect(base, dx, dy) : resizeRect(base, dir, dx, dy);
      setDraft(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDraft(null);
      setFrame(pageId, blockId, next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return { rect: draft ?? frame, start };
}

const RESIZE_DIRS: ResizeDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

/**
 * Types whose body can be grabbed directly. Text-bearing blocks are excluded:
 * they are contentEditable, so a body drag would steal the pointer from
 * selecting text inside them. Those keep the drag handle the stacked layout
 * already uses.
 */
const BODY_DRAGGABLE: Block["type"][] = [
  "image",
  "map",
  "divider",
  "spacer",
  "section",
  "contents",
];
```

- [ ] **Step 2: Wire the handles into the wrapper**

Replace the body of `FreeBlock`'s returned JSX so it uses `rect` from the hook, adds a move handle, and renders the 8 resize handles when selected:

```tsx
  const { rect, start } = useFrameDrag(pageId, block.id, frame);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const setBlockDepth = useEditorStore((s) => s.setBlockDepth);
  const bodyDraggable = BODY_DRAGGABLE.includes(block.type);

  return (
    <div
      className={`bo-editor-frame${selected ? " is-selected" : ""}${located ? " is-located" : ""}`}
      data-block-id={block.id}
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        ...frameHeightStyle(block.type, rect.h),
      }}
      onPointerDown={bodyDraggable ? (e) => start(e, "move") : undefined}
      onClick={(e) => {
        e.stopPropagation();
        select({ pageId, blockId: block.id });
      }}
    >
      {!bodyDraggable && (
        <button
          type="button"
          className="bo-editor-drag-handle"
          aria-label="Drag to move"
          onPointerDown={(e) => start(e, "move")}
        >
          <FontAwesomeIcon icon={faGripDotsVertical} />
        </button>
      )}

      {selected && (
        <>
          <div className="bo-editor-frame-actions">
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    aria-label="Bring to front"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockDepth(block.id, "front");
                    }}
                  >
                    <FontAwesomeIcon icon={faBringForward} />
                  </button>
                }
              />
              <Tooltip.Content>Bring to front</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    aria-label="Send to back"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockDepth(block.id, "back");
                    }}
                  >
                    <FontAwesomeIcon icon={faSendBackward} />
                  </button>
                }
              />
              <Tooltip.Content>Send to back</Tooltip.Content>
            </Tooltip>
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <button
                    type="button"
                    aria-label={`Delete ${block.type}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlock(block.id);
                    }}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </button>
                }
              />
              <Tooltip.Content>Delete {block.type}</Tooltip.Content>
            </Tooltip>
          </div>

          {RESIZE_DIRS.map((dir) => (
            <span
              key={dir}
              className={`bo-editor-handle is-${dir}`}
              onPointerDown={(e) => start(e, dir)}
            />
          ))}
        </>
      )}

      <BlockVisual
        block={block}
        pageId={pageId}
        selection={selection}
        locked={false}
        index={0}
      />
    </div>
  );
```

Add the imports this needs:

```tsx
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGripDotsVertical,
  faTrashCan,
  faBringForward,
  faSendBackward,
} from "@fortawesome/pro-regular-svg-icons";
import { Tooltip } from "@buildoutinc/blueprint-react/ui/Tooltip";
```

If `faBringForward` / `faSendBackward` do not exist in the installed FontAwesome Pro version, use `faLayerPlus` and `faLayerMinus`; confirm by grepping `node_modules/@fortawesome/pro-regular-svg-icons/index.d.ts` before settling on names.

- [ ] **Step 3: Style the handles**

Append to `src/features/editor/editor.scss`:

```scss
/* Resize handles, shown only on the selected block. Eight of them: four
   corners and four edge midpoints. */
.bo-editor-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: tokens.$white;
  border: 1px solid tokens.$buildout-purple-500;
  border-radius: 2px;
  z-index: 2;
}
.bo-editor-handle.is-nw { top: -5px; left: -5px; cursor: nwse-resize; }
.bo-editor-handle.is-n  { top: -5px; left: 50%; margin-left: -5px; cursor: ns-resize; }
.bo-editor-handle.is-ne { top: -5px; right: -5px; cursor: nesw-resize; }
.bo-editor-handle.is-e  { top: 50%; right: -5px; margin-top: -5px; cursor: ew-resize; }
.bo-editor-handle.is-se { bottom: -5px; right: -5px; cursor: nwse-resize; }
.bo-editor-handle.is-s  { bottom: -5px; left: 50%; margin-left: -5px; cursor: ns-resize; }
.bo-editor-handle.is-sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
.bo-editor-handle.is-w  { top: 50%; left: -5px; margin-top: -5px; cursor: ew-resize; }

/* Front/back/delete, floated above the selected block. */
.bo-editor-frame-actions {
  position: absolute;
  top: -32px;
  right: 0;
  display: flex;
  gap: 2px;
  z-index: 3;
}
.bo-editor-frame-actions button {
  border: 1px solid tokens.$root-border-color;
  background: tokens.$white;
  border-radius: 4px;
  width: 26px;
  height: 26px;
  color: tokens.$body-text-muted;
}
.bo-editor-frame-actions button:hover {
  color: tokens.$buildout-purple-500;
}

/* A body-draggable block shows the move cursor over its whole box. */
.bo-editor-frame:hover {
  cursor: default;
}
```

Reuse whatever token names the neighbouring rules already use; do not invent tokens. Remember Blueprint's variable prefix is `--bp-`, so `--bs-*` overrides do nothing.

- [ ] **Step 4: Verify in the browser**

On the seeded **Investment Highlights** page:
1. Drag the hero photo — it moves, and stops at the sheet edge.
2. Select the title and drag its south-east handle — it resizes, and the text reflows.
3. Drag the title by its grip handle, not its body — clicking into the text still places a cursor rather than starting a drag.
4. Select the photo, press **Bring to front** — it covers the band; **Send to back** returns it.

Expected: no console errors, no page errors.

- [ ] **Step 5: Run tests and type check**

Run: `bun --bun run test && bunx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/editor/blocks/FreeBlock.tsx src/features/editor/editor.scss
git commit -m "feat(editor): move and resize placed blocks

Pointer events rather than dnd-kit. Resize handles need raw pointer math either
way, and moving is the same math with a different direction — running the move
through a sortable context as well would mean two drag systems on one block.

The gesture is committed once on pointer-up. A write per pointermove re-renders
the whole document and made dragging stutter visibly.

Text-bearing blocks keep a grip handle instead of a draggable body: they are
contentEditable, and a body drag steals the pointer from selecting text inside
them. Images, maps and boxes have no such conflict, so those are grabbed
directly."
```

---

### Task 6: Palette drops onto a free page

**Files:**
- Modify: `src/features/editor/dnd/EditorDndProvider.tsx`

**Interfaces:**
- Consumes: `frameAt` from Task 1; `addBlock(target, type, variant, rect)` from Task 3
- Produces: palette drops that land where the pointer released

- [ ] **Step 1: Add the page hit-test**

In `src/features/editor/dnd/EditorDndProvider.tsx`, add above the component:

```tsx
/**
 * Where a drag ended, in page coordinates.
 *
 * dnd-kit reports the activator event and a delta, which together give the
 * release point without tracking pointermove ourselves. The page is found by
 * hit-testing the rendered pages rather than `elementFromPoint`, which returns
 * the drag overlay sitting under the cursor.
 */
function dropPoint(e: DragEndEvent): { pageId: string; x: number; y: number } | null {
  const activator = e.activatorEvent as PointerEvent;
  if (typeof activator?.clientX !== "number") return null;
  const cx = activator.clientX + e.delta.x;
  const cy = activator.clientY + e.delta.y;

  const zoom = useEditorStore.getState().zoom;
  for (const el of document.querySelectorAll<HTMLElement>("[data-page-id] .bo-editor-page")) {
    const r = el.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) continue;
    const pageId = el.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
    if (!pageId) continue;
    return { pageId, x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
  }
  return null;
}
```

- [ ] **Step 2: Handle the palette drop before the list logic**

In `onDragEnd`, after the page-reorder branch and before `if (!o.list) return;`, insert:

```tsx
    // A free page has no sibling lists to drop into — the pointer position is
    // the whole instruction, so it is resolved here rather than through a
    // DropTarget index.
    if (a.source === "palette" && a.blockType) {
      const point = dropPoint(e);
      const page = point
        ? useEditorStore.getState().document.pages.find((p) => p.id === point.pageId)
        : undefined;
      if (point && page?.frames) {
        addBlock(
          { kind: "page", pageId: page.id, index: page.blocks.length },
          a.blockType,
          a.variant,
          frameAt(a.blockType, point.x, point.y),
        );
        return;
      }
    }
```

Add the imports:

```tsx
import { frameAt } from "../frames";
```

`useEditorStore` is already imported.

- [ ] **Step 3: Verify in the browser**

1. Open the Blocks panel, drag **Text** onto the middle of the seeded free page.
   Expected: the block appears centered on the drop point, selected.
2. Drag **Image** onto a locked template page.
   Expected: nothing changes (locked pages reject it, as today).
3. Drag **Text** onto an unlocked stacked page.
   Expected: it still inserts into the stack, as today.

- [ ] **Step 4: Run tests and type check**

Run: `bun --bun run test && bunx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/dnd/EditorDndProvider.tsx
git commit -m "feat(editor): drop a palette block where the pointer released

A free page has no sibling list to splice into, so the drop resolves to a point
instead of an index. The release point comes from dnd-kit's activator event plus
its delta rather than a pointermove listener of our own, and the page is found
by hit-testing the rendered pages — elementFromPoint returns the drag overlay
sitting under the cursor, not the page beneath it.

Stacked pages are untouched: the branch only fires when the page under the
pointer has frames."
```

---

### Task 7: The Unfreeze layout button

**Files:**
- Modify: `src/features/editor/blocks/PageView.tsx`

**Interfaces:**
- Consumes: `measureFrames` from Task 2; `freePage` from Task 3; `pageRef` added in Task 4
- Produces: an Unfreeze layout button in the page toolbar

- [ ] **Step 1: Make the page toolbar able to unfreeze**

In `src/features/editor/blocks/PageView.tsx`, give `PageToolbar` the page element and wire a real button. Replace the `PageToolbarButton` row's `faArrowRotateLeft` **Reset** entry with the unfreeze action, keeping the other placeholder buttons:

```tsx
function PageToolbar({
  page,
  open,
  pageRef,
}: {
  page: Page;
  open: boolean;
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const workspaceRef = useWorkspaceRef();
  const zoom = useEditorStore((s) => s.zoom);
  const freePage = useEditorStore((s) => s.freePage);

  // Measuring is the whole conversion: the rects come off the page as it is
  // rendered right now, so the page cannot move when it is unfrozen.
  const unfreeze = () => {
    const el = pageRef.current;
    if (!el) return;
    freePage(page.id, measureFrames(el, zoom));
  };
```

Inside the popover's button row, before the placeholder buttons:

```tsx
          {!page.frames && (
            <Tooltip>
              <Tooltip.Trigger
                render={
                  <Button variant="ghost" size="sm" onClick={unfreeze}>
                    <FontAwesomeIcon icon={faLockOpen} />
                    Unfreeze layout
                  </Button>
                }
              />
              <Tooltip.Content side="top">
                Turn this page into a free canvas. Blocks keep their exact
                positions and become movable.
              </Tooltip.Content>
            </Tooltip>
          )}
```

Add the imports:

```tsx
import { faLockOpen } from "@fortawesome/pro-regular-svg-icons";
import { measureFrames } from "../frames";
```

Pass the ref down from `PageView`:

```tsx
      <PageToolbar page={page} open={pageSelected} pageRef={pageRef} />
```

- [ ] **Step 2: Verify in the browser — the hard case first**

1. Scroll to the **Cover Page** (a locked template built from a `section` with a navy background).
2. Click blank page space so the page toolbar appears, press **Unfreeze layout**.
3. Expected: the page looks identical. The navy band is still behind its text.
4. Drag the title — it moves independently of the band.
5. Repeat on a **columns**-based page (Table of Contents, or Sale Comparables).
   Expected: identical on unfreeze, and each column's blocks now move alone.

Take a screenshot before and after unfreezing and compare. Any visible shift is a bug in `measureFrames` or `flattenForFree`, not something to accept.

- [ ] **Step 3: Run tests and type check**

Run: `bun --bun run test && bunx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/editor/blocks/PageView.tsx
git commit -m "feat(editor): unfreeze a template page into a free canvas

Until now nothing in the UI could unlock a page — only Otto could, silently,
inside addBlock/moveBlock/removeBlock. That made free positioning reachable on
blank pages only, which is not parity.

The button measures the page as rendered and writes those numbers back, so the
page is pixel-identical the moment after. That is what makes it safe to offer on
a template a broker chose for its design: unfreezing adds the ability to move
things and changes nothing else.

Otto's silent unlock is deliberately left alone. Its tools run outside React and
cannot measure the DOM, so a page it unlocks stays stacked and every existing
tool keeps working on it."
```

---

### Task 8: Retire the Layout palette

**Files:**
- Modify: `src/features/editor/panels/NavPanels.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: a single-section Blocks palette

- [ ] **Step 1: Fold the palette into one list**

In `src/features/editor/panels/NavPanels.tsx`, delete the `LAYOUT_BLOCKS` array and append two entries to `CONTENT_BLOCKS`:

```ts
  {
    type: "divider",
    icon: BLOCK_ICONS.divider,
    label: "Divider",
    desc: "Horizontal rule",
  },
  {
    type: "section",
    icon: BLOCK_ICONS.section,
    label: "Box",
    desc: "Colored rectangle to sit behind content",
  },
```

- [ ] **Step 2: Drop the subsection headings from `BlocksPanel`**

```tsx
export function BlocksPanel() {
  return (
    <div className="d-flex flex-column gap-3">
      <PanelHeading>Blocks</PanelHeading>
      <span className="fs-small" style={{ color: "#506079" }}>
        Drag a block onto the page to place it.
      </span>

      <div className="d-flex flex-column gap-2">
        {CONTENT_BLOCKS.map((b) => (
          <PaletteItem key={paletteId(b)} entry={b} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tell the Layers panel what its order means**

In `LayersPanel`, below the existing locked note, add:

```tsx
      {page?.frames && (
        <span className="fs-small" style={{ color: "#506079" }}>
          Listed back to front — the last row is on top.
        </span>
      )}
```

- [ ] **Step 4: Verify in the browser**

Open the Blocks panel.
Expected: one list, no **Layout** heading, no **2 Columns** / **3 Columns** / **Spacer** entries, with **Divider** and **Box** present. Dragging **Box** onto the free page places a colored rectangle.

Open the Layers panel on the free page.
Expected: the back-to-front note appears; it does not on a template page.

- [ ] **Step 5: Run tests and type check**

Run: `bun --bun run test && bunx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/editor/panels/NavPanels.tsx
git commit -m "refactor(editor): retire the Layout palette section

Columns and Spacer existed to fake side-by-side and vertical gaps. Positioned
blocks do both directly, so offering them would hand a broker a container to
drop blocks into on a page that no longer has containers.

Both stay in the model — the twelve templates are built from them and still
render stacked. Section survives the cut as Box: it carries a background, so it
is a rectangle you put behind content rather than structure, and it is what the
cover page's navy band becomes when that page is unfrozen."
```

---

### Task 9: Full verification and cleanup

**Files:**
- Delete: `docs/superpowers/specs/2026-09-14-free-form-blocks-design.md`, `docs/superpowers/plans/2026-09-14-free-form-blocks.md`

- [ ] **Step 1: Run every gate**

```bash
bun --bun run test
bunx tsc --noEmit
bun --bun run build
```

Expected: tests pass, no type errors, build succeeds. A Vitest stderr line about react/module resolution is a known non-gate — ignore it. Biome findings are advisory here.

- [ ] **Step 2: Walk the whole editor in the browser**

Check nothing regressed on the stacked path, which is most of the app:

1. Every template page renders as before — cover, contents, photo gallery, location map, comparables.
2. A table's row and column handles still work on a locked page.
3. The Layers panel reorders blocks on an unlocked stacked page.
4. Otto: ask it to add a heading to a template page. It should report the page it unfroze, and the page should stay stacked.
5. The seeded free page: place, move, resize, restack, delete.
6. Unfreeze a template, move a block, confirm no console errors.

`browser_close` when finished — the browser does not exit on its own.

- [ ] **Step 3: Delete the spec and plan**

Per CLAUDE.md, a spec in `docs/superpowers/specs/` means the work is live. Once it ships, the spec and its plan are deleted in a `chore(docs):` commit that goes out with the branch. Anything worth keeping that is not already in a commit goes into the PR body first.

```bash
git rm docs/superpowers/specs/2026-09-14-free-form-blocks-design.md docs/superpowers/plans/2026-09-14-free-form-blocks.md
git commit -m "chore(docs): remove the free-form blocks spec and plan

The work shipped, so the working documents go with it. The reasoning lives in
the commit bodies on this branch and in the PR description, both of which are
bound to the diff they describe."
```

- [ ] **Step 4: Ship**

Run the `/ship` skill: it runs the gates, pushes the branch, and opens the PR. It never merges.

The PR body must carry:
- What free positioning replaces, and why containers dissolve rather than being ported.
- That `Page.frames`' presence is the free/stacked switch, and why geometry is one map instead of a field on eleven block interfaces.
- That Otto's silent unlock deliberately leaves a page stacked.
- What is out of scope: snapping, alignment guides, multi-select, rotation, group/ungroup, undo, free positioning in Otto's tool schema, converting the twelve templates to fixed boxes.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| 1. Model (`Rect`, `Page.frames`) | 1 |
| 2. Render (branch, height rules, map size control) | 4 — *the map `size` control hiding is not covered; see note below* |
| 3. Move and resize (hook, 8 handles, min size, clamp, zoom) | 1, 5 |
| 3. Palette drop point | 6 |
| 4. Unfreeze (measure, flatten, write) | 2, 7 |
| 5. Palette and z-order | 3 (`setBlockDepth`), 5 (buttons), 8 (palette) |
| 6. Seeded demo | 4 |
| Tests | 1, 2, 3 |

**Gap found and closed:** the spec hides the `map` block's `size` preset control on a free page, and no task did it. Added to Task 4 as a final step below.

- [ ] **Task 4, Step 9: Hide the map size control on free pages**

In `src/features/editor/panels/StyleControls.tsx`, find the map size preset control (search for `MapSize` or `"full"`). Wrap it so it renders only when the selected block's page has no `frames`:

```tsx
  const pageIsFree = useEditorStore(
    (s) => s.document.pages.find((p) => p.id === s.selection?.pageId)?.frames !== undefined,
  );
```

```tsx
  {!pageIsFree && (
    /* …existing size preset control… */
  )}
```

On a free page the frame owns the height, so two controls would fight over it. The stored `size` is left untouched, so the block still renders correctly if it ends up on a stacked page.

Commit this with Task 4.

**Placeholder scan:** none — every code step carries its content. Two steps deliberately say "check the existing rule and reuse its token" (Task 4 Step 4, Task 5 Step 3) because inventing a Sass token would fail the build; the file to check is named in both.

**Type consistency:** `Rect`, `ResizeDir`, `clampRect`, `moveRect`, `resizeRect`, `frameAt`, `frameHeightStyle`, `DEFAULT_SIZE`, `flattenForFree`, `measureFrames`, `setFrame`, `freePage`, `setBlockDepth`, `assignFrame`, `pruneFrame` are spelled identically in every task that names them. `Page.frames` is `Record<string, Rect> | undefined` throughout.
