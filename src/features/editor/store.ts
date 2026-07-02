import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { Property } from "#/data/types";
import type {
  Block,
  DropTarget,
  EditorDocument,
  NavPanel,
  Selection,
} from "./types";
import { buildSampleDocument } from "./sampleDocument";
import { buildBlankPage, buildPresetPage, type PresetKey } from "./presets";
import { createBlock, createCell, type BlockVariant } from "./blocks/blockFactory";
import {
  findBlock,
  findLocation,
  insertAt,
  isContainer,
  removeBlock as removeBlockFromDoc,
  replaceBlock,
  updateTableRows,
} from "./tree";

/** Deep-clone plain document/block data (no functions or dates in the model). */
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** localStorage key for the properties panel's pinned/docked preference. */
export const SIDEBAR_PIN_STORAGE_KEY = "bo-editor:sidebar-pinned";

interface EditorState {
  document: EditorDocument;
  /** Pristine copy of the initial document, used to reset tables to template. */
  templateDocument: EditorDocument;
  activeListing: Property | undefined;
  selection: Selection | null;
  /**
   * Block "located" from the Layers panel — highlighted on the canvas without
   * opening its editing controls (unlike `selection`), so the Layers list stays
   * open. Null = nothing located.
   */
  highlightedBlockId: string | null;
  /** Page currently in view on the canvas — drives the Layers panel scope. */
  activePageId: string | null;
  /** Active left-rail panel. Null = no panel open (only the rail shows). */
  activeNavPanel: NavPanel | null;
  zoom: number;

  /** Docked in-flow (pushes the canvas) and always visible when true. */
  sidebarPinned: boolean;
  /** Transient "floating panel currently shown" flag — only meaningful when unpinned. */
  sidebarPoppedOpen: boolean;

  // Phase 1 actions (selection + navigation + view).
  initDocument: (listing: Property | undefined) => void;
  select: (selection: Selection | null) => void;
  clearSelection: () => void;
  /** Locate a block on the canvas from the Layers panel (highlight + scroll). */
  highlightBlock: (blockId: string | null) => void;
  /** Track the page currently in view (set as the canvas scrolls). */
  setActivePageId: (pageId: string) => void;
  setNavPanel: (panel: NavPanel | null) => void;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;

  /** Unpin and hide the properties panel. */
  collapseSidebar: () => void;
  /** Toggle docked (pinned) vs. floating (unpinned) mode. */
  toggleSidebarPin: () => void;

  // Page management.
  addPage: (kind: "blank" | PresetKey) => void;

  // Phase 2 actions (structural mutation via drag-and-drop).
  addBlock: (target: DropTarget, type: Block["type"], variant?: BlockVariant) => void;
  moveBlock: (blockId: string, target: DropTarget) => void;
  removeBlock: (blockId: string) => void;

  /** Edit a heading/text block's content in place. */
  setBlockText: (blockId: string, text: string) => void;
  /** Swap an image block's source. */
  setImageSrc: (blockId: string, src: string) => void;

  // Phase 3 actions (table row/column editing).
  addColumn: (blockId: string, index: number) => void;
  removeColumn: (blockId: string, index: number) => void;
  addRow: (blockId: string, index: number) => void;
  removeRow: (blockId: string, index: number) => void;

  /** Edit a cell's static text value. */
  setCellValue: (blockId: string, cellId: string, value: string) => void;
  /** Restore a table to its original template state (rows, style, title). */
  resetTable: (blockId: string) => void;
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

export const useEditorStore = create<EditorState>((set) => {
  const initialDocument = buildSampleDocument(undefined);
  return {
  document: initialDocument,
  templateDocument: clone(initialDocument),
  activeListing: undefined,
  // Default to a selected table cell so the contextual style panel shows,
  // matching the Figma reference state.
  selection: null,
  highlightedBlockId: null,
  activePageId: initialDocument.pages[0]?.id ?? null,
  activeNavPanel: "blocks",
  zoom: 1,
  // Hardcoded (not read from localStorage here) so server and first-render
  // client output match; EditorRoot syncs the real preference after mount.
  sidebarPinned: true,
  sidebarPoppedOpen: false,

  initDocument: (listing) => {
    const document = buildSampleDocument(listing);
    set({
      activeListing: listing,
      document,
      templateDocument: clone(document),
      selection: null,
      highlightedBlockId: null,
      activePageId: document.pages[0]?.id ?? null,
    });
  },

  select: (selection) =>
    set((s) => ({
      selection,
      // Opening an element's styles supersedes the active nav panel.
      activeNavPanel: selection ? null : "blocks",
      // Selecting an element pops the (unpinned) panel open.
      sidebarPoppedOpen: selection ? true : s.sidebarPoppedOpen,
    })),

  clearSelection: () =>
    set((s) => ({
      selection: null,
      highlightedBlockId: null,
      activeNavPanel: "blocks",
      // Auto-collapse only when unpinned; a pinned panel stays docked/open.
      sidebarPoppedOpen: s.sidebarPinned ? s.sidebarPoppedOpen : false,
    })),

  highlightBlock: (blockId) => set({ highlightedBlockId: blockId }),

  // Guard so scroll spam doesn't re-render when the page hasn't changed.
  setActivePageId: (pageId) =>
    set((s) => (s.activePageId === pageId ? s : { activePageId: pageId })),

  setNavPanel: (panel) =>
    set({ activeNavPanel: panel, selection: null, sidebarPoppedOpen: true }),

  setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
  zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + ZOOM_STEP) })),
  zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - ZOOM_STEP) })),

  collapseSidebar: () =>
    set(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, "false");
      }
      return { sidebarPinned: false, sidebarPoppedOpen: false };
    }),

  toggleSidebarPin: () =>
    set((s) => {
      const next = !s.sidebarPinned;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_PIN_STORAGE_KEY, String(next));
      }
      return { sidebarPinned: next, sidebarPoppedOpen: next ? s.sidebarPoppedOpen : true };
    }),

  addPage: (kind) =>
    set((s) => {
      const page =
        kind === "blank" ? buildBlankPage() : buildPresetPage(kind, s.activeListing);
      return {
        document: { ...s.document, pages: [...s.document.pages, page] },
        // Mirror into the template so table reset keeps working on new pages.
        templateDocument: {
          ...s.templateDocument,
          pages: [...s.templateDocument.pages, clone(page)],
        },
        selection: { pageId: page.id },
        activeNavPanel: "pages",
      };
    }),

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

  setBlockText: (blockId, text) =>
    set((s) => {
      const block = findBlock(s.document, blockId);
      if (!block || (block.type !== "heading" && block.type !== "text")) return s;
      return { document: replaceBlock(s.document, blockId, { ...block, text }) };
    }),

  setImageSrc: (blockId, src) =>
    set((s) => {
      const block = findBlock(s.document, blockId);
      if (!block || block.type !== "image") return s;
      return { document: replaceBlock(s.document, blockId, { ...block, src }) };
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

  setCellValue: (blockId, cellId, value) =>
    set((s) => ({
      document: updateTableRows(s.document, blockId, (rows) =>
        rows.map((row) => row.map((c) => (c.id === cellId ? { ...c, value } : c))),
      ),
    })),

  resetTable: (blockId) =>
    set((s) => {
      const template = findBlock(s.templateDocument, blockId);
      if (!template || template.type !== "table") return s;
      return {
        document: replaceBlock(s.document, blockId, clone(template)),
        // Drop any cell selection — reset cells may no longer exist.
        selection: clearTableCell(s.selection, blockId),
      };
    }),
  };
});

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
