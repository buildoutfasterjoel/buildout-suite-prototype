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
import { toDropTarget, type DragOverData } from "./dndTypes";

/**
 * Provides the single DndContext shared by the Blocks palette and the canvas.
 * Translates drop events into store mutations (palette → addBlock, existing
 * block → moveBlock) and renders a floating drag preview.
 */
export function EditorDndProvider({ children }: { children: ReactNode }) {
  const addBlock = useEditorStore((s) => s.addBlock);
  const moveBlock = useEditorStore((s) => s.moveBlock);
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
    const o = e.over?.data.current as DragOverData | undefined;
    if (!a || !o || !o.list) return;

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
