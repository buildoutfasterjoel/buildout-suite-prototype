import type { Cell, TableBlock } from "../types";
import { isEmptyValue, resolveFieldValue, type DocumentData } from "../dynamic";

export interface VisibleRow {
  cells: Cell[];
  /** Position in `block.rows` — the row/column actions address the model. */
  index: number;
}

/**
 * The rows a table actually renders for the bound property.
 *
 * Rows carry their rule in `block.rowRules`, keyed by the first cell's id. A
 * row is dropped when its type rule excludes the bound property, or when every
 * dynamic cell it has resolves empty. Rows with no dynamic cells are never
 * dropped — a hand-authored row belongs to the user, not the data.
 *
 * With no property bound (gallery thumbnails) nothing is pruned: every value
 * would read empty and the table would vanish.
 */
export function visibleRows(block: TableBlock, data: DocumentData): VisibleRow[] {
  const all = block.rows.map((cells, index) => ({ cells, index }));
  if (!data.property) return all;

  return all.filter(({ cells }) => {
    const rule = block.rowRules?.[cells[0]?.id ?? ""];

    if (rule?.types && !rule.types.includes(data.property!.propertyType)) return false;
    if (rule?.keepEmpty) return true;

    const dynamic = cells.filter((c) => c.dynamicKey !== undefined);
    if (dynamic.length === 0) return true;
    return dynamic.some((c) => !isEmptyValue(resolveFieldValue(c.dynamicKey!, data)));
  });
}

/**
 * The model index to insert at when a DOM row index `i` may be the gutter's
 * trailing dot (no row after it).
 *
 * `rowIndexMap[i]` resolves every real row. But the trailing dot's naive
 * fallback of `i` itself (the visible row count) is only right by accident —
 * once any row is pruned, `i` addresses a position at or before the last
 * visible row rather than just past it, because pruned rows can sit between
 * visible ones (shifting their model indices ahead of `i`) or after the last
 * visible one (which the trailing dot must still land ahead of, so the new
 * row renders after the row the user is actually pointing at). The correct
 * fallback is always "just past the last visible row's model index."
 */
export function trailingRowInsertIndex(rowIndexMap: number[], i: number): number {
  if (rowIndexMap[i] !== undefined) return rowIndexMap[i];
  return rowIndexMap.length > 0 ? rowIndexMap[rowIndexMap.length - 1] + 1 : 0;
}
