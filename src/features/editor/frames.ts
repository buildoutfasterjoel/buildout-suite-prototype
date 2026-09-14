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
