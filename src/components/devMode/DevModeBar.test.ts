import { describe, expect, it } from "vitest";
import { clampToViewport } from "./DevModeBar";

const bar = { width: 120, height: 40 };
const viewport = { width: 1440, height: 900 };

describe("clampToViewport", () => {
  it("leaves a position that already fits alone", () => {
    expect(clampToViewport({ left: 300, top: 200 }, bar, viewport)).toEqual({
      left: 300,
      top: 200,
    });
  });

  it("stops at the inset when dragged past the top-left", () => {
    expect(clampToViewport({ left: -50, top: -50 }, bar, viewport)).toEqual({
      left: 8,
      top: 8,
    });
  });

  // The far edge accounts for the bar's own size, so the whole bar stays
  // visible — not just its top-left corner.
  it("keeps the whole bar on screen at the bottom-right", () => {
    expect(clampToViewport({ left: 5000, top: 5000 }, bar, viewport)).toEqual({
      left: 1440 - 120 - 8,
      top: 900 - 40 - 8,
    });
  });

  it("honours a custom inset", () => {
    expect(clampToViewport({ left: 0, top: 0 }, bar, viewport, 16)).toEqual({
      left: 16,
      top: 16,
    });
  });

  // If the bar is somehow bigger than the window, pinning to the inset beats
  // a negative offset: the grabbable part is the part that's on screen.
  it("pins to the top-left inset when the bar outgrows the viewport", () => {
    const tiny = { width: 100, height: 30 };
    expect(clampToViewport({ left: 40, top: 20 }, bar, tiny)).toEqual({
      left: 8,
      top: 8,
    });
  });
});
