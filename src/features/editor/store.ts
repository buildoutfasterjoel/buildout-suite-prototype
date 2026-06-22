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
import { createBlock, type BlockVariant } from "./blocks/blockFactory";
import {
  findBlock,
  findLocation,
  insertAt,
  isContainer,
  removeBlock as removeBlockFromDoc,
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
}));

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
