import { useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEditorStore } from "../store";
import { BLOCK_ICONS } from "../blocks/blockMeta";
import { frameAt } from "../frames";
import { toDropTarget, type DragOverData } from "./dndTypes";

/** A client-space point, as reported by a pointer event. */
type ClientPoint = { x: number; y: number };

/**
 * Where a drag ended, in page coordinates.
 *
 * `pointer` is the live pointer position tracked by a `pointermove` listener
 * for the drag's duration — not reconstructed from the activator event plus
 * `DragEndEvent.delta`. dnd-kit folds the workspace's own auto-scroll into
 * `delta`, so on this scrollable canvas `activatorEvent + delta` double-counts
 * any scroll that happened mid-drag and lands the drop off by however far the
 * canvas moved. The page is found by hit-testing the rendered pages rather
 * than `elementFromPoint`, which returns the drag overlay sitting under the
 * cursor.
 */
function dropPoint(pointer: ClientPoint | null): { pageId: string; x: number; y: number } | null {
  if (!pointer) return null;
  const zoom = useEditorStore.getState().zoom;
  for (const el of document.querySelectorAll<HTMLElement>("[data-page-id] .bo-editor-page")) {
    const r = el.getBoundingClientRect();
    if (pointer.x < r.left || pointer.x > r.right || pointer.y < r.top || pointer.y > r.bottom) {
      continue;
    }
    const pageId = el.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
    if (!pageId) continue;
    return { pageId, x: (pointer.x - r.left) / zoom, y: (pointer.y - r.top) / zoom };
  }
  return null;
}

/**
 * Provides the single DndContext shared by the Blocks palette and the canvas.
 * Translates drop events into store mutations (palette → addBlock, existing
 * block → moveBlock) and renders a floating drag preview.
 */
export function EditorDndProvider({ children }: { children: ReactNode }) {
  const addBlock = useEditorStore((s) => s.addBlock);
  const moveBlock = useEditorStore((s) => s.moveBlock);
  const movePage = useEditorStore((s) => s.movePage);
  const [active, setActive] = useState<DragOverData | null>(null);

  // Tracks the live pointer position for the duration of a drag (see
  // `dropPoint`'s doc comment for why this replaces activator+delta). The
  // handler itself is created once so add/remove always target the same
  // listener reference.
  const pointerRef = useRef<ClientPoint | null>(null);
  const handlePointerMoveRef = useRef((e: PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  });

  // A small drag threshold keeps single clicks as selections, not drags.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current as DragOverData) ?? null);
    const activator = e.activatorEvent as PointerEvent;
    pointerRef.current =
      typeof activator?.clientX === "number" ? { x: activator.clientX, y: activator.clientY } : null;
    window.addEventListener("pointermove", handlePointerMoveRef.current);
  }

  function endDrag() {
    window.removeEventListener("pointermove", handlePointerMoveRef.current);
  }

  function onDragEnd(e: DragEndEvent) {
    endDrag();
    setActive(null);
    const a = e.active.data.current as DragOverData | undefined;
    if (!a) return;

    // A free page has no sibling lists to drop into — the pointer position is
    // the whole instruction, so it is resolved here rather than through a
    // DropTarget index.
    if (a.source === "palette" && a.blockType) {
      const point = dropPoint(pointerRef.current);
      const page = point
        ? useEditorStore.getState().document.pages.find((p) => p.id === point.pageId)
        : undefined;
      if (point && page?.frames) {
        addBlock(
          { kind: "page", pageId: page.id, index: page.blocks.length },
          a.blockType,
          a.variant,
          frameAt(a.blockType, point.x, point.y),
        );
        return;
      }
    }

    const o = e.over?.data.current as DragOverData | undefined;
    if (!o) return;

    // Layers-panel reorder: page-scoped, over another layer row in the same page.
    if (a.source === "layer" && o.source === "layer" && a.pageId === o.pageId) {
      if (a.blockId && a.blockId !== o.blockId) {
        moveBlock(a.blockId, { kind: "page", pageId: a.pageId!, index: o.index ?? 0 });
      }
      return;
    }

    // Pages-panel reorder: top-level page order, over another page row.
    if (a.source === "page" && o.source === "page") {
      if (a.pageId && a.pageId !== o.pageId) {
        movePage(a.pageId, o.index ?? 0);
      }
      return;
    }

    if (!o.list) return;

    const index = o.dropKind === "list" ? o.length ?? 0 : o.index ?? 0;
    const target = toDropTarget(o.list, index);

    if (a.source === "palette" && a.blockType) {
      addBlock(target, a.blockType, a.variant);
    } else if (a.source === "block" && a.blockId) {
      if (a.blockId === e.over?.id) return; // dropped on itself
      moveBlock(a.blockId, target);
    }
  }

  return (
    <DndContext
      id="editor-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        endDrag();
        setActive(null);
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="bo-editor-drag-ghost">
            {active.blockType && <FontAwesomeIcon icon={BLOCK_ICONS[active.blockType]} />}
            <span>{active.label ?? "Block"}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
