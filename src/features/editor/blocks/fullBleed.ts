import type { CSSProperties } from "react";
import { PAGE_PADDING } from "../types";

/**
 * Negative margins that cancel the page's content padding, so an image reaches
 * the paper's edge from inside a normally-margined page. Kept pure and separate
 * from the view so the geometry is testable without a renderer.
 */
export function fullBleedStyle(
  fullBleed: boolean | undefined,
  isFirst: boolean,
): CSSProperties {
  if (!fullBleed) return {};
  return {
    marginLeft: -PAGE_PADDING,
    marginRight: -PAGE_PADDING,
    width: `calc(100% + ${PAGE_PADDING * 2}px)`,
    ...(isFirst ? { marginTop: -PAGE_PADDING } : {}),
  };
}
