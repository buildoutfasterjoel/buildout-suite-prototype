import type { CSSProperties } from "react";
import type { Block, Page, Rect } from "./types";
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
export const FIXED_HEIGHT: Block["type"][] = [
  "image",
  "map",
  "divider",
  "spacer",
  "section",
  "columns",
];

/**
 * Types whose height is their content's, not their frame's. A table's height is
 * its rows' — a frame can only hold it taller than that, which is dead space
 * nobody asked for: a dropped table stood in a 200px box (DEFAULT_SIZE) with
 * the bottom half empty.
 *
 * Their stored `h` still exists, but only as what the gesture measured last
 * (see `useFrameDrag`), so clamping keeps working.
 */
export const AUTO_HEIGHT: Block["type"][] = ["table"];

export function frameHeightStyle(type: Block["type"], h: number): CSSProperties {
  if (AUTO_HEIGHT.includes(type)) return {};
  return FIXED_HEIGHT.includes(type) ? { height: h } : { minHeight: h };
}

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

/**
 * `measureFrames`, but for callers that only have a page id, not a ref to its
 * `.bo-editor-page` element — the Layers panel, which is scoped to a page but
 * doesn't render it. Finds the element the same way `Canvas.tsx` locates pages
 * generally, by `[data-page-id]`.
 *
 * Returns null when the element isn't in the DOM (page not currently mounted).
 * A null here must stop the conversion rather than fall through to an empty
 * `measured` map — `flattenForFree` treats missing measurements as "center this
 * block by default," so an empty map would silently redesign every block on the
 * page instead of leaving it alone.
 */
export function measurePageElement(pageId: string, zoom: number): Record<string, Rect> | null {
  const el = document.querySelector<HTMLElement>(`[data-page-id="${pageId}"] .bo-editor-page`);
  return el ? measureFrames(el, zoom) : null;
}
