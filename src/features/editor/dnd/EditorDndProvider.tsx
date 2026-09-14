import { useState, type ReactNode } from "react";
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

/**
 * Where a drag ended, in page coordinates.
 *
 * dnd-kit reports the activator event and a delta, which together give the
 * release point without tracking pointermove ourselves. The page is found by
 * hit-testing the rendered pages rather than `elementFromPoint`, which returns
 * the drag overlay sitting under the cursor.
 */
function dropPoint(e: DragEndEvent): { pageId: string; x: number; y: number } | null {
  const activator = e.activatorEvent as PointerEvent;
  if (typeof activator?.clientX !== "number") return null;
  const cx = activator.clientX + e.delta.x;
  const cy = activator.clientY + e.delta.y;

  const zoom = useEditorStore.getState().zoom;
  for (const el of document.querySelectorAll<HTMLElement>("[data-page-id] .bo-editor-page")) {
    const r = el.getBoundingClientRect();
    if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) continue;
    const pageId = el.closest<HTMLElement>("[data-page-id]")?.dataset.pageId;
    if (!pageId) continue;
    return { pageId, x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };
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

  // A small drag threshold keeps single clicks as selections, not drags.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current as DragOverData) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const a = e.active.data.current as DragOverData | undefined;
    if (!a) return;

    // A free page has no sibling lists to drop into — the pointer position is
    // the whole instruction, so it is resolved here rather than through a
    // DropTarget index.
    if (a.source === "palette" && a.blockType) {
      const point = dropPoint(e);
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
      onDragCancel={() => setActive(null)}
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
