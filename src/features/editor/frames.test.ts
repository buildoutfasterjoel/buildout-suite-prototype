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
