import type { TableBlock } from "../types";

/** Smallest on-screen width a column can be dragged down to. */
export const MIN_COL_PX = 32;

/**
 * Column widths live as relative weights, not percentages: a column's share is
 * `weight / sum(weights)`. Nothing has to renormalize when a column is added,
 * removed or reordered — the sum simply changes — and a drag can store the
 * measured pixel widths as-is.
 */
export function columnWeights(block: TableBlock): number[] | null {
  const cols = block.rows[0]?.length ?? 0;
  const widths = block.colWidths;
  // A stale array (a column arrived some other way) falls back to auto layout
  // rather than sizing every column against the wrong weight.
  if (!widths || cols === 0 || widths.length !== cols) return null;
  return widths;
}

/** The `width` percentage for each column of a `<colgroup>`. */
export function columnPercents(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  return weights.map((w) => (w / total) * 100);
}

/**
 * Drag the boundary on the left of column `index` by `deltaPx`: that column and
 * the one before it trade width, so the table's own width never changes. Takes
 * (and returns) measured pixel widths, which are valid weights.
 */
export function resizeColumns(widthsPx: number[], index: number, deltaPx: number): number[] {
  const left = widthsPx[index - 1];
  const right = widthsPx[index];
  if (left === undefined || right === undefined) return widthsPx;

  const lo = MIN_COL_PX - left;
  const hi = right - MIN_COL_PX;
  // Both neighbours are already below the minimum (a very narrow table): there
  // is no move that improves things, so don't make one.
  if (hi < lo) return widthsPx;

  const delta = Math.min(hi, Math.max(lo, deltaPx));
  const next = [...widthsPx];
  next[index - 1] = left + delta;
  next[index] = right - delta;
  return next;
}
