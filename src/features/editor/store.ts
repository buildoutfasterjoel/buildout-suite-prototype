import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Property } from "#/data/types";
import type {
  Block,
  DropTarget,
  EditorDocument,
  NavPanel,
  Selection,
  TextAlign,
} from "./types";
import { buildSampleDocument } from "./sampleDocument";
import { createBlock, createCell, type BlockVariant } from "./blocks/blockFactory";
import {
  findBlock,
  findLocation,
  insertAt,
  isContainer,
  removeBlock as removeBlockFromDoc,
  updateTableRows,
} from "./tree";

interface EditorState {
  document: EditorDocument;
  activeListing: Property | undefined;
  selection: Selection | null;
  /** Active left-rail panel. Null = no panel open (only the rail shows). */
  activeNavPanel: NavPanel | null;
  zoom: number;

  // Phase 1 actions (selection + navigation + view).
  initDocument: (listing: Property | undefined) => void;
  select: (selection: Selection | null) => void;
  clearSelection: () => void;
  setNavPanel: (panel: NavPanel | null) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  // Phase 2 actions (structural mutation via drag-and-drop).
  addBlock: (target: DropTarget, type: Block["type"], variant?: BlockVariant) => void;
  moveBlock: (blockId: string, target: DropTarget) => void;
  removeBlock: (blockId: string) => void;

  // Phase 3 actions (table row/column editing).
  addColumn: (blockId: string, index: number) => void;
  removeColumn: (blockId: string, index: number) => void;
  addRow: (blockId: string, index: number) => void;
  removeRow: (blockId: string, index: number) => void;

  // Table options: header toggles + cell alignment.
  toggleHeaderRow: (blockId: string) => void;
  toggleHeaderColumn: (blockId: string) => void;
  /** Align one cell (by id) or, when cellId is null, every cell in the table. */
  setCellAlign: (blockId: string, cellId: string | null, align: TextAlign) => void;
  /** Edit a cell's static text value. */
  setCellValue: (blockId: string, cellId: string, value: string) => void;
}

/** Resolve the page a drop target belongs to (for post-add selection). */
function pageIdForTarget(doc: EditorDocument, target: DropTarget): string {
  if (target.kind === "page") return target.pageId;
  const loc = findLocation(doc, target.blockId);
  return loc && "pageId" in loc ? loc.pageId : doc.pages[0]?.id;
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export const useEditorStore = create<EditorState>((set) => ({
  document: buildSampleDocument(undefined),
  activeListing: undefined,
  // Default to a selected table cell so the contextual style panel shows,
  // matching the Figma reference state.
  selection: null,
  activeNavPanel: "blocks",
  zoom: 1,

  initDocument: (listing) =>
    set({
      activeListing: listing,
      document: buildSampleDocument(listing),
      selection: null,
    }),

  select: (selection) =>
    set({
      selection,
      // Opening an element's styles supersedes the active nav panel.
      activeNavPanel: selection ? null : "blocks",
    }),

  clearSelection: () => set({ selection: null, activeNavPanel: "blocks" }),

  setNavPanel: (panel) => set({ activeNavPanel: panel, selection: null }),

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - ZOOM_STEP) })),

  addBlock: (target, type, variant) =>
    set((s) => {
      // Containers may only be dropped at the top level (one-level nesting).
      if ((type === "columns" || type === "section") && target.kind !== "page") {
        return s;
      }
      const block = createBlock(type, variant);
      const document = insertAt(s.document, target, block);
      return {
        document,
        selection: { pageId: pageIdForTarget(document, target), blockId: block.id },
        activeNavPanel: null,
      };
    }),

  moveBlock: (blockId, target) =>
    set((s) => {
      const moving = findBlock(s.document, blockId);
      if (!moving) return s;
      // A container can't be nested inside another container.
      if (isContainer(moving) && target.kind !== "page") return s;

      // Remove-then-insert-at-target.index reproduces arrayMove semantics for a
      // same-list reorder, and inserts before the hovered item across lists.
      const { doc: without, removed } = removeBlockFromDoc(s.document, blockId);
      if (!removed) return s;
      return { document: insertAt(without, target, removed) };
    }),

  removeBlock: (blockId) =>
    set((s) => {
      const { doc, removed } = removeBlockFromDoc(s.document, blockId);
      if (!removed) return s;
      const clears = s.selection?.blockId === blockId;
      return { document: doc, selection: clears ? null : s.selection };
    }),

  addColumn: (blockId, index) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) =>
        rows.map((row) => {
          const next = [...row];
          // New column-0 cells inherit the existing header column's role.
          const header = index === 0 && row[0]?.header === true;
          next.splice(clampIndex(index, row.length), 0, createCell({ header }));
          return next;
        }),
      ),
    })),

  removeColumn: (blockId, index) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) => {
        if ((rows[0]?.length ?? 0) <= 1) return rows; // keep at least one column
        return rows.map((row) => row.filter((_, ci) => ci !== index));
      }),
      selection: clearTableCell(s.selection, blockId),
    })),

  addRow: (blockId, index) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) => {
        const cols = rows[0]?.length ?? 1;
        // Inherit each column's header flag from the current first row.
        const newRow = Array.from({ length: cols }, (_, ci) =>
          createCell({ header: rows[0]?.[ci]?.header === true }),
        );
        const next = [...rows];
        next.splice(clampIndex(index, rows.length), 0, newRow);
        return next;
      }),
    })),

  removeRow: (blockId, index) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) =>
        rows.length <= 1 ? rows : rows.filter((_, ri) => ri !== index),
      ),
      selection: clearTableCell(s.selection, blockId),
    })),

  toggleHeaderRow: (blockId) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) => {
        if (rows.length === 0) return rows;
        // Toggle off only when the whole first row is already header.
        const next = !rows[0].every((c) => c.header === true);
        return rows.map((row, ri) =>
          ri === 0 ? row.map((c) => ({ ...c, header: next })) : row,
        );
      }),
    })),

  toggleHeaderColumn: (blockId) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) => {
        if (rows.length === 0) return rows;
        const next = !rows.every((row) => row[0]?.header === true);
        return rows.map((row) =>
          row.map((c, ci) => (ci === 0 ? { ...c, header: next } : c)),
        );
      }),
    })),

  setCellAlign: (blockId, cellId, align) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) =>
        rows.map((row) =>
          row.map((c) => (cellId === null || c.id === cellId ? { ...c, align } : c)),
        ),
      ),
    })),

  setCellValue: (blockId, cellId, value) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) =>
        rows.map((row) => row.map((c) => (c.id === cellId ? { ...c, value } : c))),
      ),
    })),
}));

/** Clamp an insertion index into the inclusive range [0, length]. */
function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

/** Drop the cell part of a selection when it points at the given table. */
function clearTableCell(selection: Selection | null, blockId: string): Selection | null {
  if (selection?.blockId === blockId && selection.cellId) {
    return { pageId: selection.pageId, blockId };
  }
  return selection;
}

/** Resolve the current selection to its concrete page/block/cell objects. */
export function useSelectedEntities() {
  return useEditorStore(
    useShallow((s) => {
      const sel = s.selection;
      if (!sel) return { page: null, block: null, cell: null };
      const page = s.document.pages.find((p) => p.id === sel.pageId) ?? null;
      const block = page?.blocks.find((b) => b.id === sel.blockId) ?? null;
      let cell = null;
      if (block && block.type === "table" && sel.cellId) {
        for (const row of block.rows) {
          const found = row.find((c) => c.id === sel.cellId);
          if (found) {
            cell = found;
            break;
          }
        }
      }
      return { page, block, cell };
    }),
  );
}
